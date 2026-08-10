import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { Api } from '../api/api';
import { MOCK_CONFIG } from '../mock-config/mock-config';

export interface RepSession {
  email: string;
  repId: string;
}

interface UserValidateResponseDto {
  isValid: boolean;
  message: string;
}

const SESSION_STORAGE_KEY = MOCK_CONFIG.sessionStorageKeys.rep;

/**
 * Rep login validates email+repId against the real Reps table via
 * `POST api/users/rep-login-validate`. Admin login still goes through
 * `validate()` / `POST api/users/validate`, which checks a hardcoded demo
 * credential — that path is unchanged.
 */
@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly api = inject(Api);
  private readonly sessionSignal = signal<RepSession | null>(this.restoreSession());

  readonly session = this.sessionSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);

  login(email: string, password: string): Observable<RepSession> {
    return this.validateRepLogin(email, password).pipe(tap((s) => this.setSession(s)));
  }

  /** Calls `POST api/users/rep-login-validate` without touching the rep session. */
  validateRepLogin(email: string, repId: string): Observable<RepSession> {
    const trimmedEmail = email.trim();
    const trimmedRepId = repId.trim();
    return this.api
      .post<UserValidateResponseDto>('users/rep-login-validate', { email: trimmedEmail, repId: trimmedRepId })
      .pipe(
        map((res) => {
          if (!res.isValid) throw new Error(res.message || 'No matching rep');
          return { email: trimmedEmail, repId: trimmedRepId };
        }),
      );
  }

  /** Calls `POST api/users/validate` without touching the rep session — used by AdminAuth. */
  validate(email: string, password: string): Observable<RepSession> {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    return this.api.post<UserValidateResponseDto>('users/validate', { email: trimmedEmail, password: trimmedPassword }).pipe(
      map((res) => {
        if (!res.isValid) throw new Error(res.message || 'No matching rep');
        return { email: trimmedEmail, repId: trimmedPassword };
      }),
    );
  }

  logout(): void {
    this.setSession(null);
  }

  private setSession(session: RepSession | null): void {
    this.sessionSignal.set(session);
    if (session) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  private restoreSession(): RepSession | null {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RepSession;
    } catch {
      return null;
    }
  }
}
