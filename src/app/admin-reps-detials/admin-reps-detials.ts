import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { RepDirectoryStore, RepStatus, portalLink, repStatusBadge } from '../rep-directory-store/rep-directory-store';
import { TrainingResource, TrainingResourceStore, detectFileKind, trainingResourceTypeIcon, trainingResourceTypeLabel } from '../training-resource-store/training-resource-store';
import { MediaViewerDialog } from '../media-viewer-dialog/media-viewer-dialog';
import { Toast } from '../toast/toast';

@Component({
  selector: 'app-admin-reps-detials',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule, MatSelectModule, NgTemplateOutlet],
  templateUrl: './admin-reps-detials.html',
  styleUrl: './admin-reps-detials.scss',
})
export class AdminRepsDetials {
  private readonly directory = inject(RepDirectoryStore);
  private readonly trainingResourceStore = inject(TrainingResourceStore);
  private readonly toast = inject(Toast);
  private readonly dialog = inject(MatDialog);
  private loadedForRepId: string | null = null;

  /** Minimum time the view-loading overlay stays up — keeps it from flashing on fast/mocked responses. */
  private static readonly MIN_VIEWING_MS = 200;

  readonly viewing = signal(false);

  readonly repId = input.required<string>();

  readonly rep = computed(() => this.directory.findByRepId(this.repId()));
  readonly fullAddress = computed(() => {
    const rep = this.rep();
    if (!rep) return '';
    return [rep.address, rep.city, rep.state, rep.zip].filter(Boolean).join(', ');
  });

  readonly portalLink = portalLink;
  readonly statusBadge = repStatusBadge;

  readonly trainingResources = this.trainingResourceStore.resources;
  readonly adminResources = computed(() => this.trainingResources().filter((r) => r.uploadedBy === 'Admin'));
  readonly ownResources = computed(() => this.trainingResources().filter((r) => r.uploadedBy === 'Rep'));

  readonly adminResourcesEnglish = computed(() => this.adminResources().filter((r) => r.language === 'English'));
  readonly adminResourcesSpanish = computed(() => this.adminResources().filter((r) => r.language === 'Spanish'));
  readonly ownResourcesEnglish = computed(() => this.ownResources().filter((r) => r.language === 'English'));
  readonly ownResourcesSpanish = computed(() => this.ownResources().filter((r) => r.language === 'Spanish'));
  readonly typeIcon = trainingResourceTypeIcon;
  readonly typeLabel = trainingResourceTypeLabel;

  constructor() {
    // Docs (and this rep's Training Hub view) live in shared in-memory stores — fetch them once
    // this rep is actually present in the directory, and again whenever admin navigates to a
    // different rep's detail page.
    effect(() => {
      const repId = this.repId();
      if (repId === this.loadedForRepId) return;
      if (!this.directory.findByRepId(repId)) return;
      this.loadedForRepId = repId;
      this.directory.loadDocuments(repId).subscribe();
      this.directory.loadBankDetails(repId).subscribe();
      this.trainingResourceStore.loadForRoleWithAdmin(repId).subscribe();
    });
  }

  copyLink(link: string): void {
    navigator.clipboard?.writeText(link).catch(() => { });
    this.toast.show(`Copied ${link}`);
  }

  copyEmail(): void {
    const email = this.rep()?.email;
    if (!email) return;
    navigator.clipboard?.writeText(email).catch(() => { });
    this.toast.show(`Copied ${email}`);
  }

  updateStatus(status: RepStatus): void {
    this.directory.updateStatus(this.repId(), status).subscribe({
      next: () => this.toast.show(`Status updated to ${status}`),
      error: () => this.toast.show('Failed to update status'),
    });
  }

  downloadDocument(oId: number, fileName: string): void {
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
      error: () => this.toast.show('Failed to update status'),
    });
  }

  /** Opens an agreement/W-4 document in the in-app viewer instead of forcing a download. */
  viewDocument(oId: number, fileName: string, label: string): void {
    this.viewing.set(true);
    const startedAt = Date.now();
    this.directory.downloadDocument(oId).subscribe({
      next: (blob) => this.stopViewing(startedAt, () => this.openViewer({ title: label, type: detectFileKind(fileName), blob, fileName })),
      error: () => this.stopViewing(startedAt, () => this.toast.show(`Failed to open ${label}`)),
    });
  }

  /**
   * Opens a training hub resource in the in-app viewer. Videos get the raw streaming URL directly —
   * the backend serves those with range support, so the <video> element can start playing and seek
   * without waiting for the whole file to download first. Other types still fetch as a blob first,
   * since following the URL directly would otherwise force a download.
   */
  view(resource: TrainingResource): void {
    if (resource.type === 'video') {
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
      next: (blob) => this.stopViewing(startedAt, () => this.openViewer({ title: resource.title, type: resource.type, blob, fileName: resource.fileName })),
      error: () => this.stopViewing(startedAt, () => this.toast.show(`Failed to open ${resource.title}`)),
    });
  }

  /** Keeps the loading overlay up for at least MIN_VIEWING_MS so it doesn't flash on fast/mocked responses. */
  private stopViewing(startedAt: number, after: () => void): void {
    const remaining = AdminRepsDetials.MIN_VIEWING_MS - (Date.now() - startedAt);
    setTimeout(() => {
      this.viewing.set(false);
      after();
    }, Math.max(remaining, 0));
  }

  private openViewer(args: { title: string; type: ReturnType<typeof detectFileKind>; blob: Blob; fileName: string }): void {
    const url = URL.createObjectURL(args.blob);
    this.dialog
      .open(MediaViewerDialog, {
        data: { title: args.title, type: args.type, url, fileName: args.fileName },
        maxWidth: '90vw',
        panelClass: 'media-viewer-panel',
      })
      .afterClosed()
      .subscribe(() => URL.revokeObjectURL(url));
  }
}