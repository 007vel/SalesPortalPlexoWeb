import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { BusinessCardStatus, RepDirectoryStore, RepDocs, RepStatus, SalesRepType, businessCardStatusBadge, portalLink, repStatusBadge, salesRepTypeLabel } from '../rep-directory-store/rep-directory-store';
import { TrainingResource, TrainingResourceStore, detectFileKind, matchHubSlots, trainingResourceTypeIcon, trainingResourceTypeLabel } from '../training-resource-store/training-resource-store';
import { TrainingHubLinksStore, videoLinkRows } from '../training-hub-links-store/training-hub-links-store';
import { MediaViewerDialog } from '../media-viewer-dialog/media-viewer-dialog';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { Toast } from '../toast/toast';
import { formatDateMDY } from '../shared/format-date';
import { maskAccountNumber } from '../shared/mask-account-number';
import { PHONE_PATTERN, formatPhoneInput } from '../shared/format-phone';
import { extractYouTubeId, youTubeThumbnailUrl } from '../shared/youtube';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-admin-reps-detials',
  imports: [
    RouterLink, ReactiveFormsModule, MatButtonModule, MatButtonToggleModule, MatCardModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatProgressSpinnerModule, MatSelectModule, MatSlideToggleModule, NgTemplateOutlet,
  ],
  templateUrl: './admin-reps-detials.html',
  styleUrl: './admin-reps-detials.scss',
})
export class AdminRepsDetials {
  private readonly fb = inject(FormBuilder);
  private readonly directory = inject(RepDirectoryStore);
  private readonly trainingResourceStore = inject(TrainingResourceStore);
  private readonly trainingHubLinksStore = inject(TrainingHubLinksStore);
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
  readonly cardStatusBadge = businessCardStatusBadge;
  readonly formatDate = formatDateMDY;
  readonly maskAccountNumber = maskAccountNumber;
  readonly repTypeLabel = salesRepTypeLabel;

  readonly trainingResources = this.trainingResourceStore.resources;
  readonly adminResources = computed(() => this.trainingResources().filter((r) => r.uploadedBy === 'Admin'));
  readonly ownResources = computed(() => this.trainingResources().filter((r) => r.uploadedBy === 'Rep'));

  /** The same fixed Training & Resource Hub slots admin manages from Settings — read-only here, matched by category so this never shows stale free-form uploads from before that redesign. */
  readonly adminHubSlots = computed(() => matchHubSlots(this.adminResources()));
  /** The 4 product/dashboard videos — plain YouTube links, not uploaded files, so they open in the media viewer dialog. */
  readonly videoRows = computed(() => {
    const links = this.trainingHubLinksStore.links();
    return links ? videoLinkRows(links) : [];
  });
  readonly ownResourcesEnglish = computed(() => this.ownResources().filter((r) => r.language === 'English'));
  readonly ownResourcesSpanish = computed(() => this.ownResources().filter((r) => r.language === 'Spanish'));
  readonly typeIcon = trainingResourceTypeIcon;
  readonly typeLabel = trainingResourceTypeLabel;

  openVideoLink(url: string, title: string): void {
    if (this.dialog.openDialogs.length) return;
    this.dialog.open(MediaViewerDialog, {
      data: { title, type: 'youtube', url, fileName: title },
      maxWidth: '90vw',
      panelClass: 'media-viewer-panel',
    });
  }

  /** The thumbnail shown under each video row, kept visible at all times rather than just inside the viewer dialog. */
  youtubeThumbnail(url: string): string | null {
    const id = extractYouTubeId(url);
    return id ? youTubeThumbnailUrl(id) : null;
  }

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
    this.trainingHubLinksStore.load().subscribe();
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
    if (this.dialog.openDialogs.length) return;

    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Delete this rep?',
          message: `Are you sure you want to delete?`,
          confirmLabel: 'Delete',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.deleting.set(true);
        this.directory.deleteRep(rep.oId).subscribe({
          next: () => {
            this.toast.show(`"${rep.name || rep.repId}" deleted`);
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
      .updateLinksByRepId(Number(rep.repId), {
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

  // ----- certification edit -----
  readonly editingCertification = signal(false);
  readonly savingCertification = signal(false);
  readonly certificationForm = this.fb.nonNullable.group({
    passedCertification: [false],
    businessCardStatus: ['notSent' as BusinessCardStatus],
    consultantFeePaid: [false],
  });

  startEditCertification(): void {
    const rep = this.rep();
    if (!rep) return;
    this.certificationForm.setValue({
      passedCertification: rep.passedCertification,
      businessCardStatus: rep.businessCardStatus,
      consultantFeePaid: rep.consultantFeePaid,
    });
    this.editingCertification.set(true);
  }

  cancelEditCertification(): void {
    this.editingCertification.set(false);
  }

  saveCertification(): void {
    const rep = this.rep();
    if (!rep) return;
    const v = this.certificationForm.getRawValue();
    this.savingCertification.set(true);
    this.directory
      .updateRep(rep.repId, {
        passedCertification: v.passedCertification,
        businessCardStatus: v.businessCardStatus,
        consultantFeePaid: v.consultantFeePaid,
      })
      .pipe(finalize(() => this.savingCertification.set(false)))
      .subscribe({
        next: () => {
          this.editingCertification.set(false);
          this.toast.show('Certification updated');
        },
        error: () => this.toast.show('Failed to update certification'),
      });
  }

  // ----- bank details edit -----
  readonly editingBankDetails = signal(false);
  readonly savingBankDetails = signal(false);
  readonly bankAccountNumberVisible = signal(false);
  readonly bankDetailsForm = this.fb.nonNullable.group({
    bankName: [''],
    routingNumber: [''],
    accountNumber: [''],
  });

  toggleBankAccountNumberVisibility(): void {
    this.bankAccountNumberVisible.update((visible) => !visible);
  }

  startEditBankDetails(): void {
    const rep = this.rep();
    if (!rep) return;
    const bank = rep.bankDetails;
    this.bankDetailsForm.setValue({
      bankName: bank?.bankName ?? '',
      routingNumber: bank?.routingNumber ?? '',
      accountNumber: bank?.accountNumber ?? '',
    });
    this.editingBankDetails.set(true);
  }

  cancelEditBankDetails(): void {
    this.editingBankDetails.set(false);
  }

  /** setBankDetails() doesn't update the local store itself, so the follow-up loadBankDetails() call is what actually refreshes rep.bankDetails for the read-only view. */
  saveBankDetails(): void {
    const rep = this.rep();
    if (!rep) return;
    const v = this.bankDetailsForm.getRawValue();
    this.savingBankDetails.set(true);
    this.directory
      .setBankDetails(rep.repId, {
        bankName: v.bankName.trim(),
        routingNumber: v.routingNumber.trim(),
        accountNumber: v.accountNumber.trim(),
      })
      .pipe(
        switchMap(() => this.directory.loadBankDetails(rep.repId)),
        finalize(() => this.savingBankDetails.set(false)),
      )
      .subscribe({
        next: () => {
          this.editingBankDetails.set(false);
          this.toast.show('Bank details updated');
        },
        error: () => this.toast.show('Failed to update bank details'),
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

  // ----- PWR Rewards email edit (its own card/form, separate from Contact information) + instructions PDF dropzone (drag/drop mirrors the create-rep dialog's upload UI) -----
  readonly editingPwrRewards = signal(false);
  readonly savingPwrRewards = signal(false);
  readonly pwrRewardsPasswordVisible = signal(false);
  readonly uploadingPwrInstructions = signal(false);
  readonly pwrInstructionsDragActive = signal(false);
  readonly pwrRewardsForm = this.fb.nonNullable.group({
    pwrRewardsEmail: ['', Validators.pattern(EMAIL_PATTERN)],
    pwrRewardsEmailPassword: [''],
  });

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
      this.toast.show('Fix the highlighted fields before saving.');
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

  togglePwrRewardsPasswordVisibility(): void {
    this.pwrRewardsPasswordVisible.update((visible) => !visible);
  }

  /** Ignores clicks while an upload for this slot is already in flight, so a slow request can't be fired twice. */
  triggerPwrInstructionsUpload(input: HTMLInputElement): void {
    if (this.uploadingPwrInstructions()) return;
    input.click();
  }

  onPwrInstructionsDragOver(event: DragEvent): void {
    event.preventDefault();
    this.pwrInstructionsDragActive.set(true);
  }

  onPwrInstructionsDragLeave(): void {
    this.pwrInstructionsDragActive.set(false);
  }

  onPwrInstructionsDrop(event: DragEvent): void {
    event.preventDefault();
    this.pwrInstructionsDragActive.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.uploadPwrInstructions(file);
  }

  handlePwrInstructionsUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.uploadPwrInstructions(file);
    input.value = '';
  }

  /** Uploads (or replaces) the PDF the rep downloads to learn how to access their PWR Rewards email — stored via the same generic document slots as agreement/W-4/etc, under the 'pwrInstructions' kind. */
  private uploadPwrInstructions(file: File): void {
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
  }

  // ----- agreement/W-4/certification/pricing sheet/PowerPoint uploads (previously only available at rep creation) -----
  private readonly uploadingDocKinds = signal<ReadonlySet<keyof RepDocs>>(new Set());

  isUploadingDoc(kind: keyof RepDocs): boolean {
    return this.uploadingDocKinds().has(kind);
  }

  handleDocumentUpload(kind: keyof RepDocs, label: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.uploadDocument(kind, label, file);
    input.value = '';
  }

  // ----- document delete (Passed Certificate + PWR Rewards access instructions dropzones) -----
  private readonly deletingDocKinds = signal<ReadonlySet<keyof RepDocs>>(new Set());

  isDeletingDoc(kind: keyof RepDocs): boolean {
    return this.deletingDocKinds().has(kind);
  }

  askDeleteDocument(kind: keyof RepDocs, label: string): void {
    const rep = this.rep();
    if (!rep || !rep.docs[kind]) return;
    if (this.dialog.openDialogs.length) return;

    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Delete ${label}?`,
          message: `This removes the uploaded ${label.toLowerCase()} file. This can't be undone.`,
          confirmLabel: 'Delete',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.deletingDocKinds.update((kinds) => new Set(kinds).add(kind));
        this.directory
          .deleteDocument(rep.repId, kind)
          .pipe(
            finalize(() =>
              this.deletingDocKinds.update((kinds) => {
                const next = new Set(kinds);
                next.delete(kind);
                return next;
              }),
            ),
          )
          .subscribe({
            next: () => this.toast.show(`${label} deleted`),
            error: () => this.toast.show(`Failed to delete ${label}`),
          });
      });
  }

  // ----- Passed Certificate dropzone (drag/drop mirrors the create-rep dialog's upload UI) -----
  readonly certDragActive = signal(false);

  /** Ignores clicks while an upload for this slot is already in flight, so a slow request can't be fired twice. */
  triggerCertificateUpload(input: HTMLInputElement): void {
    if (this.isUploadingDoc('certification')) return;
    input.click();
  }

  onCertDragOver(event: DragEvent): void {
    event.preventDefault();
    this.certDragActive.set(true);
  }

  onCertDragLeave(): void {
    this.certDragActive.set(false);
  }

  onCertDrop(event: DragEvent): void {
    event.preventDefault();
    this.certDragActive.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.uploadDocument('certification', 'Passed Certificate', file);
  }

  // ----- Business cards dropzone (drag/drop mirrors the Passed Certificate dropzone above) -----
  readonly businessCardsDragActive = signal(false);

  /** Ignores clicks while an upload for this slot is already in flight, so a slow request can't be fired twice. */
  triggerBusinessCardsUpload(input: HTMLInputElement): void {
    if (this.isUploadingDoc('businessCards')) return;
    input.click();
  }

  onBusinessCardsDragOver(event: DragEvent): void {
    event.preventDefault();
    this.businessCardsDragActive.set(true);
  }

  onBusinessCardsDragLeave(): void {
    this.businessCardsDragActive.set(false);
  }

  onBusinessCardsDrop(event: DragEvent): void {
    event.preventDefault();
    this.businessCardsDragActive.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.uploadDocument('businessCards', 'Business Cards', file);
  }

  /** Uploads (or replaces) a document slot — same generic `api/documents` upload the create-rep dialog and rep's own Documents page already use, just triggered from the admin Rep Details page instead. */
  private uploadDocument(kind: keyof RepDocs, label: string, file: File): void {
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
        next: () => {
          this.toast.show(`${label} uploaded`);
          // A fresh sample always needs fresh review, regardless of whatever status it was in before.
          if (kind === 'businessCards') {
            this.directory.updateRep(rep.repId, { businessCardStatus: 'waitingApproval' }).subscribe();
          }
        },
        error: () => this.toast.show(`Failed to upload ${label}`),
      });
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
    if (this.dialog.openDialogs.length) return;
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