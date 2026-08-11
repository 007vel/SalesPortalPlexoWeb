import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TrainingResource, TrainingResourceStore, trainingResourceTypeIcon, trainingResourceTypeLabel } from '../training-resource-store/training-resource-store';
import { Toast } from '../toast/toast';
import { RepVideoDialog } from '../rep-video-dialog/rep-video-dialog';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { MediaViewerDialog } from '../media-viewer-dialog/media-viewer-dialog';
import { Auth } from '../auth/auth';

@Component({
  selector: 'app-rep-training-hub',
  imports: [MatButtonModule, MatCardModule, MatChipsModule, MatIconModule, MatProgressSpinnerModule, NgTemplateOutlet],
  templateUrl: './rep-training-hub.html',
  styleUrl: './rep-training-hub.scss',
})
export class RepTrainingHub {
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(Auth);
  private readonly trainingResourceStore = inject(TrainingResourceStore);
  private readonly toast = inject(Toast);

  /** Minimum time the view-loading overlay stays up — keeps it from flashing on fast/mocked responses. */
  private static readonly MIN_VIEWING_MS = 200;

  readonly typeIcon = trainingResourceTypeIcon;
  readonly typeLabel = trainingResourceTypeLabel;

  readonly resources = this.trainingResourceStore.resources;
  readonly activeCategory = signal('All');
  readonly viewing = signal(false);

  readonly categories = computed(() => Array.from(new Set(this.resources().map((r) => r.category))));
  readonly filterOptions = computed(() => ['All', ...this.categories()]);
  readonly featured = computed(() => this.resources().find((r) => r.featured));

  readonly filteredResources = computed(() => {
    const category = this.activeCategory();
    return category === 'All' ? this.resources() : this.resources().filter((r) => r.category === category);
  });

  readonly filteredAdminResources = computed(() => this.filteredResources().filter((r) => r.uploadedBy === 'Admin'));
  readonly filteredOwnResources = computed(() => this.filteredResources().filter((r) => r.uploadedBy === 'Rep'));

  readonly filteredAdminResourcesEnglish = computed(() => this.filteredAdminResources().filter((r) => r.language === 'English'));
  readonly filteredAdminResourcesSpanish = computed(() => this.filteredAdminResources().filter((r) => r.language === 'Spanish'));
  readonly filteredOwnResourcesEnglish = computed(() => this.filteredOwnResources().filter((r) => r.language === 'English'));
  readonly filteredOwnResourcesSpanish = computed(() => this.filteredOwnResources().filter((r) => r.language === 'Spanish'));

  constructor() {
    const repId = this.auth.session()?.repId;
    if (repId) {
      this.trainingResourceStore.loadForRoleWithAdmin(repId).subscribe();
    }
  }

  selectCategory(category: string): void {
    this.activeCategory.set(category);
  }

  openAddVideoModal(): void {
    this.dialog.open(RepVideoDialog).afterClosed().subscribe((added) => {
      if (added) this.toast.show('Added to the hub');
    });
  }

  /**
   * Opens the file in the in-app media viewer. Images/PDFs are fetched as a blob first since
   * the backend renders them inline regardless. Videos instead get the raw streaming URL —
   * the backend serves those with range support, so the <video> element can start playing and
   * seek without waiting for the whole file to download first.
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
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.stopViewing(startedAt, () => {
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

  /** Keeps the loading overlay up for at least MIN_VIEWING_MS so it doesn't flash on fast/mocked responses. */
  private stopViewing(startedAt: number, after: () => void): void {
    const remaining = RepTrainingHub.MIN_VIEWING_MS - (Date.now() - startedAt);
    setTimeout(() => {
      this.viewing.set(false);
      after();
    }, Math.max(remaining, 0));
  }

  askRemove(resource: TrainingResource): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Remove this resource?',
          message: `"${resource.title}" will be taken out of the Training & Resource Hub for everyone.`,
          confirmLabel: 'Remove',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.trainingResourceStore.remove(resource.id).subscribe(() => this.toast.show('Removed from the hub'));
        }
      });
  }
}