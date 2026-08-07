import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { RepVideoDialog } from './rep-video-dialog';
import { TrainingResourceStore } from '../training-resource-store/training-resource-store';
import { provideTestHttp, flushInitialReps } from '../testing/http-test-helpers';

describe('RepVideoDialog', () => {
  let component: RepVideoDialog;
  let fixture: ComponentFixture<RepVideoDialog>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let trainingResourceStore: TrainingResourceStore;

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RepVideoDialog],
      providers: [{ provide: MatDialogRef, useValue: dialogRef }, provideTestHttp()],
    }).compileComponents();

    fixture = TestBed.createComponent(RepVideoDialog);
    component = fixture.componentInstance;
    trainingResourceStore = TestBed.inject(TrainingResourceStore);
    flushInitialReps();
    await fixture.whenStable();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('submit() requires a title', () => {
    component.submit();
    expect(component.validationError()).toBe('Give the video a title');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('submit() requires a file or url once a title is set', () => {
    component.form.controls.title.setValue('My video');
    component.submit();
    expect(component.validationError()).toBe('Choose a file or paste a video link');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('submit() adds the video and closes with true when valid', () => {
    component.form.setValue({ title: 'My video', category: '', duration: '', url: 'https://example.com/video', description: '' });
    component.submit();

    expect(trainingResourceStore.resources().length).toBe(1);
    expect(trainingResourceStore.resources()[0].title).toBe('My video');
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('cancel() closes with false', () => {
    component.cancel();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});
