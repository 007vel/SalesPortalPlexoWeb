import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { finalize } from 'rxjs';
import { Auth } from '../auth/auth';
import { AdminAuth } from '../admin-auth/admin-auth';
import { MOCK_CONFIG } from '../mock-config/mock-config';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTabsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly adminAuth = inject(AdminAuth);
  private readonly router = inject(Router);

  readonly activeTabIndex = signal(0);

  readonly submitting = signal(false);
  readonly loginFailed = signal(false);

  readonly adminSubmitting = signal(false);
  readonly adminLoginFailed = signal(false);
  readonly adminPasswordVisible = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    repId: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
  });

  readonly adminForm = this.fb.nonNullable.group({
    email: [MOCK_CONFIG.demoLoginCredentials.email, [Validators.required, Validators.email]],
    repId: [MOCK_CONFIG.demoLoginCredentials.repId, [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loginFailed.set(false);
    this.submitting.set(true);

    const { email, repId } = this.form.getRawValue();
    this.auth
      .login(email, repId)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.router.navigateByUrl('/rep'),
        error: () => this.loginFailed.set(true),
      });
  }

  submitAdmin(): void {
    if (this.adminForm.invalid || this.adminSubmitting()) {
      this.adminForm.markAllAsTouched();
      return;
    }

    this.adminLoginFailed.set(false);
    this.adminSubmitting.set(true);

    const { email, repId } = this.adminForm.getRawValue();
    this.adminAuth
      .login(email, repId)
      .pipe(finalize(() => this.adminSubmitting.set(false)))
      .subscribe({
        next: () => this.router.navigateByUrl('/admin'),
        error: () => this.adminLoginFailed.set(true),
      });
  }
}
