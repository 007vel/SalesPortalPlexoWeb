import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { RepLinks } from './rep-links';
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
    expect(component.linkRows().every((row) => row.value === '')).toBe(true);
  });

  it('picks up the profile once RepDirectoryStore\'s initial load resolves after construction (page-refresh race)', async () => {
    // Simulates a page refresh: the rep session is already restored from localStorage synchronously,
    // but RepDirectoryStore's GET api/reps (fired from its own constructor) is still in flight when
    // this component is constructed.
    localStorage.setItem('plexo.rep.session', JSON.stringify({ email: 'jordan@example.com', repId: '1001' }));

    fixture = TestBed.createComponent(RepLinks);
    component = fixture.componentInstance;

    httpMock
      .expectOne(apiUrl('reps'))
      .flush([repDto({ googleLink: 'https://maps.google.com/x', resourceLink: 'https://hub.example.com/y' })]);
    await fixture.whenStable();

    const byKey = (key: string) => component.linkRows().find((row) => row.key === key)?.value;
    expect(byKey('googleLink')).toBe('https://maps.google.com/x');
    expect(byKey('resourceLink')).toBe('https://hub.example.com/y');
  });
});
