import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { RepDirectoryStore, RepRecord, docsComplete, repStatusBadge } from '../rep-directory-store/rep-directory-store';
import { CreateRepDialog } from '../create-rep-dialog/create-rep-dialog';
import { Toast } from '../toast/toast';

@Component({
  selector: 'app-admin-reps',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatTableModule],
  templateUrl: './admin-reps.html',
  styleUrl: './admin-reps.scss',
})
export class AdminReps {
  private readonly dialog = inject(MatDialog);
  private readonly directory = inject(RepDirectoryStore);
  private readonly toast = inject(Toast);

  readonly reps = this.directory.reps;
  readonly loading = this.directory.loading;
  readonly statusBadge = repStatusBadge;
  readonly docsComplete = docsComplete;
  readonly displayedColumns = ['repId', 'name', 'status', 'documents', 'portalLink', 'actions'];

  readonly totalCount = computed(() => this.reps().length);
  readonly activeCount = computed(() => this.reps().filter((r) => r.status === 'active').length);
  readonly pendingCount = computed(() => this.reps().filter((r) => r.status === 'pending').length);
  readonly docsCompleteCount = computed(() => this.reps().filter(docsComplete).length);
 
  copyLink(link: string): void {
    navigator.clipboard?.writeText(link).catch(() => { });
    this.toast.show(`Copied ${link}`);
  }

  copyEmail(email: string): void {
    navigator.clipboard?.writeText(email).catch(() => { });
    this.toast.show(`Copied ${email}`);
  }

  openCreateModal(): void {
    this.dialog
      .open(CreateRepDialog)
      .afterClosed()
      .subscribe((rep: RepRecord | undefined) => {
        if (rep) this.toast.show(`Rep ${rep.repId} created — link ${rep.portalLink}`);
      });
  }
}