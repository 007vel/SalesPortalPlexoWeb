import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { AdminRepsDetials } from './admin-reps-detials';
import { RepDirectoryStore } from '../rep-directory-store/rep-directory-store';
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

describe('AdminRepsDetials', () => {
  let component: AdminRepsDetials;
  let fixture: ComponentFixture<AdminRepsDetials>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminRepsDetials],
      providers: [provideRouter([]), provideTestHttp()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should create for a rep not (yet) in the directory (no documents fetch fired)', async () => {
    fixture = TestBed.createComponent(AdminRepsDetials);
    fixture.componentRef.setInput('repId', '1001');
    component = fixture.componentInstance;
    flushInitialReps();
    await fixture.whenStable();

    expect(component).toBeTruthy();
  });

  it('fetches documents for the rep once it is present in the directory', async () => {
    const directory = TestBed.inject(RepDirectoryStore);
    flushInitialReps();

    directory
      .createRep({ name: 'Jordan Reyes', email: 'jordan@example.com', phone: '', address: '', city: '', state: '', zip: '', status: 'pending' })
      .subscribe();
    httpMock.expectOne(apiUrl('reps')).flush(repDto());

    fixture = TestBed.createComponent(AdminRepsDetials);
    fixture.componentRef.setInput('repId', '1001');
    component = fixture.componentInstance;
    await fixture.whenStable(); // lets the constructor's effect() run once so it fires the fetch

    const req = httpMock.expectOne(apiUrl('documents/rep/1001'));
    expect(req.request.method).toBe('GET');
    req.flush([{ oId: 5, repId: 1, kind: 'agreement', fileName: 'signed.pdf', uploadedAt: '2026-08-06T00:00:00Z' }]);
    await fixture.whenStable();

    expect(component.rep()?.docs.agreement).toEqual({ oId: 5, name: 'signed.pdf', uploadedAt: '2026-08-06' });
  });
});
