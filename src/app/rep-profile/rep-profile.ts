import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Auth } from '../auth/auth';
import { RepProfileStore } from '../rep-profile-store/rep-profile-store';
import { RepDirectoryStore, salesRepTypeLabel } from '../rep-directory-store/rep-directory-store';
import { MediaViewerDialog } from '../media-viewer-dialog/media-viewer-dialog';
import { detectFileKind } from '../training-resource-store/training-resource-store';
import { formatDateMDY } from '../shared/format-date';
import { Toast } from '../toast/toast';

interface ProfileRow {
  key: string;
  label: string;
  value: string;
  wide: boolean;
  isLink?: boolean;
}

interface CertificationRow {
  key: string;
  label: string;
  passed: boolean;
}

@Component({
  selector: 'app-rep-profile',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './rep-profile.html',
  styleUrl: './rep-profile.scss',
})
export class RepProfile {
  private readonly auth = inject(Auth);
  private readonly repProfileStore = inject(RepProfileStore);
  private readonly directory = inject(RepDirectoryStore);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(Toast);
  private loadedForRepId: string | null = null;

  /** Minimum time the view-loading overlay stays up — keeps it from flashing on fast/mocked responses. */
  private static readonly MIN_VIEWING_MS = 200;

  readonly viewing = signal(false);
  readonly formatDate = formatDateMDY;

  constructor() {
    // Docs live in RepDirectoryStore's in-memory list, keyed by rep — fetch them once the
    // signed-in rep is actually present in that list (it loads asynchronously on app start).
    // Needed here (not just on the Documents page) so the PWR Rewards instructions PDF status
    // shows correctly even if the rep never visits Documents.
    effect(() => {
      const repId = this.auth.session()?.repId;
      if (!repId || repId === this.loadedForRepId) return;
      if (!this.directory.findByRepId(repId)) return;
      this.loadedForRepId = repId;
      this.directory.loadDocuments(repId).subscribe();
    });
  }

  readonly rows = computed<ProfileRow[]>(() => {
    const p = this.repProfileStore.profile();
    const email = this.auth.session()?.email ?? '';
    return [
      { key: 'name', label: 'Full name', value: p.name, wide: false },
      { key: 'businessName', label: 'Business name', value: p.businessName, wide: false },
      { key: 'email', label: 'Email', value: email, wide: false },
      { key: 'phone', label: 'Phone', value: p.phone, wide: false },
      { key: 'salesRepType', label: 'Sales rep type', value: salesRepTypeLabel(p.salesRepType), wide: false },
      { key: 'address', label: 'Address', value: p.address, wide: true },
      { key: 'city', label: 'City', value: p.city, wide: false },
      { key: 'state', label: 'State', value: p.state, wide: false },
      { key: 'zip', label: 'Zip', value: p.zip, wide: false },
    ];
  });

  readonly certificationRows = computed<CertificationRow[]>(() => {
    const p = this.repProfileStore.profile();
    return [
      { key: 'passedCertification', label: 'Passed certification', passed: p.passedCertification },
      { key: 'businessCardsSent', label: 'Business cards sent', passed: p.businessCardsSent },
      { key: 'consultantFeePaid', label: 'Consultant fee paid', passed: p.consultantFeePaid },
    ];
  });

  readonly isMarketingConsultant = computed(() => this.repProfileStore.profile().salesRepType === 'marketingConsultant');
  readonly pwrRewardsRows = computed<ProfileRow[]>(() => {
    const p = this.repProfileStore.profile();
    return [
      { key: 'pwrRewardsEmail', label: 'PWR Rewards email', value: p.pwrRewardsEmail, wide: false },
      { key: 'pwrRewardsEmailPassword', label: 'Password', value: p.pwrRewardsEmailPassword, wide: false },
    ];
  });
  readonly pwrInstructions = computed(() => this.repProfileStore.profile().docs.pwrInstructions);

  /** Set by admin from the Rep Details page — always shown here read-only, same as the rest of the profile. */
  readonly contractWizardRows = computed<ProfileRow[]>(() => {
    const p = this.repProfileStore.profile();
    return [
      { key: 'contractWizardLink', label: 'Link to contract wizard', value: p.contractWizardLink, wide: true, isLink: true },
      { key: 'contractWizardUsername', label: 'Username', value: p.contractWizardUsername, wide: false },
      { key: 'contractWizardPassword', label: 'Password', value: p.contractWizardPassword, wide: false },
      { key: 'contractWizardInstructionsLink', label: 'Wizard instructions', value: p.contractWizardInstructionsLink, wide: true, isLink: true },
    ];
  });

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
      error: () => this.toast.show('Failed to download instructions'),
    });
  }

  /** Opens the instructions PDF in the in-app viewer instead of forcing a download. */
  viewDocument(oId: number, fileName: string): void {
    this.viewing.set(true);
    const startedAt = Date.now();
    this.directory.downloadDocument(oId).subscribe({
      next: (blob) => {
        this.stopViewing(startedAt, () => {
          if (this.dialog.openDialogs.length) return;
          const url = URL.createObjectURL(blob);
          this.dialog
            .open(MediaViewerDialog, {
              data: { title: 'Access instructions', type: detectFileKind(fileName), url, fileName },
              maxWidth: '90vw',
              panelClass: 'media-viewer-panel',
            })
            .afterClosed()
            .subscribe(() => URL.revokeObjectURL(url));
        });
      },
      error: () => this.stopViewing(startedAt, () => this.toast.show('Failed to open instructions')),
    });
  }

  /** Keeps the loading overlay up for at least MIN_VIEWING_MS so it doesn't flash on fast/mocked responses. */
  private stopViewing(startedAt: number, after: () => void): void {
    const remaining = RepProfile.MIN_VIEWING_MS - (Date.now() - startedAt);
    setTimeout(() => {
      this.viewing.set(false);
      after();
    }, Math.max(remaining, 0));
  }
}