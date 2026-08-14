import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { finalize } from 'rxjs';
import { HubSlotDef, TrainingResource, TrainingResourceStore, detectFileKind, matchHubSlots, trainingResourceTypeIcon, trainingResourceTypeLabel } from '../training-resource-store/training-resource-store';
import { RepDirectoryStore, RepDocumentRecord } from '../rep-directory-store/rep-directory-store';
import { MediaViewerDialog } from '../media-viewer-dialog/media-viewer-dialog';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { Toast } from '../toast/toast';

const DOC_KIND_LABEL: Record<string, string> = { agreement: 'Representative Agreement', w4: 'W-4 Form' };

interface DocumentRow {
  oId: number;
  repId: string;
  repName: string;
  label: string;
  fileName: string;
}

interface HubSlotView extends HubSlotDef {
  resource: TrainingResource | null;
  uploading: boolean;
}

@Component({
  selector: 'app-admin-settings',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatMenuModule, MatProgressSpinnerModule, MatTableModule],
  templateUrl: './admin-settings.html',
  styleUrl: './admin-settings.scss',
})
export class AdminSettings {
  private readonly dialog = inject(MatDialog);
  private readonly trainingResourceStore = inject(TrainingResourceStore);
  private readonly directory = inject(RepDirectoryStore);
  private readonly toast = inject(Toast);

  private readonly documentsSignal = signal<RepDocumentRecord[]>([]);
  private readonly uploadingSlots = signal<ReadonlySet<string>>(new Set());

  /** Minimum time the view-loading overlay stays up — keeps it from flashing on fast/mocked responses. */
  private static readonly MIN_VIEWING_MS = 200;

  readonly viewing = signal(false);

  readonly resources = this.trainingResourceStore.resources;
  readonly typeIcon = trainingResourceTypeIcon;
  readonly typeLabel = trainingResourceTypeLabel;
  readonly documentColumns = ['rep', 'repId', 'document', 'actions'];

  /** The 5 fixed hub slots, each matched to its uploaded file (if any) by category. */
  readonly hubSlots = computed<HubSlotView[]>(() => {
    const uploading = this.uploadingSlots();
    return matchHubSlots(this.resources()).map((slot) => ({ ...slot, uploading: uploading.has(slot.key) }));
  });

  readonly filledSlotCount = computed(() => this.hubSlots().filter((s) => !!s.resource).length);

  readonly documentRows = computed<DocumentRow[]>(() => {
    const reps = this.directory.reps();
    return this.documentsSignal().map((doc) => ({
      oId: doc.oId,
      repId: doc.repId,
      repName: reps.find((r) => r.repId === doc.repId)?.name ?? '—',
      label: DOC_KIND_LABEL[doc.kind] ?? doc.kind,
      fileName: doc.fileName,
    }));
  });

  constructor() {
    this.trainingResourceStore.loadAdminUploads().subscribe();
    this.directory.loadAllDocuments().subscribe((docs) => this.documentsSignal.set(docs));
  }

  /** Uploads (or replaces) the file for a fixed hub slot — no title/category/description form, just the file. */
  handleSlotUpload(slot: HubSlotDef, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const previous = this.resources().find((r) => r.category === slot.category) ?? null;
    this.setSlotUploading(slot.key, true);
    this.trainingResourceStore
      .uploadDocument(
        { title: slot.label, category: slot.category, length: '', description: '', uploadedBy: 'Admin', language: slot.language },
        file,
      )
      .pipe(finalize(() => this.setSlotUploading(slot.key, false)))
      .subscribe({
        next: () => {
          this.toast.show(`${slot.label} uploaded`);
          if (previous) this.trainingResourceStore.remove(previous.id).subscribe();
        },
        error: () => this.toast.show(`Failed to upload ${slot.label}`),
      });
    input.value = '';
  }

  /** Confirms then deletes a hub slot's uploaded file, clearing the slot back to "Not uploaded yet". */
  askDeleteResource(slot: HubSlotDef, resource: TrainingResource): void {
    if (this.dialog.openDialogs.length) return;
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Delete ${slot.label}?`,
          message: `"${resource.fileName}" will be permanently removed. This can't be undone.`,
          confirmLabel: 'Delete',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.setSlotUploading(slot.key, true);
        this.trainingResourceStore
          .remove(resource.id)
          .pipe(finalize(() => this.setSlotUploading(slot.key, false)))
          .subscribe({
            next: () => this.toast.show(`${slot.label} deleted`),
            error: () => this.toast.show(`Failed to delete ${slot.label}`),
          });
      });
  }

  private setSlotUploading(key: string, uploading: boolean): void {
    this.uploadingSlots.update((keys) => {
      const next = new Set(keys);
      if (uploading) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  /**
   * Videos get the raw streaming URL directly — the backend serves those with range support, so
   * the <video> element can start playing and seek without waiting for the whole file to download
   * first. Other types still fetch as a blob first, since the file endpoint otherwise forces a download.
   */
  viewResource(resource: TrainingResource): void {
    if (resource.type === 'video') {
      if (this.dialog.openDialogs.length) return;
      this.dialog.open(MediaViewerDialog, {
        data: { title: resource.title, type: resource.type, url: resource.url, fileName: resource.fileName },
        maxWidth: '90vw',
        panelClass: 'media-viewer-panel',
      });
      return;
    }

    this.viewing.set(true);
    const startedAt = Date.now();
    this.trainingResourceStore.downloadDocument(resource.oId).subscribe({
      next: (blob) => this.stopViewing(startedAt, () => this.openViewer(blob, resource.title, resource.type, resource.fileName)),
      error: () => this.stopViewing(startedAt, () => this.toast.show('Failed to open resource')),
    });
  }

  /** Keeps the loading overlay up for at least MIN_VIEWING_MS so it doesn't flash on fast/mocked responses. */
  private stopViewing(startedAt: number, after: () => void): void {
    const remaining = AdminSettings.MIN_VIEWING_MS - (Date.now() - startedAt);
    setTimeout(() => {
      this.viewing.set(false);
      after();
    }, Math.max(remaining, 0));
  }

  downloadResource(oId: number, fileName: string): void {
    this.trainingResourceStore.downloadDocument(oId).subscribe({
      next: (blob) => this.triggerDownload(blob, fileName),
      error: () => this.toast.show('Failed to download resource'),
    });
  }

  viewDocument(doc: DocumentRow): void {
    this.directory.downloadDocument(doc.oId).subscribe({
      next: (blob) => this.openViewer(blob, doc.label, detectFileKind(doc.fileName), doc.fileName),
      error: () => this.toast.show('Failed to open document'),
    });
  }

  downloadDocument(oId: number, fileName: string): void {
    this.directory.downloadDocument(oId).subscribe({
      next: (blob) => this.triggerDownload(blob, fileName),
      error: () => this.toast.show('Failed to download document'),
    });
  }

  /** Opens the file in the in-app media viewer instead of a new browser tab — the file endpoint forces a download rather than letting the browser render it. */
  private openViewer(blob: Blob, title: string, type: TrainingResource['type'], fileName: string): void {
    if (this.dialog.openDialogs.length) return;
    const url = URL.createObjectURL(blob);
    this.dialog
      .open(MediaViewerDialog, {
        data: { title, type, url, fileName },
        maxWidth: '90vw',
        panelClass: 'media-viewer-panel',
      })
      .afterClosed()
      .subscribe(() => URL.revokeObjectURL(url));
  }

  private triggerDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    this.toast.show('Download started');
  }
}
