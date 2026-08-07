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
        },
        file,
      )
      .subscribe((r) => (uploaded = r));

    const req = httpMock.expectOne(apiUrl('traininghub'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    const body = req.request.body as FormData;
    expect(body.get('roleId')).toBe('1001');
    expect(body.get('title')).toBe('Renewal pitch walkthrough');
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
      uploadedAt: '2026-08-06T00:00:00Z',
    });

    expect(uploaded).toMatchObject({ title: 'Renewal pitch walkthrough', type: 'video', oId: 9, repId: '1001' });
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
        uploadedAt: '2026-08-06T00:00:00Z',
      },
    ]);

    expect(store.resources().length).toBe(1);
    expect(store.resources()[0]).toMatchObject({ title: 'Uploaded video', oId: 9, repId: '1001' });
  });

  it('loadAll GETs api/traininghub (unfiltered) and populates the list across every rep', () => {
    store.loadAll().subscribe();

    const req = httpMock.expectOne(apiUrl('traininghub'));
    expect(req.request.method).toBe('GET');
    req.flush([
      { oId: 1, roleId: '1001', title: 'A', category: 'X', description: '', fileType: 'Video', fileName: 'a.mp4', length: '', uploadedAt: '2026-08-06T00:00:00Z' },
      { oId: 2, roleId: '1002', title: 'B', category: 'Y', description: '', fileType: 'Pdf', fileName: 'b.pdf', length: null, uploadedAt: '2026-08-06T00:00:00Z' },
    ]);

    expect(store.resources().length).toBe(2);
    expect(store.resources().map((r) => r.repId).sort()).toEqual(['1001', '1002']);
  });

  it('remove deletes the backend document and drops it from the list', () => {
    store.uploadDocument({ title: 'A', category: 'X', length: '', description: '', roleId: '1001' }, new File(['a'], 'a.pdf')).subscribe();
    httpMock.expectOne(apiUrl('traininghub')).flush({
      oId: 3, roleId: '1001', title: 'A', category: 'X', description: '', fileType: 'Pdf', fileName: 'a.pdf', length: null, uploadedAt: '2026-08-06T00:00:00Z',
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
