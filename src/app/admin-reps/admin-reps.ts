import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RepDirectoryStore, RepRecord, RepStatus, SalesRepType, docsComplete, repStatusBadge, salesRepTypeLabel } from '../rep-directory-store/rep-directory-store';
import { CreateRepDialog } from '../create-rep-dialog/create-rep-dialog';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { Toast } from '../toast/toast';

/** Debounce before a search keystroke actually fires the filter request. */
const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-admin-reps',
  imports: [
    RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressSpinnerModule, MatSelectModule, MatTableModule,
  ],
  templateUrl: './admin-reps.html',
  styleUrl: './admin-reps.scss',
})
export class AdminReps {
  private readonly dialog = inject(MatDialog);
  private readonly directory = inject(RepDirectoryStore);
  private readonly toast = inject(Toast);
  private searchDebounce: ReturnType<typeof setTimeout> | undefined;
  private readonly deletingIds = signal<ReadonlySet<number>>(new Set());

  readonly loading = this.directory.loading;
  readonly statusBadge = repStatusBadge;
  readonly docsComplete = docsComplete;
  readonly repTypeLabel = salesRepTypeLabel;
  readonly displayedColumns = ['repId', 'name', 'salesRepType', 'status', 'documents', 'portalLink', 'actions'];

  // Portfolio-wide stats always reflect the full directory, regardless of the filters below.
  readonly totalCount = computed(() => this.directory.reps().length);
  readonly activeCount = computed(() => this.directory.reps().filter((r) => r.status === 'active').length);
  readonly pendingCount = computed(() => this.directory.reps().filter((r) => r.status === 'pending').length);
  readonly docsCompleteCount = computed(() => this.directory.reps().filter(docsComplete).length);

  // ----- filters (status, sales rep type, name search) — backed by GET api/reps/filter -----
  readonly statusFilter = signal<RepStatus | 'all'>('all');
  readonly salesRepTypeFilter = signal<SalesRepType | 'all'>('all');
  readonly searchTerm = signal('');
  readonly filtering = signal(false);

  /** `null` = no filter applied yet, so the table falls back to the full unfiltered directory. */
  private readonly filteredReps = signal<RepRecord[] | null>(null);

  readonly reps = computed(() => this.filteredReps() ?? this.directory.reps());
  readonly isFiltered = computed(() => this.filteredReps() !== null);

  constructor() {
    // Re-runs whenever any filter signal changes; the actual HTTP call and the resulting
    // `filteredReps.set(...)` happen asynchronously in the subscribe callback below, well after
    // this effect's own synchronous pass — so it's not a same-tick signal write.
    effect(() => {
      const status = this.statusFilter();
      const salesRepType = this.salesRepTypeFilter();
      const search = this.searchTerm().trim();
      const hasFilter = status !== 'all' || salesRepType !== 'all' || !!search;

      if (!hasFilter) {
        this.filteredReps.set(null);
        return;
      }

      this.filtering.set(true);
      this.directory
        .filterReps({
          status: status === 'all' ? undefined : status,
          salesRepType: salesRepType === 'all' ? undefined : salesRepType,
          search: search || undefined,
        })
        .pipe(finalize(() => this.filtering.set(false)))
        .subscribe({
          next: (reps) => this.filteredReps.set(reps),
          error: () => this.toast.show('Failed to filter reps'),
        });
    });
  }

  /** Debounced so a filter request doesn't fire on every keystroke. */
  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.searchTerm.set(value), SEARCH_DEBOUNCE_MS);
  }

  clearFilters(): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.statusFilter.set('all');
    this.salesRepTypeFilter.set('all');
    this.searchTerm.set('');
  }

  copyLink(link: string): void {
    navigator.clipboard?.writeText(link).catch(() => { });
    this.toast.show(`Copied ${link}`);
  }

  copyEmail(email: string): void {
    navigator.clipboard?.writeText(email).catch(() => { });
    this.toast.show(`Copied ${email}`);
  }

  isDeleting(oId: number): boolean {
    return this.deletingIds().has(oId);
  }

  readonly anyDeleting = computed(() => this.deletingIds().size > 0);

  askDelete(rep: RepRecord, event: Event): void {
    event.stopPropagation();
    if (this.dialog.openDialogs.length) return;
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: '',
          message: `Are you sure you want to delete?`,
          confirmLabel: 'Delete',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.setDeleting(rep.oId, true);
        this.directory
          .deleteRep(rep.oId)
          .pipe(finalize(() => this.setDeleting(rep.oId, false)))
          .subscribe({
            next: () => this.toast.show(`"${rep.name || rep.repId}" Deleted Successfully`),
            error: () => this.toast.show('Failed to delete rep'),
          });
      });
  }

  private setDeleting(oId: number, deleting: boolean): void {
    this.deletingIds.update((ids) => {
      const next = new Set(ids);
      if (deleting) next.add(oId);
      else next.delete(oId);
      return next;
    });
  }

  openCreateModal(): void {
    if (this.dialog.openDialogs.length) return;
    this.dialog
      .open(CreateRepDialog, {
        width: 'min(980px, 96vw)',
        maxWidth: '96vw',
        maxHeight: '90vh',
        autoFocus: false,
        panelClass: 'crd-dialog-panel',
      })
      .afterClosed()
      .subscribe((rep: RepRecord | undefined) => {
        if (rep) this.toast.show(`Rep ${rep.repId} created — link ${rep.portalLink}`);
      });
  }
}
