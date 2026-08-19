import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Api } from '../api/api';
import { Auth } from '../auth/auth';
import { RepProfileStore } from '../rep-profile-store/rep-profile-store';

@Component({
  selector: 'app-rep-contact-us',
  imports: [
    ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './rep-contact-us.html',
  styleUrl: './rep-contact-us.scss',
})
export class RepContactUs {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(Api);
  private readonly auth = inject(Auth);
  private readonly repProfileStore = inject(RepProfileStore);

  readonly sending = signal(false);
  readonly sent = signal(false);
  readonly sendFailed = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: [this.repProfileStore.profile().name, [Validators.required]],
    email: [this.auth.session()?.email ?? '', [Validators.required, Validators.email]],
    message: ['', [Validators.required]],
  });

  send(): void {
    if (this.form.invalid || this.sending()) {
      this.form.markAllAsTouched();
      return;
    }

    this.sendFailed.set(false);
    this.sending.set(true);

    const { name, email, message } = this.form.getRawValue();

    this.api.post('support/contact-admin', {
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
    }).subscribe({
      next: () => {
        this.sending.set(false);
        this.sent.set(true);
      },
      error: () => {
        this.sending.set(false);
        this.sendFailed.set(true);
      },
    });
  }

  sendAnother(): void {
    this.form.reset({
      name: this.repProfileStore.profile().name,
      email: this.auth.session()?.email ?? '',
      message: '',
    });
    this.sent.set(false);
    this.sendFailed.set(false);
  }
}
