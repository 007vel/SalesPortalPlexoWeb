import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { RepLinks } from './rep-links';
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

describe('RepLinks', () => {
  let component: RepLinks;
  let fixture: ComponentFixture<RepLinks>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RepLinks],
      providers: [provideTestHttp()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should create with no active session', async () => {
    fixture = TestBed.createComponent(RepLinks);
    component = fixture.componentInstance;
    flushInitialReps();
    await fixture.whenStable();

    expect(component).toBeTruthy();
  });

  it('save() is a no-op with no active session', async () => {
    fixture = TestBed.createComponent(RepLinks);
    component = fixture.componentInstance;
    flushInitialReps();
    await fixture.whenStable();

    component.save();
    // No further requests should fire — httpMock.verify() in afterEach confirms it.
  });

  it('save() reads the RepId from the Auth session and posts to api/reps/link', async () => {
    const directory = TestBed.inject(RepDirectoryStore);
    const auth = TestBed.inject(Auth);
    flushInitialReps();

    directory
      .createRep({ name: 'Jordan Reyes', email: 'jordan@example.com', phone: '', address: '', city: '', state: '', zip: '', status: 'pending', passedCertification: false, businessCardsSent: false, consultantFeePaid: false })
      .subscribe();
    httpMock.expectOne(apiUrl('reps')).flush(repDto());

    auth.login('jordan@example.com', '1001').subscribe();
    httpMock.expectOne(apiUrl('users/rep-login-validate')).flush({ isValid: true, message: 'match' });

    fixture = TestBed.createComponent(RepLinks);
    component = fixture.componentInstance;
    await fixture.whenStable();

    component.form.setValue({ googleLink: 'https://maps.google.com/x', resourceLink: 'https://hub.example.com/y' });
    component.save();

    const req = httpMock.expectOne(apiUrl('reps/link'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ repsId: 1001, googleLink: 'https://maps.google.com/x', resourceLink: 'https://hub.example.com/y' });
    req.flush(repDto({ googleLink: 'https://maps.google.com/x', resourceLink: 'https://hub.example.com/y' }));
  });

  it('picks up the profile once RepDirectoryStore\'s initial load resolves after construction (page-refresh race)', async () => {
    // Simulates a page refresh: the rep session is already restored from localStorage synchronously,
    // but RepDirectoryStore's GET api/reps (fired from its own constructor) is still in flight when
    // this component is constructed.
    localStorage.setItem('plexo.rep.session', JSON.stringify({ email: 'jordan@example.com', repId: '1001' }));

    fixture = TestBed.createComponent(RepLinks);
    component = fixture.componentInstance;

    expect(component.form.value.googleLink).toBe('');
    expect(component.form.value.resourceLink).toBe('');

    httpMock
      .expectOne(apiUrl('reps'))
      .flush([repDto({ googleLink: 'https://maps.google.com/x', resourceLink: 'https://hub.example.com/y' })]);
    await fixture.whenStable();

    expect(component.form.value.googleLink).toBe('https://maps.google.com/x');
    expect(component.form.value.resourceLink).toBe('https://hub.example.com/y');
  });

  it('stops syncing from the profile once the rep starts editing, so in-progress typing is not clobbered', async () => {
    localStorage.setItem('plexo.rep.session', JSON.stringify({ email: 'jordan@example.com', repId: '1001' }));

    fixture = TestBed.createComponent(RepLinks);
    component = fixture.componentInstance;

    httpMock.expectOne(apiUrl('reps')).flush([repDto({ googleLink: 'https://maps.google.com/x', resourceLink: '' })]);
    await fixture.whenStable();

    // Real typing marks the control dirty via the DOM's input event (DefaultValueAccessor); setValue() alone doesn't, so mark it explicitly here.
    component.form.controls.googleLink.setValue('https://mid-edit.example.com');
    component.form.controls.googleLink.markAsDirty();

    const directory = TestBed.inject(RepDirectoryStore);
    directory.updateLinksByRepId(1001, 'https://server-side-change.example.com', '').subscribe();
    httpMock.expectOne(apiUrl('reps/link')).flush(repDto({ googleLink: 'https://server-side-change.example.com' }));
    await fixture.whenStable();

    expect(component.form.value.googleLink).toBe('https://mid-edit.example.com');
  });
});
