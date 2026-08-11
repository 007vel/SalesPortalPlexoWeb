import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { Observable, catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { RepDirectoryStore, RepRecord, RepStatus } from '../rep-directory-store/rep-directory-store';
import { Toast } from '../toast/toast';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    email: ['', [Validators.required, Validators.pattern(EMAIL_PATTERN)]],
    phone: [''],
    address: [''],
    city: [''],
    state: [''],
    zip: [''],
    status: ['pending' as RepStatus],
  });

  readonly missingRequiredFields = { name: false, email: false };
  readonly invalidEmail = signal(false);

  // ----- step 2: certification -----
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

  readonly certificateFileIcon = computed(() => {
    const name = this.certificateFileName();
    return name?.toLowerCase().endsWith('.pdf') ? 'picture_as_pdf' : 'image';
  });

  readonly certificateFileSizeLabel = computed(() => {
    const bytes = this.certificateFileSize();
    if (bytes === null) return '';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  });

  // ----- step 3: bank details -----
  readonly bankForm = this.fb.nonNullable.group({
    bankName: ['', Validators.required],
    routingNumber: ['', Validators.required],
    accountNumber: ['', Validators.required],
  });

  readonly missingBankFields = { bankName: false, routingNumber: false, accountNumber: false };

  readonly submitting = signal(false);
  readonly submitFailed = signal(false);

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  goToStep2(stepper: MatStepper): void {
    const v = this.infoForm.getRawValue();
    const name = v.name.trim();
    const email = v.email.trim();
    this.missingRequiredFields.name = !name;
    this.missingRequiredFields.email = !email;
    this.invalidEmail.set(!!email && !EMAIL_PATTERN.test(email));

    if (!name || !email) {
      this.toast.show('Name and email are required.');
      return;
    }
    if (this.invalidEmail()) {
      this.toast.show('Enter a valid email address.');
      return;
    }
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

  goToStep3(stepper: MatStepper): void {
    const passedCertification = this.certForm.controls.passedCertification.value;
    if (passedCertification && !this.certForm.controls.certificateFile.value) {
      this.missingCertificateFile.set(true);
      this.toast.show('Upload the passed certificate, or turn the toggle off.');
      return;
    }
    stepper.next();
  }

  submit(): void {
    if (this.submitting()) return;

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

    const info = this.infoForm.getRawValue();
    const cert = this.certForm.getRawValue();
    const certificateFile = cert.certificateFile;

    this.submitFailed.set(false);
    this.submitting.set(true);

    this.directory
      .createRep({
        name: info.name.trim(),
        email: info.email.trim(),
        phone: info.phone.trim(),
        address: info.address.trim(),
        city: info.city.trim(),
        state: info.state.trim(),
        zip: info.zip.trim(),
        status: info.status,
        passedCertification: cert.passedCertification,
        businessCardsSent: cert.businessCardsSent,
        consultantFeePaid: cert.consultantFeePaid,
      })
      .pipe(
        switchMap((rep) => {
          const followUps: Observable<unknown>[] = [
            this.directory.setBankDetails(rep.repId, { bankName, routingNumber, accountNumber }),
          ];
          if (cert.passedCertification && certificateFile) {
            followUps.push(this.directory.setDocument(rep.repId, 'certification', certificateFile));
          }
          return forkJoin(followUps).pipe(
            map(() => rep),
            catchError(() => {
              this.toast.show(`Rep ${rep.repId} was created, but saving bank details/certificate failed — edit the rep to retry.`);
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
