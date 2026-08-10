import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { AdminSettings } from './admin-settings';
import { provideTestHttp, apiUrl } from '../testing/http-test-helpers';

describe('AdminSettings', () => {
  let component: AdminSettings;
  let fixture: ComponentFixture<AdminSettings>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminSettings],
      providers: [provideTestHttp()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminSettings);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    httpMock.expectOne(apiUrl('reps')).flush([
      {
        oId: 1, repId: '1001', fullName: 'Jordan Reyes', email: 'jordan@example.com', phone: null, address: null,
        city: null, state: null, zip: null, googleLink: null, resourceLink: null, status: 2,
        createdAt: '2026-08-05T00:00:00Z', updatedAt: '2026-08-05T00:00:00Z',
      },
    ]);
    httpMock.expectOne((r) => r.url === apiUrl('traininghub/filter')).flush([
      { oId: 9, roleId: null, title: 'Admin upload', category: 'Team Uploads', description: '', fileType: 'Video', fileName: 'a.mp4', length: '12 min', uploadedBy: 'Admin', uploadedAt: '2026-08-06T00:00:00Z' },
    ]);
    httpMock.expectOne(apiUrl('documents')).flush([
      { oId: 5, repId: '1001', kind: 'agreement', fileName: 'signed.pdf', uploadedAt: '2026-08-06T00:00:00Z' },
    ]);

    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads Admin\'s training hub uploads', () => {
    expect(component.resources().length).toBe(1);
    expect(component.resources()[0]).toMatchObject({ title: 'Admin upload', repId: '' });
  });

  it('joins documents with the rep directory to resolve the uploader\'s name', () => {
    const rows = component.documentRows();
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ repId: '1001', repName: 'Jordan Reyes', label: 'Representative Agreement', fileName: 'signed.pdf' });
  });

  it('deleteResource removes the training hub document via the backend', () => {
    component.deleteResource(component.resources()[0].id);

    const req = httpMock.expectOne(apiUrl('traininghub/9'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(component.resources()).toEqual([]);
  });
});
