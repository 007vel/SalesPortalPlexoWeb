import { HttpErrorResponse } from '@angular/common/http';
import { Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { Observable, catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { RepDirectoryStore, RepRecord, RepStatus, SalesRepType } from '../rep-directory-store/rep-directory-store';
import { Toast } from '../toast/toast';
import { PHONE_PATTERN, formatPhoneInput } from '../shared/format-phone';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type DocSlotKind = 'pricingSheet' | 'powerPoint';

interface DocSlot {
  file: WritableSignal<File | null>;
  name: WritableSignal<string | null>;
  size: WritableSignal<number | null>;
  drag: WritableSignal<boolean>;
}

function fileSizeLabel(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileKindIcon(name: string | null): string {
  return name?.toLowerCase().endsWith('.pdf') ? 'picture_as_pdf' : 'image';
}

/** certForm-level validator: a passed-certification claim needs the certificate file attached. */
function certificateRequiredWhenPassedValidator(group: AbstractControl): ValidationErrors | null {
  const passed = group.get('passedCertification')?.value;
  const file = group.get('certificateFile')?.value;
  return passed && !file ? { certificateRequired: true } : null;
}

@Component({
  selector: 'app-create-rep-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatStepperModule,
  ],
  templateUrl: './create-rep-dialog.html',
  styleUrl: './create-rep-dialog.scss',
})
export class CreateRepDialog {
  private readonly fb = inject(FormBuilder);
  private readonly directory = inject(RepDirectoryStore);
  private readonly dialogRef = inject(MatDialogRef<CreateRepDialog, RepRecord | undefined>);
  private readonly toast = inject(Toast);

  // ----- step 1: profile -----
  // name/email carry real Validators so `stepControl.invalid` is accurate — the linear
  // stepper relies on that to block a direct header-click into a later, incomplete step.
  readonly infoForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    businessName: [''],
    email: ['', [Validators.required, Validators.pattern(EMAIL_PATTERN)]],
    phone: ['', Validators.pattern(PHONE_PATTERN)],
    salesRepType: ['referralAgent' as SalesRepType],
    status: ['pending' as RepStatus],
  });

  // ----- step 2: address (its own step — kept separate from the rest of the profile fields) -----
  readonly addressForm = this.fb.nonNullable.group({
    address: [''],
    city: [''],
    state: [''],
    zip: [''],
  });

  // Labels for the mobile compact step indicator — order matches the mat-step
  // sequence in the template, since a narrow screen has no room for the
  // full horizontal stepper header (5 icon+label pairs).
  readonly stepTitles = ['Profile', 'Address', 'Certification', 'Bank details', 'Links & Documents'];

  readonly missingRequiredFields = { name: false, email: false };
  readonly invalidEmail = signal(false);
  readonly invalidPhone = signal(false);

  /** Reformats the phone field as the rep types — strips non-digits and caps at 10 (`xxx-xxx-xxxx`). */
  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.infoForm.controls.phone.setValue(formatPhoneInput(input.value));
  }

  // ----- step 3: certification -----
  // certificateFile lives on the form (not a plain class field) so the group's own validity
  // — and therefore the linear stepper's header-click guard — reacts to it being set/cleared.
  readonly certForm = this.fb.nonNullable.group(
    {
      passedCertification: [false],
      businessCardsSent: [false],
      consultantFeePaid: [false],
      certificateFile: [null as File | null],
    },
    { validators: certificateRequiredWhenPassedValidator },
  );

  readonly certificateFileName = signal<string | null>(null);
  readonly certificateFileSize = signal<number | null>(null);
  readonly missingCertificateFile = signal(false);
  readonly certDragActive = signal(false);

  readonly certificateFileIcon = computed(() => fileKindIcon(this.certificateFileName()));
  readonly certificateFileSizeLabel = computed(() => fileSizeLabel(this.certificateFileSize()));

  // ----- step 4: bank details -----
  readonly bankForm = this.fb.nonNullable.group({
    bankName: ['', Validators.required],
    routingNumber: ['', Validators.required],
    accountNumber: ['', Validators.required],
  });

  readonly missingBankFields = { bankName: false, routingNumber: false, accountNumber: false };
  readonly accountNumberVisible = signal(false);

  toggleAccountNumberVisibility(): void {
    this.accountNumberVisible.update((visible) => !visible);
  }

  // ----- step 5: links & documents (all optional — admin can fill these in later via the rep's own Links/Documents pages) -----
  readonly linksForm = this.fb.nonNullable.group({
    googleLink: [''],
    resourceLink: [''],
    pricingSheetLink: [''],
    powerPointLink: [''],
  });

  private readonly docSlots: Record<DocSlotKind, DocSlot> = {
    pricingSheet: { file: signal(null), name: signal(null), size: signal(null), drag: signal(false) },
    powerPoint: { file: signal(null), name: signal(null), size: signal(null), drag: signal(false) },
  };

  readonly pricingSheetFileName = this.docSlots.pricingSheet.name.asReadonly();
  readonly pricingSheetDragActive = this.docSlots.pricingSheet.drag.asReadonly();
  readonly pricingSheetFileIcon = computed(() => fileKindIcon(this.pricingSheetFileName()));
  readonly pricingSheetFileSizeLabel = computed(() => fileSizeLabel(this.docSlots.pricingSheet.size()));

  readonly powerPointFileName = this.docSlots.powerPoint.name.asReadonly();
  readonly powerPointDragActive = this.docSlots.powerPoint.drag.asReadonly();
  readonly powerPointFileIcon = computed(() => fileKindIcon(this.powerPointFileName()));
  readonly powerPointFileSizeLabel = computed(() => fileSizeLabel(this.docSlots.powerPoint.size()));

  readonly submitting = signal(false);
  readonly submitFailed = signal(false);

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  /**
   * Angular CDK's horizontal stepper sometimes computes the newly-active step's slide
   * transform against a stale layout measurement right as it becomes visible, leaving its
   * content shifted sideways and clipped by the dialog's own overflow (verified: the
   * certification toggles were rendering ~150px past the visible edge). A later reflow —
   * e.g. a resize event — makes the CDK recompute correctly, so trigger one after every
   * step change (Next, Back, or a header click) once the DOM has settled.
   */
  onStepChange(): void {
    // Two nudges: one for the common case, and a second after Material's own step
    // slide transition (~225-400ms) has actually finished settling, since the first
    // can otherwise land mid-animation and miss.
    window.dispatchEvent(new Event('resize'));
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 400);
  }

  goToStep2(stepper: MatStepper): void {
    this.infoForm.markAllAsTouched();
    const v = this.infoForm.getRawValue();
    const name = v.name.trim();
    const email = v.email.trim();
    const phone = v.phone.trim();
    this.missingRequiredFields.name = !name;
    this.missingRequiredFields.email = !email;
    this.invalidEmail.set(!!email && !EMAIL_PATTERN.test(email));
    this.invalidPhone.set(!!phone && !PHONE_PATTERN.test(phone));

    if (!name || !email) {
      this.toast.show('Name and email are required.');
      return;
    }
    if (this.invalidEmail()) {
      this.toast.show('Enter a valid email address.');
      return;
    }
    if (this.invalidPhone()) {
      this.toast.show('Enter a complete 10-digit phone number.');
      return;
    }
    stepper.next();
  }

  // Address fields are all optional — nothing to validate before moving on.
  goToStep3(stepper: MatStepper): void {
    stepper.next();
  }

  handleCertificateFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.setCertificateFile(file);
    input.value = '';
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
    if (file) this.setCertificateFile(file);
  }

  clearCertificateFile(event: Event): void {
    event.stopPropagation();
    this.certForm.controls.certificateFile.setValue(null);
    this.certificateFileName.set(null);
    this.certificateFileSize.set(null);
  }

  private setCertificateFile(file: File): void {
    this.certForm.controls.certificateFile.setValue(file);
    this.certificateFileName.set(file.name);
    this.certificateFileSize.set(file.size);
    this.missingCertificateFile.set(false);
  }

  goToStep4(stepper: MatStepper): void {
    const passedCertification = this.certForm.controls.passedCertification.value;
    if (passedCertification && !this.certForm.controls.certificateFile.value) {
      this.missingCertificateFile.set(true);
      this.toast.show('Upload the passed certificate, or turn the toggle off.');
      return;
    }
    stepper.next();
  }

  goToStep5(stepper: MatStepper): void {
    this.bankForm.markAllAsTouched();
    const bank = this.bankForm.getRawValue();
    const bankName = bank.bankName.trim();
    const routingNumber = bank.routingNumber.trim();
    const accountNumber = bank.accountNumber.trim();
    this.missingBankFields.bankName = !bankName;
    this.missingBankFields.routingNumber = !routingNumber;
    this.missingBankFields.accountNumber = !accountNumber;

    if (!bankName || !routingNumber || !accountNumber) {
      this.toast.show('Bank name, routing number, and account number are required.');
      return;
    }
    stepper.next();
  }

  handleDocFile(kind: DocSlotKind, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.setDocFile(kind, file);
    input.value = '';
  }

  onDocDragOver(kind: DocSlotKind, event: DragEvent): void {
    event.preventDefault();
    this.docSlots[kind].drag.set(true);
  }

  onDocDragLeave(kind: DocSlotKind): void {
    this.docSlots[kind].drag.set(false);
  }

  onDocDrop(kind: DocSlotKind, event: DragEvent): void {
    event.preventDefault();
    this.docSlots[kind].drag.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.setDocFile(kind, file);
  }

  clearDocFile(kind: DocSlotKind, event: Event): void {
    event.stopPropagation();
    this.docSlots[kind].file.set(null);
    this.docSlots[kind].name.set(null);
    this.docSlots[kind].size.set(null);
  }

  private setDocFile(kind: DocSlotKind, file: File): void {
    this.docSlots[kind].file.set(file);
    this.docSlots[kind].name.set(file.name);
    this.docSlots[kind].size.set(file.size);
  }

  submit(): void {
    if (this.submitting()) return;

    const bank = this.bankForm.getRawValue();
    const bankName = bank.bankName.trim();
    const routingNumber = bank.routingNumber.trim();
    const accountNumber = bank.accountNumber.trim();

    const info = this.infoForm.getRawValue();
    const address = this.addressForm.getRawValue();
    const cert = this.certForm.getRawValue();
    const certificateFile = cert.certificateFile;
    const links = this.linksForm.getRawValue();
    const pricingSheetFile = this.docSlots.pricingSheet.file();
    const powerPointFile = this.docSlots.powerPoint.file();

    this.submitFailed.set(false);
    this.submitting.set(true);

    this.directory
      .createRep({
        name: info.name.trim(),
        businessName: info.businessName.trim(),
        email: info.email.trim(),
        phone: info.phone.trim(),
        salesRepType: info.salesRepType,
        address: address.address.trim(),
        city: address.city.trim(),
        state: address.state.trim(),
        zip: address.zip.trim(),
        status: info.status,
        passedCertification: cert.passedCertification,
        businessCardsSent: cert.businessCardsSent,
        consultantFeePaid: cert.consultantFeePaid,
        googleLink: links.googleLink.trim(),
        resourceLink: links.resourceLink.trim(),
        pricingSheetLink: links.pricingSheetLink.trim(),
        powerPointLink: links.powerPointLink.trim(),
      })
      .pipe(
        switchMap((rep) => {
          const followUps: Observable<unknown>[] = [
            this.directory.setBankDetails(rep.repId, { bankName, routingNumber, accountNumber }),
          ];
          if (cert.passedCertification && certificateFile) {
            followUps.push(this.directory.setDocument(rep.repId, 'certification', certificateFile));
          }
          if (pricingSheetFile) {
            followUps.push(this.directory.setDocument(rep.repId, 'pricingSheet', pricingSheetFile));
          }
          if (powerPointFile) {
            followUps.push(this.directory.setDocument(rep.repId, 'powerPoint', powerPointFile));
          }
          return forkJoin(followUps).pipe(
            map(() => rep),
            catchError(() => {
              this.toast.show(`Rep ${rep.repId} was created, but saving some follow-up details failed — edit the rep to retry.`);
              return of(rep);
            }),
          );
        }),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe({
        next: (rep) => this.dialogRef.close(rep),
        error: (err: HttpErrorResponse) => {
          if (err.status === 409) {
            this.toast.show(typeof err.error === 'string' ? err.error : `Email '${info.email}' is already in use.`);
            return;
          }
          this.submitFailed.set(true);
        },
      });
  }
}
