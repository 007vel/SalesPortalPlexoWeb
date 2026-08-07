import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { AdminAuth } from './admin-auth';
import { provideTestHttp, apiUrl } from '../testing/http-test-helpers';

describe('AdminAuth', () => {
  let adminAuth: AdminAuth;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTestHttp()] });
    adminAuth = TestBed.inject(AdminAuth);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(adminAuth).toBeTruthy();
  });

  it('starts signed out', () => {
    expect(adminAuth.isSignedIn()).toBe(false);
  });

  it('login validates via the same api/users/validate endpoint and signs in on a match', () => {
    let succeeded = false;
    adminAuth.login('sakthi@plexo.com', '1000').subscribe(() => (succeeded = true));

    const req = httpMock.expectOne(apiUrl('users/validate'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'sakthi@plexo.com', repId: '1000' });
    req.flush({ isValid: true, message: 'Email and RepId match.' });

    expect(succeeded).toBe(true);
    expect(adminAuth.isSignedIn()).toBe(true);
  });

  it('login fails and stays signed out when the backend reports no match', () => {
    let failed = false;
    adminAuth.login('sakthi@plexo.com', '9999').subscribe({ error: () => (failed = true) });

    httpMock.expectOne(apiUrl('users/validate')).flush({ isValid: false, message: 'Email and RepId do not match.' });

    expect(failed).toBe(true);
    expect(adminAuth.isSignedIn()).toBe(false);
  });

  it('logout signs out', () => {
    adminAuth.login('sakthi@plexo.com', '1000').subscribe();
    httpMock.expectOne(apiUrl('users/validate')).flush({ isValid: true, message: 'match' });

    adminAuth.logout();
    expect(adminAuth.isSignedIn()).toBe(false);
  });
});
