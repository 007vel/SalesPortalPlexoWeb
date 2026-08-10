import { Component, computed, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
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
}

const DOC_DEFS: DocDef[] = [
  { kind: 'agreement', label: 'Representative Agreement' },
  { kind: 'w4', label: 'W-4 Form' },
];

@Component({
  selector: 'app-rep-documents',
  imports: [MatButtonModule, MatCardModule, MatIconModule],
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

  readonly docCards = computed<DocCardView[]>(() => {
    const docs = this.repProfileStore.profile().docs;
    const templates = this.documentTemplateStore.templates();
    return DOC_DEFS.map((def) => {
      const record = docs[def.kind];
      return {
        ...def,
        templateFilename: templates[def.kind].name,
        filled: !!record,
        statusText: record ? `Uploaded — ${record.name} · ${record.uploadedAt}` : 'Not uploaded yet',
        oId: record?.oId ?? null,
        fileName: record?.name ?? null,
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

    this.repProfileStore.setDocument(kind, file).subscribe({
      next: () => this.toast.show(`${label} uploaded`),
      error: () => this.toast.show(`Failed to upload ${label}`),
    });
    input.value = '';
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
    this.directory.downloadDocument(oId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.dialog
          .open(MediaViewerDialog, {
            data: { title: label, type: detectFileKind(fileName), url, fileName },
            maxWidth: '90vw',
            panelClass: 'media-viewer-panel',
          })
          .afterClosed()
          .subscribe(() => URL.revokeObjectURL(url));
      },
      error: () => this.toast.show(`Failed to open ${label}`),
    });
  }
}