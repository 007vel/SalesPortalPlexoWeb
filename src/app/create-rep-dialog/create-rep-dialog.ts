import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import { RepDirectoryStore, RepRecord, RepStatus } from '../rep-directory-store/rep-directory-store';
import { Toast } from '../toast/toast';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-create-rep-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './create-rep-dialog.html',
  styleUrl: './create-rep-dialog.scss',
})
export class CreateRepDialog {
  private readonly fb = inject(FormBuilder);
  private readonly directory = inject(RepDirectoryStore);
  private readonly dialogRef = inject(MatDialogRef<CreateRepDialog, RepRecord | undefined>);
  private readonly toast = inject(Toast);

  readonly form = this.fb.nonNullable.group({
    name: [''],
    email: [''],
    phone: [''],
    address: [''],
    city: [''],
    state: [''],
    zip: [''],
    status: ['pending' as RepStatus],
  });

  readonly missingRequiredFields = { name: false, email: false };
  readonly invalidEmail = signal(false);
  readonly submitting = signal(false);
  readonly submitFailed = signal(false);

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  submit(): void {
    if (this.submitting()) return;

    const v = this.form.getRawValue();
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

    this.submitFailed.set(false);
    this.submitting.set(true);
    this.directory
      .createRep({
        name,
        email,
        phone: v.phone.trim(),
        address: v.address.trim(),
        city: v.city.trim(),
        state: v.state.trim(),
        zip: v.zip.trim(),
        status: v.status,
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (rep) => this.dialogRef.close(rep),
        error: (err: HttpErrorResponse) => {
          if (err.status === 409) {
            this.toast.show(typeof err.error === 'string' ? err.error : `Email '${email}' is already in use.`);
            return;
          }
          this.submitFailed.set(true);
        },
      });
  }
}
