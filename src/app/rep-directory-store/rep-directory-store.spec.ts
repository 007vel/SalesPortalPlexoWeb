import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { RepDirectoryStore, docsComplete, portalLink, repStatusBadge } from './rep-directory-store';
import { provideTestHttp, apiUrl } from '../testing/http-test-helpers';

function repDto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    oId: 1,
    repId: '1001',
    fullName: 'Jordan Reyes',
    email: 'jordan@example.com',
    phone: null,
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

describe('RepDirectoryStore', () => {
  let store: RepDirectoryStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTestHttp()] });
    store = TestBed.inject(RepDirectoryStore);
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne(apiUrl('reps')).flush([]);
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(store).toBeTruthy();
  });

  it('starts empty', () => {
    expect(store.reps()).toEqual([]);
  });

  it('createRep posts to the API and adds the returned rep with sensible defaults', () => {
    let created: ReturnType<typeof store.findByRepId>;
    store
      .createRep({ name: 'Jordan Reyes', email: 'jordan@example.com', phone: '', address: '', city: '', state: '', zip: '', status: 'pending' })
      .subscribe((r) => (created = r));

    const req = httpMock.expectOne(apiUrl('reps'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(
      expect.objectContaining({ fullName: 'Jordan Reyes', email: 'jordan@example.com', status: 1 }),
    );
    req.flush(repDto());

    expect(created?.repId).toBe('1001');
    expect(created?.docs).toEqual({ agreement: null, w4: null });
    expect(created?.commissions.length).toBe(14);
    expect(store.reps().length).toBe(1);
  });

  it('updateStatus PUTs the full record (status translated to its API enum) and updates the matching rep', () => {
    store.createRep({ name: 'Jordan Reyes', email: 'jordan@example.com', phone: '', address: '', city: '', state: '', zip: '', status: 'pending' }).subscribe();
    httpMock.expectOne(apiUrl('reps')).flush(repDto());

    let updatedStatus: string | undefined;
    store.updateStatus('1001', 'active').subscribe((r) => (updatedStatus = r.status));

    const req = httpMock.expectOne(apiUrl('reps/1'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(expect.objectContaining({ repId: '1001', status: 2 }));
    req.flush(repDto({ status: 2 }));

    expect(updatedStatus).toBe('active');
    expect(store.findByRepId('1001')?.status).toBe('active');
  });

  it('updateLinksByRepId POSTs just the link fields to api/reps/link, identifying the rep by its plain RepId', () => {
    store.createRep({ name: 'Jordan Reyes', email: 'jordan@example.com', phone: '', address: '', city: '', state: '', zip: '', status: 'pending' }).subscribe();
    httpMock.expectOne(apiUrl('reps')).flush(repDto());

    store.updateLinksByRepId(1001, 'https://maps.google.com/x', 'https://hub.example.com/y').subscribe();

    const req = httpMock.expectOne(apiUrl('reps/link'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ repsId: 1001, googleLink: 'https://maps.google.com/x', resourceLink: 'https://hub.example.com/y' });
    req.flush(repDto({ googleLink: 'https://maps.google.com/x', resourceLink: 'https://hub.example.com/y' }));

    expect(store.findByRepId('1001')?.googleLink).toBe('https://maps.google.com/x');
  });

  it('setDocument uploads the file and records it under the given slot, leaving the other slot untouched', () => {
    store.createRep({ name: 'Jordan Reyes', email: 'jordan@example.com', phone: '', address: '', city: '', state: '', zip: '', status: 'pending' }).subscribe();
    httpMock.expectOne(apiUrl('reps')).flush(repDto());

    const file = new File(['contents'], 'signed.pdf');
    store.setDocument('1001', 'agreement', file).subscribe();

    const req = httpMock.expectOne(apiUrl('documents'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    const body = req.request.body as FormData;
    expect(body.get('repId')).toBe('1');
    expect(body.get('kind')).toBe('agreement');
    req.flush({ oId: 5, repId: 1, kind: 'agreement', fileName: 'signed.pdf', uploadedAt: '2026-08-06T00:00:00Z' });

    const updated = store.findByRepId('1001');
    expect(updated?.docs.agreement).toEqual({ oId: 5, name: 'signed.pdf', uploadedAt: '2026-08-06' });
    expect(updated?.docs.w4).toBeNull();
  });

  it('loadDocuments GETs api/documents/rep/{repId} and fills in the agreement/w4 slots by kind', () => {
    store.createRep({ name: 'Jordan Reyes', email: 'jordan@example.com', phone: '', address: '', city: '', state: '', zip: '', status: 'pending' }).subscribe();
    httpMock.expectOne(apiUrl('reps')).flush(repDto());

    store.loadDocuments('1001').subscribe();

    const req = httpMock.expectOne(apiUrl('documents/rep/1001'));
    expect(req.request.method).toBe('GET');
    req.flush([
      { oId: 5, repId: 1, kind: 'agreement', fileName: 'signed.pdf', uploadedAt: '2026-08-06T00:00:00Z' },
      { oId: 6, repId: 1, kind: 'w4', fileName: 'w4.pdf', uploadedAt: '2026-08-07T00:00:00Z' },
    ]);

    const updated = store.findByRepId('1001');
    expect(updated?.docs.agreement).toEqual({ oId: 5, name: 'signed.pdf', uploadedAt: '2026-08-06' });
    expect(updated?.docs.w4).toEqual({ oId: 6, name: 'w4.pdf', uploadedAt: '2026-08-07' });
  });

  it('setDocument deletes the previously uploaded file for that slot', () => {
    store.createRep({ name: 'Jordan Reyes', email: 'jordan@example.com', phone: '', address: '', city: '', state: '', zip: '', status: 'pending' }).subscribe();
    httpMock.expectOne(apiUrl('reps')).flush(repDto());

    store.setDocument('1001', 'agreement', new File(['a'], 'first.pdf')).subscribe();
    httpMock.expectOne(apiUrl('documents')).flush({ oId: 5, repId: 1, fileName: 'first.pdf', uploadedAt: '2026-08-06T00:00:00Z' });

    store.setDocument('1001', 'agreement', new File(['b'], 'second.pdf')).subscribe();
    httpMock.expectOne(apiUrl('documents')).flush({ oId: 6, repId: 1, fileName: 'second.pdf', uploadedAt: '2026-08-06T00:00:00Z' });

    const deleteReq = httpMock.expectOne(apiUrl('documents/5'));
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null);

    expect(store.findByRepId('1001')?.docs.agreement?.oId).toBe(6);
  });

  it('repStatusBadge maps every status to a class + label', () => {
    expect(repStatusBadge('active')).toEqual({ cssClass: 'badge-active', label: 'Active' });
    expect(repStatusBadge('pending')).toEqual({ cssClass: 'badge-pending', label: 'Pending' });
    expect(repStatusBadge('inactive')).toEqual({ cssClass: 'badge-inactive', label: 'Inactive' });
  });

  it('docsComplete is true only when both docs are present', () => {
    expect(docsComplete({ docs: { agreement: null, w4: null } })).toBe(false);
    expect(docsComplete({ docs: { agreement: { oId: 1, name: 'a', uploadedAt: '2026-08-05' }, w4: null } })).toBe(false);
    expect(
      docsComplete({ docs: { agreement: { oId: 1, name: 'a', uploadedAt: '2026-08-05' }, w4: { oId: 2, name: 'b', uploadedAt: '2026-08-05' } } }),
    ).toBe(true);
  });

  it('portalLink formats the public link text', () => {
    expect(portalLink('1001')).toBe('plexopro.com/1001');
  });
});
