import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Api } from '../api/api';

@Component({
  selector: 'app-ask-admin-dialog',
  imports: [
    ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './ask-admin-dialog.html',
  styleUrl: './ask-admin-dialog.scss',
})
export class AskAdminDialog {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(Api);
  private readonly dialogRef = inject(MatDialogRef<AskAdminDialog, boolean>);

  readonly sending = signal(false);
  readonly sendFailed = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    message: ['', [Validators.required]],
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

    const { email, message } = this.form.getRawValue();
    this.api.post('support/ask-admin', { email: email.trim(), message: message.trim() }).subscribe({
      next: () => this.dialogRef.close(true),
      error: () => {
        this.sending.set(false);
        this.sendFailed.set(true);
      },
    });
  }
}
