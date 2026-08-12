import { ChangeDetectorRef, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Auth } from '../auth/auth';
import { RepDirectoryStore } from '../rep-directory-store/rep-directory-store';
import { RepProfileStore } from '../rep-profile-store/rep-profile-store';
import { Toast } from '../toast/toast';

interface LinkRow {
  key: string;
  label: string;
  value: string;
  href: string;
}

@Component({
  selector: 'app-rep-links',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './rep-links.html',
  styleUrl: './rep-links.scss',
})
export class RepLinks {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly directory = inject(RepDirectoryStore);
  private readonly repProfileStore = inject(RepProfileStore);
  private readonly toast = inject(Toast);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly editing = signal(false);
  readonly saving = signal(false);

  /** Minimum time the save overlay stays up — keeps it from flashing on fast/mocked responses. */
  private static readonly MIN_SAVING_MS = 600;

  readonly form = this.fb.nonNullable.group({
    googleLink: [''],
    resourceLink: [''],
    pricingSheetLink: [''],
    powerPointLink: [''],
  });

  readonly linkRows = computed<LinkRow[]>(() => {
    const profile = this.repProfileStore.profile();
    return [
      { key: 'googleLink', label: 'Google link', value: profile.googleLink },
      { key: 'resourceLink', label: 'Resource link', value: profile.resourceLink },
      { key: 'pricingSheetLink', label: 'Pricing sheet link', value: profile.pricingSheetLink },
      { key: 'powerPointLink', label: 'PowerPoint link', value: profile.powerPointLink },
    ].map((row) => ({ ...row, href: this.toHref(row.value) }));
  });

  constructor() {
    effect(() => {
      const profile = this.repProfileStore.profile();
      if (this.form.pristine) {
        this.form.patchValue(
          {
            googleLink: profile.googleLink,
            resourceLink: profile.resourceLink,
            pricingSheetLink: profile.pricingSheetLink,
            powerPointLink: profile.powerPointLink,
          },
          { emitEvent: false },
        );
        this.cdr.detectChanges();
      }
    });
  }

  startEdit(): void {
    this.editing.set(true);
  }

  cancelEdit(): void {
    const profile = this.repProfileStore.profile();
    this.form.reset({
      googleLink: profile.googleLink,
      resourceLink: profile.resourceLink,
      pricingSheetLink: profile.pricingSheetLink,
      powerPointLink: profile.powerPointLink,
    });
    this.editing.set(false);
  }

  save(): void {
    const { googleLink, resourceLink, pricingSheetLink, powerPointLink } = this.form.getRawValue();

    const repId = Number(this.auth.session()?.repId);
    if (!repId) {
      this.toast.show('Failed to save links');
      return;
    }

    this.saving.set(true);
    const startedAt = Date.now();
    this.directory
      .updateLinksByRepId(repId, {
        googleLink: googleLink.trim(),
        resourceLink: resourceLink.trim(),
        pricingSheetLink: pricingSheetLink.trim(),
        powerPointLink: powerPointLink.trim(),
      })
      .subscribe({
        next: () => {
          this.finishSaving(startedAt, () => {
            this.form.markAsPristine();
            this.editing.set(false);
            this.toast.show('Links saved');
          });
        },
        error: () => {
          this.finishSaving(startedAt, () => this.toast.show('Failed to save links'));
        },
      });
  }

  private finishSaving(startedAt: number, after: () => void): void {
    const remaining = RepLinks.MIN_SAVING_MS - (Date.now() - startedAt);
    setTimeout(() => {
      this.saving.set(false);
      after();
    }, Math.max(remaining, 0));
  }

  private toHref(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }
}