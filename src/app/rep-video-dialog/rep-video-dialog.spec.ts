import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { RepVideoDialog } from './rep-video-dialog';
import { Auth } from '../auth/auth';
import { Toast } from '../toast/toast';
import { TrainingResource, TrainingResourceStore } from '../training-resource-store/training-resource-store';
import { provideTestHttp, apiUrl } from '../testing/http-test-helpers';

describe('RepVideoDialog', () => {
  let component: RepVideoDialog;
  let fixture: ComponentFixture<RepVideoDialog>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let trainingResourceStore: TrainingResourceStore;
  let httpMock: HttpTestingController;
  let toastShow: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    localStorage.clear();
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RepVideoDialog],
      providers: [{ provide: MatDialogRef, useValue: dialogRef }, provideTestHttp()],
    }).compileComponents();

    fixture = TestBed.createComponent(RepVideoDialog);
    component = fixture.componentInstance;
    trainingResourceStore = TestBed.inject(TrainingResourceStore);
    httpMock = TestBed.inject(HttpTestingController);
    toastShow = vi.spyOn(TestBed.inject(Toast), 'show').mockImplementation(() => {});
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  function signIn(): void {
    const auth = TestBed.inject(Auth);
    auth.login('jordan@example.com', '1001').subscribe();
    httpMock.expectOne(apiUrl('users/rep-login-validate')).flush({ isValid: true, message: 'match' });
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('submit() requires a title', () => {
    component.submit();
    expect(toastShow).toHaveBeenCalledWith('Give it a title');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('submit() requires a category once a title is set', () => {
    component.form.controls.title.setValue('My upload');
    component.submit();
    expect(toastShow).toHaveBeenCalledWith('Give it a category');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('submit() requires a file once a title and category are set', () => {
    component.form.controls.title.setValue('My upload');
    component.form.controls.category.setValue('Team Uploads');
    component.submit();
    expect(toastShow).toHaveBeenCalledWith('Choose a file to upload');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('submit() requires an active session once a title, category, and file are set', () => {
    component.form.controls.category.setValue('Team Uploads');
    component.handleFile({ target: { files: [new File(['a'], 'onboarding.pdf')], value: '' } } as unknown as Event);
    component.submit();
    expect(toastShow).toHaveBeenCalledWith('You must be signed in to upload');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('the Length field only appears once a video file is chosen', () => {
    expect(component.isVideo()).toBe(false);

    component.handleFile({ target: { files: [new File(['a'], 'onboarding.pdf')], value: '' } } as unknown as Event);
    expect(component.isVideo()).toBe(false);

    component.handleFile({ target: { files: [new File(['a'], 'walkthrough.mp4')], value: '' } } as unknown as Event);
    expect(component.isVideo()).toBe(true);
  });

  it('submit() uploads the file under the signed-in rep\'s RepId and closes with true when valid', () => {
    signIn();

    component.form.controls.category.setValue('Team Uploads');
    const file = new File(['contents'], 'renewal-pitch.mp4');
    component.handleFile({ target: { files: [file], value: '' } } as unknown as Event);
    component.submit();

    const req = httpMock.expectOne(apiUrl('traininghub'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    const body = req.request.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('roleId')).toBe('1001');
    expect(body.get('category')).toBe('Team Uploads');
    expect(body.get('language')).toBe('English');

    vi.useFakeTimers();
    req.flush({
      oId: 1, roleId: '1001', title: 'renewal-pitch', category: 'Team Uploads', description: '',
      fileType: 'Video', fileName: 'renewal-pitch.mp4', length: '', uploadedBy: 'Rep', uploadedAt: '2026-08-06T00:00:00Z', language: 'English',
    });
    // The dialog holds a brief "Added" confirmation before closing — advance past that delay.
    vi.advanceTimersByTime(1000);
    vi.useRealTimers();

    expect(trainingResourceStore.resources().length).toBe(1);
    expect(dialogRef.close).toHaveBeenCalledWith(true);
    expect(toastShow).not.toHaveBeenCalled();
  });

  it('cancel() closes with false', () => {
    component.cancel();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});

describe('RepVideoDialog (admin mode)', () => {
  let component: RepVideoDialog;
  let fixture: ComponentFixture<RepVideoDialog>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RepVideoDialog],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { mode: 'admin' } },
        provideTestHttp(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RepVideoDialog);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Toast), 'show').mockImplementation(() => {});
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  it('submit() uploads without a RepId, as Admin, and does not require a signed-in session', () => {
    component.form.controls.category.setValue('Team Uploads');
    const file = new File(['contents'], 'onboarding-guide.pdf');
    component.handleFile({ target: { files: [file], value: '' } } as unknown as Event);
    component.submit();

    const req = httpMock.expectOne(apiUrl('traininghub'));
    const body = req.request.body as FormData;
    expect(body.get('roleId')).toBeNull();
    expect(body.get('uploadedBy')).toBe('Admin');

    vi.useFakeTimers();
    req.flush({
      oId: 2, roleId: null, title: 'onboarding-guide', category: 'Team Uploads', description: '',
      fileType: 'Pdf', fileName: 'onboarding-guide.pdf', length: null, uploadedBy: 'Admin', uploadedAt: '2026-08-06T00:00:00Z', language: 'English',
    });
    vi.advanceTimersByTime(1000);
    vi.useRealTimers();

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});

describe('RepVideoDialog (admin mode, Marketing Hub)', () => {
  let component: RepVideoDialog;
  let fixture: ComponentFixture<RepVideoDialog>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [RepVideoDialog],
      providers: [
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: MAT_DIALOG_DATA, useValue: { mode: 'admin', hubType: 'Marketing' } },
        provideTestHttp(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RepVideoDialog);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Toast), 'show').mockImplementation(() => {});
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  it('submit() passes hubType through to the upload', () => {
    component.form.controls.title.setValue('Flyer');
    component.form.controls.category.setValue('Flyers');
    const file = new File(['contents'], 'flyer.pdf');
    component.handleFile({ target: { files: [file], value: '' } } as unknown as Event);
    component.submit();

    const req = httpMock.expectOne(apiUrl('traininghub'));
    const body = req.request.body as FormData;
    expect(body.get('hubType')).toBe('Marketing');
  });
});

describe('RepVideoDialog (edit mode)', () => {
  let component: RepVideoDialog;
  let fixture: ComponentFixture<RepVideoDialog>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let httpMock: HttpTestingController;

  const editingResource: TrainingResource = {
    id: 'doc-9', oId: 9, repId: '', uploadedBy: 'Admin', title: 'Old title', category: 'Flyers',
    type: 'pdf', duration: '', featured: false, description: 'Old description', url: '',
    fileName: 'old-flyer.pdf', language: 'English',
  };

  beforeEach(async () => {
    localStorage.clear();
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RepVideoDialog],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { mode: 'admin', hubType: 'Marketing', edit: editingResource } },
        provideTestHttp(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RepVideoDialog);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Toast), 'show').mockImplementation(() => {});
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  it('pre-fills the form from the resource being edited', () => {
    expect(component.form.getRawValue()).toEqual({
      title: 'Old title', category: 'Flyers', duration: '', description: 'Old description', language: 'English',
    });
    expect(component.pendingFileName()).toBe('old-flyer.pdf');
  });

  it('submit() without picking a new file PUTs metadata only, with no file entry', () => {
    component.form.controls.title.setValue('New title');
    component.submit();

    const req = httpMock.expectOne(apiUrl('traininghub/9'));
    expect(req.request.method).toBe('PUT');
    const body = req.request.body as FormData;
    expect(body.get('title')).toBe('New title');
    expect(body.get('file')).toBeNull();

    req.flush({
      oId: 9, roleId: null, title: 'New title', category: 'Flyers', description: 'Old description',
      fileType: 'Pdf', fileName: 'old-flyer.pdf', length: null, uploadedBy: 'Admin', uploadedAt: '2026-08-06T00:00:00Z', language: 'English',
    });
  });

  it('submit() with a replacement file includes it in the PUT body', () => {
    const file = new File(['contents'], 'new-flyer.pdf');
    component.handleFile({ target: { files: [file], value: '' } } as unknown as Event);
    component.submit();

    const req = httpMock.expectOne(apiUrl('traininghub/9'));
    const body = req.request.body as FormData;
    expect(body.get('file')).toBe(file);

    req.flush({
      oId: 9, roleId: null, title: 'Old title', category: 'Flyers', description: 'Old description',
      fileType: 'Pdf', fileName: 'new-flyer.pdf', length: null, uploadedBy: 'Admin', uploadedAt: '2026-08-06T00:00:00Z', language: 'English',
    });
  });
});
