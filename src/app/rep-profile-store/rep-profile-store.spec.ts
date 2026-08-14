import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { RepProfileStore } from './rep-profile-store';
import { RepDirectoryStore } from '../rep-directory-store/rep-directory-store';
import { Auth } from '../auth/auth';
import { provideTestHttp, apiUrl } from '../testing/http-test-helpers';

function repDto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    oId: 1,
    repId: '1001',
    fullName: 'Jordan Reyes',
    email: 'jordan@example.com',
    phone: '(401) 555-0148',
    address: null,
    city: null,
    state: null,
    zip: null,
    googleLink: null,
    resourceLink: null,
    status: 1,
    createdAt: '2026-08-05T00:00:00Z',
    updatedAt: '2026-08-05T00:00:00Z',
    ...overrides,
  };
}

function createAndSignIn(directory: RepDirectoryStore, auth: Auth, httpMock: HttpTestingController): void {
  directory
    .createRep({ name: 'Jordan Reyes', email: 'jordan@example.com', phone: '(401) 555-0148', salesRepType: 'referralAgent', address: '', city: '', state: '', zip: '', status: 'pending', passedCertification: false, businessCardsSent: false, consultantFeePaid: false })
    .subscribe();
  httpMock.expectOne(apiUrl('reps')).flush(repDto());

  auth.login('jordan@example.com', '1001').subscribe();
  httpMock.expectOne(apiUrl('users/rep-login-validate')).flush({ isValid: true, message: 'match' });
}

describe('RepProfileStore', () => {
  let store: RepProfileStore;
  let directory: RepDirectoryStore;
  let auth: Auth;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTestHttp()] });
    store = TestBed.inject(RepProfileStore);
    directory = TestBed.inject(RepDirectoryStore);
    auth = TestBed.inject(Auth);
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne(apiUrl('reps')).flush([]);
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(store).toBeTruthy();
  });

  it('falls back to an empty profile with no active session', () => {
    const profile = store.profile();
    expect(profile.name).toBe('');
    expect(profile.docs.agreement).toBeNull();
    expect(profile.docs.w4).toBeNull();
  });

  it('profile reflects the signed-in rep once a session exists', () => {
    createAndSignIn(directory, auth, httpMock);

    expect(store.profile().name).toBe('Jordan Reyes');
    expect(store.profile().phone).toBe('(401) 555-0148');
  });

  it('setDocument delegates to the directory for the signed-in rep', () => {
    createAndSignIn(directory, auth, httpMock);

    store.setDocument('agreement', new File(['a'], 'signed.pdf')).subscribe();
    httpMock.expectOne(apiUrl('documents')).flush({ oId: 9, repId: 1, fileName: 'signed.pdf', uploadedAt: '2026-08-06T00:00:00Z' });

    expect(store.profile().docs.agreement).toEqual({ oId: 9, name: 'signed.pdf', uploadedAt: '2026-08-06' });
  });

  it('setDocument is a no-op with no active session', () => {
    store.setDocument('agreement', new File(['a'], 'signed.pdf')).subscribe({ error: () => {} });

    expect(store.profile().docs.agreement).toBeNull();
  });
});
