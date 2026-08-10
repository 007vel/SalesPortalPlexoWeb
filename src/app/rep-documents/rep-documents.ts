import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';
import { Auth } from '../auth/auth';
import { RepDirectoryStore } from '../rep-directory-store/rep-directory-store';
import { RepProfileStore } from '../rep-profile-store/rep-profile-store';
import { DocumentTemplateStore, DocTemplateKind } from '../document-template-store/document-template-store';
import { Toast } from '../toast/toast';

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
  private loadedForRepId: string | null = null;

  private readonly uploadingKinds = signal<ReadonlySet<DocTemplateKind>>(new Set());

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

  downloadTemplate(label: string, templateFilename: string): void {
    const filename = templateFilename.replace(/\.pdf$/, '.txt');
    const text = `PLEXO — ${label} (blank template)
------------------------------------------------
This is a prototype placeholder file standing in for:
${templateFilename}

In production this would be the real fillable PDF
uploaded by an admin under Settings → Blank document templates.`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    this.toast.show('Download started');
  }
}