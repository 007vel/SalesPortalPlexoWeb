import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { CreateRepDialog } from './create-rep-dialog';
import { provideTestHttp, flushInitialReps, apiUrl } from '../testing/http-test-helpers';

describe('CreateRepDialog', () => {
  let component: CreateRepDialog;
  let fixture: ComponentFixture<CreateRepDialog>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CreateRepDialog],
      providers: [{ provide: MatDialogRef, useValue: dialogRef }, provideTestHttp()],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateRepDialog);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    flushInitialReps();
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('submit() does nothing and flags errors when name/email are blank', () => {
    component.submit();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.missingRequiredFields.name).toBe(true);
    expect(component.missingRequiredFields.email).toBe(true);
  });

  it('submit() posts the new rep and closes with it when valid', () => {
    component.form.setValue({
      name: 'Jordan Reyes', email: 'jordan@example.com', phone: '', address: '', city: '', state: '', zip: '', status: 'pending',
    });
    component.submit();

    const req = httpMock.expectOne(apiUrl('reps'));
    expect(req.request.method).toBe('POST');
    req.flush({
      oId: 1, repId: '1001', fullName: 'Jordan Reyes', email: 'jordan@example.com', phone: null, address: null,
      city: null, state: null, zip: null, googleLink: null, resourceLink: null, status: 1,
      createdAt: '2026-08-06T00:00:00Z', updatedAt: '2026-08-06T00:00:00Z',
    });

    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ name: 'Jordan Reyes', email: 'jordan@example.com' }));
  });

  it('cancel() closes with undefined', () => {
    component.cancel();
    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });
});
