import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TrainingResource, TrainingResourceStore, trainingResourceTypeIcon, trainingResourceTypeLabel } from '../training-resource-store/training-resource-store';
import { Toast } from '../toast/toast';
import { RepVideoDialog } from '../rep-video-dialog/rep-video-dialog';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { Auth } from '../auth/auth';

@Component({
  selector: 'app-rep-training-hub',
  imports: [MatButtonModule, MatCardModule, MatChipsModule, MatIconModule],
  templateUrl: './rep-training-hub.html',
  styleUrl: './rep-training-hub.scss',
})
export class RepTrainingHub {
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(Auth);
  private readonly trainingResourceStore = inject(TrainingResourceStore);
  private readonly toast = inject(Toast);

  readonly typeIcon = trainingResourceTypeIcon;
  readonly typeLabel = trainingResourceTypeLabel;

  readonly resources = this.trainingResourceStore.resources;
  readonly activeCategory = signal('All');

  readonly categories = computed(() => Array.from(new Set(this.resources().map((r) => r.category))));
  readonly filterOptions = computed(() => ['All', ...this.categories()]);
  readonly featured = computed(() => this.resources().find((r) => r.featured));

  readonly filteredResources = computed(() => {
    const category = this.activeCategory();
    return category === 'All' ? this.resources() : this.resources().filter((r) => r.category === category);
  });

  constructor() {
    const repId = this.auth.session()?.repId;
    if (repId) {
      this.trainingResourceStore.loadForRole(repId).subscribe();
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