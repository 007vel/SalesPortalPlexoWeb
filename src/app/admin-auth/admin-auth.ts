import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Auth, RepSession } from '../auth/auth';
import { MOCK_CONFIG } from '../mock-config/mock-config';

const SESSION_STORAGE_KEY = MOCK_CONFIG.sessionStorageKeys.admin;

/**
 * Gates the admin surface. Validates the same way a rep does — email +
 * RepId against `POST api/users/validate` via `Auth.validate()` — but keeps
 * its own signed-in flag/session key so an admin sign-in doesn't also open
 * up the rep portal.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuth {
  private readonly auth = inject(Auth);
  private readonly signedInSignal = signal<boolean>(this.restore());

  readonly isSignedIn = this.signedInSignal.asReadonly();

  login(email: string, password: string): Observable<RepSession> {
    return this.auth.validate(email, password).pipe(tap(() => this.setSignedIn(true)));
  }

  logout(): void {
    this.setSignedIn(false);
  }

  private setSignedIn(value: boolean): void {
    this.signedInSignal.set(value);
    if (value) {
      localStorage.setItem(SESSION_STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  private restore(): boolean {
    return localStorage.getItem(SESSION_STORAGE_KEY) === '1';
  }
}
