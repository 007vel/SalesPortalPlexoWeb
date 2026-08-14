import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { RepDocuments } from './rep-documents';
import { RepDirectoryStore } from '../rep-directory-store/rep-directory-store';
import { Auth } from '../auth/auth';
import { provideTestHttp, flushInitialReps, apiUrl } from '../testing/http-test-helpers';

function repDto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    oId: 1,
    repId: '1001',
    fullName: 'Jordan Reyes',
    email: 'jordan@example.com',
    phone: '',
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

describe('RepDocuments', () => {
  let component: RepDocuments;
  let fixture: ComponentFixture<RepDocuments>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RepDocuments],
      providers: [provideTestHttp()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should create with no active session (no documents fetch fired)', async () => {
    fixture = TestBed.createComponent(RepDocuments);
    component = fixture.componentInstance;
    flushInitialReps();
    await fixture.whenStable();

    expect(component).toBeTruthy();
  });

  it('fetches the signed-in rep\'s documents once the directory has loaded, and fills the agreement/w4 cards', async () => {
    const directory = TestBed.inject(RepDirectoryStore);
    const auth = TestBed.inject(Auth);
    flushInitialReps();

    directory
      .createRep({ name: 'Jordan Reyes', email: 'jordan@example.com', phone: '', salesRepType: 'referralAgent', address: '', city: '', state: '', zip: '', status: 'pending', passedCertification: false, businessCardsSent: false, consultantFeePaid: false })
      .subscribe();
    httpMock.expectOne(apiUrl('reps')).flush(repDto());

    auth.login('jordan@example.com', '1001').subscribe();
    httpMock.expectOne(apiUrl('users/rep-login-validate')).flush({ isValid: true, message: 'match' });

    fixture = TestBed.createComponent(RepDocuments);
    component = fixture.componentInstance;
    await fixture.whenStable(); // lets the constructor's effect() run once so it fires the fetch

    const req = httpMock.expectOne(apiUrl('documents/rep/1001'));
    expect(req.request.method).toBe('GET');
    req.flush([{ oId: 5, repId: 1, kind: 'agreement', fileName: 'signed.pdf', uploadedAt: '2026-08-06T00:00:00Z' }]);
    await fixture.whenStable();

    const agreementCard = component.docCards().find((c) => c.kind === 'agreement');
    expect(agreementCard?.filled).toBe(true);
    expect(agreementCard?.oId).toBe(5);

    const w4Card = component.docCards().find((c) => c.kind === 'w4');
    expect(w4Card?.filled).toBe(false);
  });
});
