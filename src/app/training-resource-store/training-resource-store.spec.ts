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

    expect(uploaded).toMatchObject({ title: 'Renewal pitch walkthrough', type: 'video', oId: 9 });
    expect(store.resources().length).toBe(1);
  });

  it('loadForRole GETs api/traininghub/role/{roleId} and merges docs in, keeping local-only resources', () => {
    store.addResource({ title: 'Local link', category: 'X', type: 'link', duration: '', featured: false, description: '', url: 'https://a' });

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

    expect(store.resources().length).toBe(2);
    expect(store.resources().some((r) => r.title === 'Local link')).toBe(true);
    expect(store.resources().some((r) => r.title === 'Uploaded video' && r.oId === 9)).toBe(true);
  });

  it('remove deletes the backend document when the resource has an oId', () => {
    store
      .uploadDocument({ title: 'A', category: 'X', length: '', description: '', roleId: '1001' }, new File(['a'], 'a.pdf'))
      .subscribe();
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

  it('remove drops a local-only resource without calling the backend', () => {
    store.addResource({ title: 'A', category: 'X', type: 'doc', duration: '', featured: false, description: '', url: 'https://a' });
    const id = store.resources()[0].id;

    store.remove(id).subscribe();

    expect(store.resources()).toEqual([]);
  });

  it('addResource adds any resource type', () => {
    store.addResource({
      title: 'Objection Handling Playbook', category: 'Sales Playbooks', type: 'pdf',
      duration: '14 pages', featured: false, description: 'Common pushback.', url: 'https://example.com/pdf',
    });

    const resources = store.resources();
    expect(resources.length).toBe(1);
    expect(resources[0].type).toBe('pdf');
  });

  it('updateResource edits an existing resource in place', () => {
    store.addResource({
      title: 'Old title', category: 'X', type: 'doc', duration: '', featured: false, description: '', url: 'https://a',
    });
    const id = store.resources()[0].id;

    store.updateResource(id, {
      title: 'New title', category: 'Y', type: 'doc', duration: '', featured: false, description: '', url: 'https://a',
    });

    expect(store.resources()[0].title).toBe('New title');
    expect(store.resources()[0].category).toBe('Y');
    expect(store.resources().length).toBe(1);
  });

  it('only one resource can be featured at a time', () => {
    store.addResource({ title: 'A', category: 'X', type: 'doc', duration: '', featured: true, description: '', url: 'https://a' });
    store.addResource({ title: 'B', category: 'X', type: 'doc', duration: '', featured: false, description: '', url: 'https://b' });

    const idA = store.resources().find((r) => r.title === 'A')!.id;
    const idB = store.resources().find((r) => r.title === 'B')!.id;
    expect(store.resources().find((r) => r.id === idA)?.featured).toBe(true);

    store.updateResource(idB, { title: 'B', category: 'X', type: 'doc', duration: '', featured: true, description: '', url: 'https://b' });

    expect(store.resources().find((r) => r.id === idA)?.featured).toBe(false);
    expect(store.resources().find((r) => r.id === idB)?.featured).toBe(true);
  });

  it('sharedHubLink starts empty and can be set', () => {
    expect(store.sharedHubLink()).toBe('');
    store.setSharedHubLink('https://training.plexopro.com/hub');
    expect(store.sharedHubLink()).toBe('https://training.plexopro.com/hub');
  });
});
