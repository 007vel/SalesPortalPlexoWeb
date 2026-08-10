import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';
import { Auth } from '../auth/auth';
import { RepDirectoryStore } from '../rep-directory-store/rep-directory-store';
import { RepProfileStore } from '../rep-profile-store/rep-profile-store';
import { DocumentTemplateStore, DocTemplateKind } from '../document-template-store/document-template-store';
import { Toast } from '../toast/toast';
import { detectFileKind } from '../training-resource-store/training-resource-store';
import { MediaViewerDialog } from '../media-viewer-dialog/media-viewer-dialog';

interface DocDef {
  kind: DocTemplateKind;
  label: string;
}

interface DocCardView extends DocDef {
  templateFilename: string;
  filled: boolean;
  statusText: string;
  oId: number | null;
  fileName: string | null;
  uploading: boolean;
}

const DOC_DEFS: DocDef[] = [
  { kind: 'agreement', label: 'Representative Agreement' },
  { kind: 'w4', label: 'W-4 Form' },
];

@Component({
  selector: 'app-rep-documents',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './rep-documents.html',
  styleUrl: './rep-documents.scss',
})
export class RepDocuments {
  private readonly auth = inject(Auth);
  private readonly directory = inject(RepDirectoryStore);
  private readonly repProfileStore = inject(RepProfileStore);
  private readonly documentTemplateStore = inject(DocumentTemplateStore);
  private readonly toast = inject(Toast);
  private readonly dialog = inject(MatDialog);
  private loadedForRepId: string | null = null;

  /** Minimum time the view-loading overlay stays up — keeps it from flashing on fast/mocked responses. */
  private static readonly MIN_VIEWING_MS = 200;

  private readonly uploadingKinds = signal<ReadonlySet<DocTemplateKind>>(new Set());

  readonly viewing = signal(false);

  readonly docCards = computed<DocCardView[]>(() => {
    const docs = this.repProfileStore.profile().docs;
    const templates = this.documentTemplateStore.templates();
    const uploading = this.uploadingKinds();
    return DOC_DEFS.map((def) => {
      const record = docs[def.kind];
      return {
        ...def,
        templateFilename: templates[def.kind].name,
        filled: !!record,
        statusText: record ? `Uploaded — ${record.name} · ${record.uploadedAt}` : 'Not uploaded yet',
        oId: record?.oId ?? null,
        fileName: record?.name ?? null,
        uploading: uploading.has(def.kind),
      };
    });
  });

  constructor() {
    // Docs live in RepDirectoryStore's in-memory list, keyed by rep — fetch them once the
    // signed-in rep is actually present in that list (it loads asynchronously on app start).
    effect(() => {
      const repId = this.auth.session()?.repId;
      if (!repId || repId === this.loadedForRepId) return;
      if (!this.directory.findByRepId(repId)) return;
      this.loadedForRepId = repId;
      this.directory.loadDocuments(repId).subscribe();
    });
  }

  handleUpload(kind: DocTemplateKind, label: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.setUploading(kind, true);
    this.repProfileStore
      .setDocument(kind, file)
      .pipe(finalize(() => this.setUploading(kind, false)))
      .subscribe({
        next: () => this.toast.show(`${label} uploaded`),
        error: () => this.toast.show(`Failed to upload ${label}`),
      });
    input.value = '';
  }

  private setUploading(kind: DocTemplateKind, uploading: boolean): void {
    this.uploadingKinds.update((kinds) => {
      const next = new Set(kinds);
      if (uploading) next.add(kind);
      else next.delete(kind);
      return next;
    });
  }

  downloadDocument(oId: number, fileName: string, label: string): void {
    this.directory.downloadDocument(oId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        this.toast.show('Download started');
      },
      error: () => this.toast.show(`Failed to download ${label}`),
    });
  }

  /** Opens the document in the in-app viewer instead of forcing a download. */
  viewDocument(oId: number, fileName: string, label: string): void {
    this.viewing.set(true);
    const startedAt = Date.now();
    this.directory.downloadDocument(oId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.stopViewing(startedAt, () => {
          this.dialog
            .open(MediaViewerDialog, {
              data: { title: label, type: detectFileKind(fileName), url, fileName },
              maxWidth: '90vw',
              panelClass: 'media-viewer-panel',
            })
            .afterClosed()
            .subscribe(() => URL.revokeObjectURL(url));
        });
      },
      error: () => this.stopViewing(startedAt, () => this.toast.show(`Failed to open ${label}`)),
    });
  }

  /** Keeps the loading overlay up for at least MIN_VIEWING_MS so it doesn't flash on fast/mocked responses. */
  private stopViewing(startedAt: number, after: () => void): void {
    const remaining = RepDocuments.MIN_VIEWING_MS - (Date.now() - startedAt);
    setTimeout(() => {
      this.viewing.set(false);
      after();
    }, Math.max(remaining, 0));
  }
}