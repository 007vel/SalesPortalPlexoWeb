import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { finalize } from 'rxjs';
import { Api } from '../api/api';
import { Auth } from '../auth/auth';
import { AdminAuth } from '../admin-auth/admin-auth';
import { AskAdminDialog } from '../ask-admin-dialog/ask-admin-dialog';
import { Toast } from '../toast/toast';

interface RepValidateResponseDto {
  repId: string;
  email: string;
}

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTabsModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly adminAuth = inject(AdminAuth);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(Toast);

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
    email: ['', [Validators.required, Validators.email]],
    repId: ['', [Validators.required]],
  });

  ngOnInit(): void {
    const portalRepId = this.route.snapshot.paramMap.get('portalRepId');
    if (!portalRepId) return;

    this.submitting.set(true);
    this.api.get<RepValidateResponseDto>(`reps/validate/${portalRepId}`).subscribe({
      next: (rep) => {
        this.form.patchValue({ email: rep.email, repId: rep.repId });
        this.submitting.set(false);
        this.submit();
      },
      error: () => {
        this.submitting.set(false);
        this.loginFailed.set(true);
      },
    });
  }

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

  askAdmin(): void {
    if (this.dialog.openDialogs.length) return;
    this.dialog
      .open(AskAdminDialog)
      .afterClosed()
      .subscribe((sent) => {
        if (sent) this.toast.show('Message sent — the team will be in touch');
      });
  }
}
