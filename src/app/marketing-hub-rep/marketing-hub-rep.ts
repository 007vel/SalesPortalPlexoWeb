import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TrainingResource, TrainingResourceStore, trainingResourceTypeIcon, trainingResourceTypeLabel } from '../training-resource-store/training-resource-store';
import { TrainingHubLinksStore, videoLinkRows } from '../training-hub-links-store/training-hub-links-store';
import { MediaViewerDialog } from '../media-viewer-dialog/media-viewer-dialog';
import { Toast } from '../toast/toast';
import { extractYouTubeId, youTubeThumbnailUrl } from '../shared/youtube';

const ALL_CATEGORIES = 'all';

@Component({
  selector: 'app-marketing-hub-rep',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './marketing-hub-rep.html',
  styleUrl: './marketing-hub-rep.scss',
})
export class MarketingHubRep {
  private readonly dialog = inject(MatDialog);
  private readonly trainingResourceStore = inject(TrainingResourceStore);
  private readonly trainingHubLinksStore = inject(TrainingHubLinksStore);
  private readonly toast = inject(Toast);

  private static readonly MIN_VIEWING_MS = 200;

  readonly typeIcon = trainingResourceTypeIcon;
  readonly typeLabel = trainingResourceTypeLabel;
  readonly resources = this.trainingResourceStore.resources;
  readonly loaded = signal(false);
  readonly viewing = signal(false);

  readonly categoryFilter = signal<string>(ALL_CATEGORIES);
  readonly categories = computed(() => [...new Set(this.resources().map((r) => r.category))].sort((a, b) => a.localeCompare(b)));
  readonly filteredResources = computed(() => {
    const category = this.categoryFilter();
    const list = this.resources();
    return category === ALL_CATEGORIES ? list : list.filter((r) => r.category === category);
  });

  /** The 4 Product/Dashboard video links — moved here from the Training Hub's rep-facing page. */
  readonly videoRows = computed(() => {
    const links = this.trainingHubLinksStore.links();
    return links ? videoLinkRows(links) : [];
  });

  constructor() {
    this.trainingResourceStore.loadMarketing().subscribe({
      next: () => this.loaded.set(true),
      error: () => {
        this.loaded.set(true);
        this.toast.show('Failed to load Marketing Hub');
      },
    });
    this.trainingHubLinksStore.load().subscribe();
  }

  /** The thumbnail shown under each video row, kept visible at all times rather than just inside the viewer dialog. */
  youtubeThumbnail(url: string): string | null {
    const id = extractYouTubeId(url);
    return id ? youTubeThumbnailUrl(id) : null;
  }

  openVideoLink(url: string, title: string): void {
    if (this.dialog.openDialogs.length) return;
    this.dialog.open(MediaViewerDialog, {
      data: { title, type: 'youtube', url, fileName: title },
      maxWidth: '90vw',
      panelClass: 'media-viewer-panel',
    });
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
    const remaining = MarketingHubRep.MIN_VIEWING_MS - (Date.now() - startedAt);
    setTimeout(() => {
      this.viewing.set(false);
      after();
    }, Math.max(remaining, 0));
  }
}
