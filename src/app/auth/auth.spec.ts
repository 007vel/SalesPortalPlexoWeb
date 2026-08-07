import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Auth } from './auth';
import { provideTestHttp, apiUrl } from '../testing/http-test-helpers';

describe('Auth', () => {
  let auth: Auth;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTestHttp()] });
    auth = TestBed.inject(Auth);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(auth).toBeTruthy();
  });

  it('starts with no session', () => {
    expect(auth.session()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('login posts to api/users/rep-login-validate and sets the session when the backend confirms a match', () => {
    let resolvedSession: unknown = null;
    auth.login('jordan@example.com', '1001').subscribe((s) => (resolvedSession = s));

    const req = httpMock.expectOne(apiUrl('users/rep-login-validate'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'jordan@example.com', repId: '1001' });
    req.flush({ isValid: true, message: 'Email and RepId match.' });

    expect(resolvedSession).toEqual({ email: 'jordan@example.com', repId: '1001' });
    expect(auth.session()).toEqual({ email: 'jordan@example.com', repId: '1001' });
    expect(auth.isAuthenticated()).toBe(true);
    expect(localStorage.getItem('plexo.rep.session')).toContain('1001');
  });

  it('login fails and leaves the session null when the backend reports no match', () => {
    let succeeded = false;
    let failed = false;
    auth.login('nobody@example.com', '9999').subscribe({
      next: () => (succeeded = true),
      error: () => (failed = true),
    });

    httpMock
      .expectOne(apiUrl('users/rep-login-validate'))
      .flush({ isValid: false, message: 'Email and RepId do not match.' });

    expect(succeeded).toBe(false);
    expect(failed).toBe(true);
    expect(auth.session()).toBeNull();
    expect(localStorage.getItem('plexo.rep.session')).toBeNull();
  });
});
