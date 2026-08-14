import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { RepDirectoryStore, RepDocs, RepStatus, SalesRepType, portalLink, repStatusBadge, salesRepTypeLabel } from '../rep-directory-store/rep-directory-store';
import { TrainingResource, TrainingResourceStore, detectFileKind, matchHubSlots, trainingResourceTypeIcon, trainingResourceTypeLabel } from '../training-resource-store/training-resource-store';
import { MediaViewerDialog } from '../media-viewer-dialog/media-viewer-dialog';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { Toast } from '../toast/toast';
import { formatDateMDY } from '../shared/format-date';
import { PHONE_PATTERN, formatPhoneInput } from '../shared/format-phone';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-admin-reps-detials',
  imports: [
    RouterLink, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatProgressSpinnerModule, MatSelectModule, NgTemplateOutlet,
  ],
  templateUrl: './admin-reps-detials.html',
  styleUrl: './admin-reps-detials.scss',
})
export class AdminRepsDetials {
  private readonly fb = inject(FormBuilder);
  private readonly directory = inject(RepDirectoryStore);
  private readonly trainingResourceStore = inject(TrainingResourceStore);
  private readonly toast = inject(Toast);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private loadedForRepId: string | null = null;

  /** Minimum time the view-loading overlay stays up — keeps it from flashing on fast/mocked responses. */
  private static readonly MIN_VIEWING_MS = 200;

  readonly viewing = signal(false);
  readonly deleting = signal(false);

  readonly repId = input.required<string>();

  readonly rep = computed(() => this.directory.findByRepId(this.repId()));
  readonly fullAddress = computed(() => {
    const rep = this.rep();
    if (!rep) return '';
    return [rep.address, rep.city, rep.state, rep.zip].filter(Boolean).join(', ');
  });

  readonly portalLink = portalLink;
  readonly statusBadge = repStatusBadge;
  readonly formatDate = formatDateMDY;
  readonly repTypeLabel = salesRepTypeLabel;

  readonly trainingResources = this.trainingResourceStore.resources;
  readonly adminResources = computed(() => this.trainingResources().filter((r) => r.uploadedBy === 'Admin'));
  readonly ownResources = computed(() => this.trainingResources().filter((r) => r.uploadedBy === 'Rep'));

  /** The same 5 fixed Training & Resource Hub slots admin manages from Settings — read-only here, matched by category so this never shows stale free-form uploads from before that redesign. */
  readonly adminHubSlots = computed(() => matchHubSlots(this.adminResources()));
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

  askDelete(): void {
    const rep = this.rep();
    if (!rep) return;

    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Delete this rep?',
          message: `"${rep.name || rep.repId}" and their records will be permanently removed. This can't be undone.`,
          confirmLabel: 'Delete',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.deleting.set(true);
        this.directory.deleteRep(rep.oId).subscribe({
          next: () => {
            this.toast.show(`Rep ${rep.repId} deleted`);
            this.router.navigateByUrl('/admin/reps');
          },
          error: () => {
            this.deleting.set(false);
            this.toast.show('Failed to delete rep');
          },
        });
      });
  }

  // ----- contact info + address edit -----
  readonly editingContact = signal(false);
  readonly savingContact = signal(false);
  readonly contactForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    businessName: [''],
    email: ['', [Validators.required, Validators.pattern(EMAIL_PATTERN)]],
    phone: ['', Validators.pattern(PHONE_PATTERN)],
    salesRepType: ['referralAgent' as SalesRepType],
    address: [''],
    city: [''],
    state: [''],
    zip: [''],
  });

  /** Reformats the phone field as the admin types — strips non-digits and caps at 10 (`xxx-xxx-xxxx`). */
  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.contactForm.controls.phone.setValue(formatPhoneInput(input.value));
  }

  startEditContact(): void {
    const rep = this.rep();
    if (!rep) return;
    this.contactForm.setValue({
      name: rep.name,
      businessName: rep.businessName,
      email: rep.email,
      phone: rep.phone,
      salesRepType: rep.salesRepType,
      address: rep.address,
      city: rep.city,
      state: rep.state,
      zip: rep.zip,
    });
    this.editingContact.set(true);
  }

  cancelEditContact(): void {
    this.editingContact.set(false);
  }

  saveContact(): void {
    this.contactForm.markAllAsTouched();
    if (this.contactForm.invalid) {
      this.toast.show('Fix the highlighted fields before saving.');
      return;
    }
    const rep = this.rep();
    if (!rep) return;
    const v = this.contactForm.getRawValue();
    this.savingContact.set(true);
    this.directory
      .updateRep(rep.repId, {
        name: v.name.trim(),
        businessName: v.businessName.trim(),
        email: v.email.trim(),
        phone: v.phone.trim(),
        salesRepType: v.salesRepType,
        address: v.address.trim(),
        city: v.city.trim(),
        state: v.state.trim(),
        zip: v.zip.trim(),
      })
      .pipe(finalize(() => this.savingContact.set(false)))
      .subscribe({
        next: () => {
          this.editingContact.set(false);
          this.toast.show('Contact info updated');
        },
        error: () => this.toast.show('Failed to update contact info'),
      });
  }

  // ----- links edit -----
  readonly editingLinks = signal(false);
  readonly savingLinks = signal(false);
  readonly linksForm = this.fb.nonNullable.group({
    googleLink: [''],
    resourceLink: [''],
    pricingSheetLink: [''],
    powerPointLink: [''],
  });

  startEditLinks(): void {
    const rep = this.rep();
    if (!rep) return;
    this.linksForm.setValue({
      googleLink: rep.googleLink,
      resourceLink: rep.resourceLink,
      pricingSheetLink: rep.pricingSheetLink,
      powerPointLink: rep.powerPointLink,
    });
    this.editingLinks.set(true);
  }

  cancelEditLinks(): void {
    this.editingLinks.set(false);
  }

  /** Uses the lightweight `api/reps/link` endpoint rather than the full-record update — it only ever touches these four fields. */
  saveLinks(): void {
    const rep = this.rep();
    if (!rep) return;
    const v = this.linksForm.getRawValue();
    this.savingLinks.set(true);
    this.directory
      .updateLinksByRepId(rep.oId, {
        googleLink: v.googleLink.trim(),
        resourceLink: v.resourceLink.trim(),
        pricingSheetLink: v.pricingSheetLink.trim(),
        powerPointLink: v.powerPointLink.trim(),
      })
      .pipe(finalize(() => this.savingLinks.set(false)))
      .subscribe({
        next: () => {
          this.editingLinks.set(false);
          this.toast.show('Links updated');
        },
        error: () => this.toast.show('Failed to update links'),
      });
  }

  // ----- contract wizard edit (admin-only, Rep Details page only) -----
  readonly editingContractWizard = signal(false);
  readonly savingContractWizard = signal(false);
  readonly contractWizardPasswordVisible = signal(false);
  readonly contractWizardForm = this.fb.nonNullable.group({
    contractWizardLink: [''],
    contractWizardUsername: [''],
    contractWizardPassword: [''],
    contractWizardInstructionsLink: [''],
  });

  toggleContractWizardPasswordVisibility(): void {
    this.contractWizardPasswordVisible.update((visible) => !visible);
  }

  startEditContractWizard(): void {
    const rep = this.rep();
    if (!rep) return;
    this.contractWizardForm.setValue({
      contractWizardLink: rep.contractWizardLink,
      contractWizardUsername: rep.contractWizardUsername,
      contractWizardPassword: rep.contractWizardPassword,
      contractWizardInstructionsLink: rep.contractWizardInstructionsLink,
    });
    this.editingContractWizard.set(true);
  }

  cancelEditContractWizard(): void {
    this.editingContractWizard.set(false);
  }

  saveContractWizard(): void {
    const rep = this.rep();
    if (!rep) return;
    const v = this.contractWizardForm.getRawValue();
    this.savingContractWizard.set(true);
    this.directory
      .updateRep(rep.repId, {
        contractWizardLink: v.contractWizardLink.trim(),
        contractWizardUsername: v.contractWizardUsername.trim(),
        contractWizardPassword: v.contractWizardPassword.trim(),
        contractWizardInstructionsLink: v.contractWizardInstructionsLink.trim(),
      })
      .pipe(finalize(() => this.savingContractWizard.set(false)))
      .subscribe({
        next: () => {
          this.editingContractWizard.set(false);
          this.toast.show('Contract wizard details updated');
        },
        error: () => this.toast.show('Failed to update contract wizard details'),
      });
  }

  // ----- PWR Rewards email edit (admin-only, Rep Details page only) -----
  readonly editingPwrRewards = signal(false);
  readonly savingPwrRewards = signal(false);
  readonly pwrRewardsPasswordVisible = signal(false);
  readonly uploadingPwrInstructions = signal(false);
  readonly pwrRewardsForm = this.fb.nonNullable.group({
    pwrRewardsEmail: ['', Validators.pattern(EMAIL_PATTERN)],
    pwrRewardsEmailPassword: [''],
  });

  togglePwrRewardsPasswordVisibility(): void {
    this.pwrRewardsPasswordVisible.update((visible) => !visible);
  }

  startEditPwrRewards(): void {
    const rep = this.rep();
    if (!rep) return;
    this.pwrRewardsForm.setValue({
      pwrRewardsEmail: rep.pwrRewardsEmail,
      pwrRewardsEmailPassword: rep.pwrRewardsEmailPassword,
    });
    this.editingPwrRewards.set(true);
  }

  cancelEditPwrRewards(): void {
    this.editingPwrRewards.set(false);
  }

  savePwrRewards(): void {
    this.pwrRewardsForm.markAllAsTouched();
    if (this.pwrRewardsForm.invalid) {
      this.toast.show('Enter a valid email address.');
      return;
    }
    const rep = this.rep();
    if (!rep) return;
    const v = this.pwrRewardsForm.getRawValue();
    this.savingPwrRewards.set(true);
    this.directory
      .updateRep(rep.repId, {
        pwrRewardsEmail: v.pwrRewardsEmail.trim(),
        pwrRewardsEmailPassword: v.pwrRewardsEmailPassword.trim(),
      })
      .pipe(finalize(() => this.savingPwrRewards.set(false)))
      .subscribe({
        next: () => {
          this.editingPwrRewards.set(false);
          this.toast.show('PWR Rewards email updated');
        },
        error: () => this.toast.show('Failed to update PWR Rewards email'),
      });
  }

  /** Uploads (or replaces) the PDF the rep downloads to learn how to access their PWR Rewards email — stored via the same generic document slots as agreement/W-4/etc, under the 'pwrInstructions' kind. */
  handlePwrInstructionsUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const rep = this.rep();
    if (!rep) return;

    this.uploadingPwrInstructions.set(true);
    this.directory
      .setDocument(rep.repId, 'pwrInstructions', file)
      .pipe(finalize(() => this.uploadingPwrInstructions.set(false)))
      .subscribe({
        next: () => this.toast.show('Instructions uploaded'),
        error: () => this.toast.show('Failed to upload instructions'),
      });
    input.value = '';
  }

  // ----- agreement/W-4/certification/pricing sheet/PowerPoint uploads (previously only available at rep creation) -----
  private readonly uploadingDocKinds = signal<ReadonlySet<keyof RepDocs>>(new Set());

  isUploadingDoc(kind: keyof RepDocs): boolean {
    return this.uploadingDocKinds().has(kind);
  }

  /** Uploads (or replaces) a document slot — same generic `api/documents` upload the create-rep dialog and rep's own Documents page already use, just triggered from the admin Rep Details page instead. */
  handleDocumentUpload(kind: keyof RepDocs, label: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const rep = this.rep();
    if (!rep) return;

    this.uploadingDocKinds.update((kinds) => new Set(kinds).add(kind));
    this.directory
      .setDocument(rep.repId, kind, file)
      .pipe(
        finalize(() =>
          this.uploadingDocKinds.update((kinds) => {
            const next = new Set(kinds);
            next.delete(kind);
            return next;
          }),
        ),
      )
      .subscribe({
        next: () => this.toast.show(`${label} uploaded`),
        error: () => this.toast.show(`Failed to upload ${label}`),
      });
    input.value = '';
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