import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RepVideoDialog } from '../rep-video-dialog/rep-video-dialog';
import { TrainingResource, TrainingResourceStore, trainingResourceTypeIcon, trainingResourceTypeLabel } from '../training-resource-store/training-resource-store';
import { MediaViewerDialog } from '../media-viewer-dialog/media-viewer-dialog';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { Toast } from '../toast/toast';

export const ALL_CATEGORIES = 'all';

@Component({
  selector: 'app-marketing-hub-admin',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatMenuModule, MatProgressSpinnerModule],
  templateUrl: './marketing-hub-admin.html',
  styleUrl: './marketing-hub-admin.scss',
})
export class MarketingHubAdmin {
  private readonly dialog = inject(MatDialog);
  private readonly trainingResourceStore = inject(TrainingResourceStore);
  private readonly toast = inject(Toast);

  /** Minimum time the view-loading overlay stays up — keeps it from flashing on fast/mocked responses. */
  private static readonly MIN_VIEWING_MS = 200;

  readonly typeIcon = trainingResourceTypeIcon;
  readonly typeLabel = trainingResourceTypeLabel;
  readonly resources = this.trainingResourceStore.resources;
  /** Gates the first render so a stale Training Hub resource never flashes here while Marketing Hub's own list loads. */
  readonly loaded = signal(false);
  readonly viewing = signal(false);
  readonly deletingId = signal<string | null>(null);

  readonly categoryFilter = signal<string>(ALL_CATEGORIES);
  readonly categories = computed(() => [...new Set(this.resources().map((r) => r.category))].sort((a, b) => a.localeCompare(b)));
  readonly filteredResources = computed(() => {
    const category = this.categoryFilter();
    const list = this.resources();
    return category === ALL_CATEGORIES ? list : list.filter((r) => r.category === category);
  });

  constructor() {
    this.trainingResourceStore.loadMarketing().subscribe({
      next: () => this.loaded.set(true),
      error: () => {
        this.loaded.set(true);
        this.toast.show('Failed to load Marketing Hub');
      },
    });
  }

  openAddDialog(): void {
    if (this.dialog.openDialogs.length) return;
    this.dialog
      .open(RepVideoDialog, { data: { mode: 'admin', hubType: 'Marketing' } })
      .afterClosed()
      .subscribe((added) => {
        if (added) this.toast.show('Added to Marketing Hub');
      });
  }

  openEditDialog(resource: TrainingResource): void {
    if (this.dialog.openDialogs.length) return;
    this.dialog
      .open(RepVideoDialog, { data: { mode: 'admin', hubType: 'Marketing', edit: resource } })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) this.toast.show('Resource updated');
      });
  }

  askDeleteResource(resource: TrainingResource): void {
    if (this.dialog.openDialogs.length) return;
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Delete "${resource.title}"?`,
          message: `"${resource.fileName}" will be permanently removed. This can't be undone.`,
          confirmLabel: 'Delete',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.deletingId.set(resource.id);
        this.trainingResourceStore.remove(resource.id).subscribe({
          next: () => {
            this.deletingId.set(null);
            this.toast.show(`"${resource.title}" deleted`);
          },
          error: () => {
            this.deletingId.set(null);
            this.toast.show('Failed to delete resource');
          },
        });
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

  downloadResource(oId: number, fileName: string): void {
    this.trainingResourceStore.downloadDocument(oId).subscribe({
      next: (blob) => this.triggerDownload(blob, fileName),
      error: () => this.toast.show('Failed to download resource'),
    });
  }

  /** Keeps the loading overlay up for at least MIN_VIEWING_MS so it doesn't flash on fast/mocked responses. */
  private stopViewing(startedAt: number, after: () => void): void {
    const remaining = MarketingHubAdmin.MIN_VIEWING_MS - (Date.now() - startedAt);
    setTimeout(() => {
      this.viewing.set(false);
      after();
    }, Math.max(remaining, 0));
  }

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
