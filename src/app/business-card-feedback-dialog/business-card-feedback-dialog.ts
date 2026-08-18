import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Api } from '../api/api';
import { Auth } from '../auth/auth';

@Component({
  selector: 'app-business-card-feedback-dialog',
  imports: [
    ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './business-card-feedback-dialog.html',
  styleUrl: './business-card-feedback-dialog.scss',
})
export class BusinessCardFeedbackDialog {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(Api);
  private readonly auth = inject(Auth);
  private readonly dialogRef = inject(MatDialogRef<BusinessCardFeedbackDialog, boolean>);

  readonly sending = signal(false);
  readonly sendFailed = signal(false);

  readonly form = this.fb.nonNullable.group({
    repId: [this.auth.session()?.repId ?? '', [Validators.required]],
    email: [this.auth.session()?.email ?? '', [Validators.required, Validators.email]],
    notes: ['', [Validators.required]],
  });

  cancel(): void {
    this.dialogRef.close(false);
  }

  send(): void {
    if (this.form.invalid || this.sending()) {
      this.form.markAllAsTouched();
      return;
    }

    this.sendFailed.set(false);
    this.sending.set(true);

    const { repId, email, notes } = this.form.getRawValue();
    // The backend endpoint only takes email + message — Rep ID rides along inline in the body,
    // same as rep-contact-us.ts already does with the rep's name, rather than requiring a schema
    // change purely for this dialog's convenience.
    const body = `Business card feedback from Rep ${repId.trim()}:\n\n${notes.trim()}`;

    this.api.post('support/contact-admin', { email: email.trim(), message: body }).subscribe({
      next: () => this.dialogRef.close(true),
      error: () => {
        this.sending.set(false);
        this.sendFailed.set(true);
      },
    });
  }
}
