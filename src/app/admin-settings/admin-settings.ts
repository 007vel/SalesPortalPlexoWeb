import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { TrainingResourceStore, trainingResourceTypeIcon, trainingResourceTypeLabel } from '../training-resource-store/training-resource-store';
import { RepDirectoryStore, RepDocumentRecord } from '../rep-directory-store/rep-directory-store';
import { RepVideoDialog } from '../rep-video-dialog/rep-video-dialog';
import { Toast } from '../toast/toast';

const DOC_KIND_LABEL: Record<string, string> = { agreement: 'Representative Agreement', w4: 'W-4 Form' };

interface DocumentRow {
  oId: number;
  repId: string;
  repName: string;
  label: string;
  fileName: string;
}

@Component({
  selector: 'app-admin-settings',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatTableModule],
  templateUrl: './admin-settings.html',
  styleUrl: './admin-settings.scss',
})
export class AdminSettings {
  private readonly dialog = inject(MatDialog);
  private readonly trainingResourceStore = inject(TrainingResourceStore);
  private readonly directory = inject(RepDirectoryStore);
  private readonly toast = inject(Toast);

  private readonly documentsSignal = signal<RepDocumentRecord[]>([]);

  readonly resources = this.trainingResourceStore.resources;
  readonly typeIcon = trainingResourceTypeIcon;
  readonly typeLabel = trainingResourceTypeLabel;
  readonly displayedColumns = ['resource', 'category', 'type', 'actions'];
  readonly documentColumns = ['rep', 'repId', 'document', 'actions'];

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

  openUploadModal(): void {
    this.dialog
      .open(RepVideoDialog, { data: { mode: 'admin' } })
      .afterClosed()
      .subscribe((added) => {
        if (added) this.toast.show('Added to the hub');
      });
  }

  // Admins are a more trusted actor than reps — delete here is immediate,
  // unlike the rep-side remove flow which confirms first.
  deleteResource(id: string): void {
    this.trainingResourceStore.remove(id).subscribe(() => this.toast.show('Resource removed'));
  }

  viewResource(oId: number): void {
    this.trainingResourceStore.downloadDocument(oId).subscribe({
      next: (blob) => this.openBlob(blob),
      error: () => this.toast.show('Failed to open resource'),
    });
  }

  downloadResource(oId: number, fileName: string): void {
    this.trainingResourceStore.downloadDocument(oId).subscribe({
      next: (blob) => this.triggerDownload(blob, fileName),
      error: () => this.toast.show('Failed to download resource'),
    });
  }

  viewDocument(oId: number): void {
    this.directory.downloadDocument(oId).subscribe({
      next: (blob) => this.openBlob(blob),
      error: () => this.toast.show('Failed to open document'),
    });
  }

  downloadDocument(oId: number, fileName: string): void {
    this.directory.downloadDocument(oId).subscribe({
      next: (blob) => this.triggerDownload(blob, fileName),
      error: () => this.toast.show('Failed to download document'),
    });
  }

  private openBlob(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
