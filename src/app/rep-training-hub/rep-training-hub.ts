import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TrainingResource, TrainingResourceStore, matchHubSlots, trainingResourceTypeIcon, trainingResourceTypeLabel } from '../training-resource-store/training-resource-store';
import { TrainingHubLinksStore } from '../training-hub-links-store/training-hub-links-store';
import { Toast } from '../toast/toast';
import { MediaViewerDialog } from '../media-viewer-dialog/media-viewer-dialog';
import { Auth } from '../auth/auth';

@Component({
  selector: 'app-rep-training-hub',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './rep-training-hub.html',
  styleUrl: './rep-training-hub.scss',
})
export class RepTrainingHub {
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(Auth);
  private readonly trainingResourceStore = inject(TrainingResourceStore);
  private readonly trainingHubLinksStore = inject(TrainingHubLinksStore);
  private readonly toast = inject(Toast);
  private static readonly MIN_VIEWING_MS = 200;
  readonly typeIcon = trainingResourceTypeIcon;
  readonly typeLabel = trainingResourceTypeLabel;
  readonly resources = this.trainingResourceStore.resources;
  readonly viewing = signal(false);
  readonly adminHubSlots = computed(() => matchHubSlots(this.resources().filter((r) => r.uploadedBy === 'Admin')));

  readonly resourceLinkRows = computed(() => {
    const links = this.trainingHubLinksStore.links();
    if (!links) return [];
    return [
      { key: 'knowledgeBase', label: 'Knowledge Base', icon: 'menu_book', url: links.knowledgeBaseLink ?? '' }
    ];
  });

  readonly featured = computed(() => this.resources().find((r) => r.featured));

  constructor() {
    const repId = this.auth.session()?.repId;
    if (repId) {
      this.trainingResourceStore.loadForRoleWithAdmin(repId).subscribe();
    }
    this.trainingHubLinksStore.load().subscribe();
  }

  openLink(url: string): void {
    window.open(url, '_blank', 'noopener');
  }

  view(resource: TrainingResource): void {
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
      next: (blob) => {
        this.stopViewing(startedAt, () => {
          if (this.dialog.openDialogs.length) return;
          const url = URL.createObjectURL(blob);
          this.dialog
            .open(MediaViewerDialog, {
              data: { title: resource.title, type: resource.type, url, fileName: resource.fileName },
              maxWidth: '90vw',
              panelClass: 'media-viewer-panel',
            })
            .afterClosed()
            .subscribe(() => URL.revokeObjectURL(url));
        });
      },
      error: () => this.stopViewing(startedAt, () => this.toast.show(`Failed to open ${resource.title}`)),
    });
  }

  downloadResource(oId: number, fileName: string): void {
    this.trainingResourceStore.downloadDocument(oId).subscribe({
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
      error: () => this.toast.show('Failed to download resource'),
    });
  }

   private stopViewing(startedAt: number, after: () => void): void {
    const remaining = RepTrainingHub.MIN_VIEWING_MS - (Date.now() - startedAt);
    setTimeout(() => {
      this.viewing.set(false);
      after();
    }, Math.max(remaining, 0));
  }
}