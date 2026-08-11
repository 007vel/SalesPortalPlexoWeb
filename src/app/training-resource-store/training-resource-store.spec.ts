import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { TrainingResourceStore } from './training-resource-store';
import { provideTestHttp, apiUrl } from '../testing/http-test-helpers';

describe('TrainingResourceStore', () => {
  let store: TrainingResourceStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTestHttp()] });
    store = TestBed.inject(TrainingResourceStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(store).toBeTruthy();
  });

  it('starts empty', () => {
    expect(store.resources()).toEqual([]);
  });

  it('uploadDocument posts the file as FormData to api/traininghub and prepends the returned resource', () => {
    const file = new File(['contents'], 'renewal-pitch.mp4');
    let uploaded: ReturnType<TrainingResourceStore['resources']>[number] | undefined;

    store
      .uploadDocument(
        {
          title: 'Renewal pitch walkthrough',
          category: 'Team Uploads',
          length: '12 min',
          description: 'A live call example.',
          roleId: '1001',
          uploadedBy: 'Rep',
          language: 'English',
        },
        file,
      )
      .subscribe((r) => (uploaded = r));

    const req = httpMock.expectOne(apiUrl('traininghub'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    const body = req.request.body as FormData;
    expect(body.get('roleId')).toBe('1001');
    expect(body.get('uploadedBy')).toBe('Rep');
    expect(body.get('title')).toBe('Renewal pitch walkthrough');
    expect(body.get('language')).toBe('English');
    expect(body.get('file')).toBe(file);

    req.flush({
      oId: 9,
      roleId: '1001',
      title: 'Renewal pitch walkthrough',
      category: 'Team Uploads',
      description: 'A live call example.',
      fileType: 'Video',
      fileName: 'renewal-pitch.mp4',
      length: '12 min',
      uploadedBy: 'Rep',
      uploadedAt: '2026-08-06T00:00:00Z',
      language: 'English',
    });

    expect(uploaded).toMatchObject({ title: 'Renewal pitch walkthrough', type: 'video', oId: 9, repId: '1001', uploadedBy: 'Rep' });
    expect(store.resources().length).toBe(1);
  });

  it('loadForRole GETs api/traininghub/role/{roleId} and replaces the list with that rep\'s docs', () => {
    store.loadForRole('1001').subscribe();

    const req = httpMock.expectOne(apiUrl('traininghub/role/1001'));
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        oId: 9,
        roleId: '1001',
        title: 'Uploaded video',
        category: 'Team Uploads',
        description: '',
        fileType: 'Video',
        fileName: 'a.mp4',
        length: '12 min',
        uploadedBy: 'Rep',
        uploadedAt: '2026-08-06T00:00:00Z',
        language: 'English',
      },
    ]);

    expect(store.resources().length).toBe(1);
    expect(store.resources()[0]).toMatchObject({ title: 'Uploaded video', oId: 9, repId: '1001', uploadedBy: 'Rep' });
  });

  it('loadAll GETs api/traininghub (unfiltered) and populates the list across every rep', () => {
    store.loadAll().subscribe();

    const req = httpMock.expectOne(apiUrl('traininghub'));
    expect(req.request.method).toBe('GET');
    req.flush([
      { oId: 1, roleId: '1001', title: 'A', category: 'X', description: '', fileType: 'Video', fileName: 'a.mp4', length: '', uploadedBy: 'Rep', uploadedAt: '2026-08-06T00:00:00Z', language: 'English' },
      { oId: 2, roleId: '1002', title: 'B', category: 'Y', description: '', fileType: 'Pdf', fileName: 'b.pdf', length: null, uploadedBy: 'Rep', uploadedAt: '2026-08-06T00:00:00Z', language: 'Spanish' },
    ]);

    expect(store.resources().length).toBe(2);
    expect(store.resources().map((r) => r.repId).sort()).toEqual(['1001', '1002']);
  });

  it('loadAdminUploads GETs api/traininghub/filter?includeAdmin=true and populates the list with Admin-only docs', () => {
    store.loadAdminUploads().subscribe();

    const req = httpMock.expectOne((r) => r.url === apiUrl('traininghub/filter'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('includeAdmin')).toBe('true');
    req.flush([
      { oId: 5, roleId: null, title: 'Admin doc', category: 'Policies', description: '', fileType: 'Pdf', fileName: 'policy.pdf', length: null, uploadedBy: 'Admin', uploadedAt: '2026-08-06T00:00:00Z', language: 'English' },
    ]);

    expect(store.resources().length).toBe(1);
    expect(store.resources()[0]).toMatchObject({ title: 'Admin doc', oId: 5, repId: '', uploadedBy: 'Admin' });
  });

  it('remove deletes the backend document and drops it from the list', () => {
    store.uploadDocument({ title: 'A', category: 'X', length: '', description: '', roleId: '1001', uploadedBy: 'Rep', language: 'English' }, new File(['a'], 'a.pdf')).subscribe();
    httpMock.expectOne(apiUrl('traininghub')).flush({
      oId: 3, roleId: '1001', title: 'A', category: 'X', description: '', fileType: 'Pdf', fileName: 'a.pdf', length: null, uploadedBy: 'Rep', uploadedAt: '2026-08-06T00:00:00Z', language: 'English',
    });

    const id = store.resources()[0].id;
    store.remove(id).subscribe();

    const req = httpMock.expectOne(apiUrl('traininghub/3'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(store.resources()).toEqual([]);
  });

  it('remove is a no-op when the resource is not in the list', () => {
    store.remove('missing').subscribe();
    expect(store.resources()).toEqual([]);
  });
});
