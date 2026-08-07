import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { RepVideoDialog } from './rep-video-dialog';
import { Auth } from '../auth/auth';
import { TrainingResourceStore } from '../training-resource-store/training-resource-store';
import { provideTestHttp, apiUrl } from '../testing/http-test-helpers';

describe('RepVideoDialog', () => {
  let component: RepVideoDialog;
  let fixture: ComponentFixture<RepVideoDialog>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let trainingResourceStore: TrainingResourceStore;
  let httpMock: HttpTestingController;

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
    expect(component.validationError()).toBe('Give it a title');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('submit() requires a file once a title is set', () => {
    component.form.controls.title.setValue('My upload');
    component.submit();
    expect(component.validationError()).toBe('Choose a file to upload');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('submit() requires an active session once a title and file are set', () => {
    component.handleFile({ target: { files: [new File(['a'], 'onboarding.pdf')], value: '' } } as unknown as Event);
    component.submit();
    expect(component.validationError()).toBe('You must be signed in to upload');
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

    const file = new File(['contents'], 'renewal-pitch.mp4');
    component.handleFile({ target: { files: [file], value: '' } } as unknown as Event);
    component.submit();

    const req = httpMock.expectOne(apiUrl('traininghub'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    const body = req.request.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('roleId')).toBe('1001');

    req.flush({
      oId: 1, roleId: '1001', title: 'renewal-pitch', category: 'Team Uploads', description: '',
      fileType: 'Video', fileName: 'renewal-pitch.mp4', length: '', uploadedAt: '2026-08-06T00:00:00Z',
    });

    expect(trainingResourceStore.resources().length).toBe(1);
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('cancel() closes with false', () => {
    component.cancel();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});
