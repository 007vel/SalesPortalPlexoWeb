import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { MatStepper } from '@angular/material/stepper';
import { CreateRepDialog } from './create-rep-dialog';
import { provideTestHttp, flushInitialReps, apiUrl } from '../testing/http-test-helpers';

function stubStepper(): MatStepper {
  return { next: vi.fn() } as unknown as MatStepper;
}

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

  it('goToStep2() flags errors and does not advance when name/email are blank', () => {
    const stepper = stubStepper();
    component.goToStep2(stepper);
    expect(stepper.next).not.toHaveBeenCalled();
    expect(component.missingRequiredFields.name).toBe(true);
    expect(component.missingRequiredFields.email).toBe(true);
  });

  it('goToStep2() advances once name/email are valid', () => {
    component.infoForm.setValue({
      name: 'Jordan Reyes', businessName: '', email: 'jordan@example.com', phone: '', salesRepType: 'referralAgent', status: 'pending',
    });
    const stepper = stubStepper();
    component.goToStep2(stepper);
    expect(stepper.next).toHaveBeenCalled();
  });

  it('goToStep3() advances without validation — address fields are all optional', () => {
    const stepper = stubStepper();
    component.goToStep3(stepper);
    expect(stepper.next).toHaveBeenCalled();
  });

  it('goToStep4() advances without validation — bank fields are all optional', () => {
    const stepper = stubStepper();
    component.goToStep4(stepper);
    expect(stepper.next).toHaveBeenCalled();
  });

  it('submit() creates the rep, saves bank details, and closes the dialog with the created rep', () => {
    component.infoForm.setValue({
      name: 'Jordan Reyes', businessName: '', email: 'jordan@example.com', phone: '', salesRepType: 'referralAgent', status: 'pending',
    });
    component.bankForm.setValue({ bankName: 'First Bank', routingNumber: '111000025', accountNumber: '123456789' });
    component.submit();

    const createReq = httpMock.expectOne(apiUrl('reps'));
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual(
      expect.objectContaining({ passedCertification: false, businessCardsSent: false, consultantFeePaid: false }),
    );
    createReq.flush({
      oId: 1, repId: '1001', fullName: 'Jordan Reyes', businessName: null, email: 'jordan@example.com', phone: null,
      salesRepType: 0, address: null, city: null, state: null, zip: null, googleLink: null, resourceLink: null, status: 1,
      passedCertification: false, businessCardsSent: false, consultantFeePaid: false,
      createdAt: '2026-08-06T00:00:00Z', updatedAt: '2026-08-06T00:00:00Z',
    });

    const bankReq = httpMock.expectOne(apiUrl('repbankdetails'));
    expect(bankReq.request.method).toBe('POST');
    expect(bankReq.request.body).toEqual({
      repId: '1001', bankName: 'First Bank', routingNumber: '111000025', accountNumber: '123456789',
    });
    bankReq.flush({ oId: 1, repId: '1001', maskedAccountNumber: '****6789', updatedAt: '2026-08-06T00:00:00Z' });

    expect(dialogRef.close).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Jordan Reyes', email: 'jordan@example.com', repId: '1001' }),
    );
  });

  it('submit() closes the dialog even when bank details (and every other optional step) are left blank', () => {
    // Regression test: when there's nothing optional to follow up on, the switchMap must not
    // route through forkJoin([]) — that never emits, so the dialog would never close.
    component.infoForm.setValue({
      name: 'Jordan Reyes', businessName: '', email: 'jordan@example.com', phone: '', salesRepType: 'referralAgent', status: 'pending',
    });
    component.submit();

    const createReq = httpMock.expectOne(apiUrl('reps'));
    createReq.flush({
      oId: 1, repId: '1001', fullName: 'Jordan Reyes', businessName: null, email: 'jordan@example.com', phone: null,
      salesRepType: 0, address: null, city: null, state: null, zip: null, googleLink: null, resourceLink: null, status: 1,
      passedCertification: false, businessCardsSent: false, consultantFeePaid: false,
      createdAt: '2026-08-06T00:00:00Z', updatedAt: '2026-08-06T00:00:00Z',
    });

    // No api/repbankdetails (or any other follow-up) request should fire — httpMock.verify() in afterEach confirms it.
    expect(dialogRef.close).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Jordan Reyes', email: 'jordan@example.com', repId: '1001' }),
    );
  });

  it('cancel() closes with undefined', () => {
    component.cancel();
    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });
});
