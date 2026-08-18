import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { AdminRepsDetials } from './admin-reps-detials';
import { RepDirectoryStore } from '../rep-directory-store/rep-directory-store';
import { provideTestHttp, flushInitialReps, apiUrl } from '../testing/http-test-helpers';

function repDto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    oId: 1,
    repId: '1001',
    fullName: 'Jordan Reyes',
    email: 'jordan@example.com',
    phone: '',
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

describe('AdminRepsDetials', () => {
  let component: AdminRepsDetials;
  let fixture: ComponentFixture<AdminRepsDetials>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminRepsDetials],
      providers: [provideRouter([]), provideTestHttp()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should create for a rep not (yet) in the directory (no documents fetch fired)', async () => {
    fixture = TestBed.createComponent(AdminRepsDetials);
    fixture.componentRef.setInput('repId', '1001');
    component = fixture.componentInstance;
    flushInitialReps();
    httpMock.expectOne(apiUrl('traininghublinks')).flush([
      {
        oId: 1, productVideoEnglishLink: 'https://youtu.be/product-en', productVideoSpanishLink: 'https://youtu.be/product-es',
        dashboardVideoEnglishLink: 'https://youtu.be/dashboard-en', dashboardVideoSpanishLink: 'https://youtu.be/dashboard-es',
      },
    ]);
    await fixture.whenStable();

    expect(component).toBeTruthy();
  });

  it('fetches documents for the rep once it is present in the directory', async () => {
    const directory = TestBed.inject(RepDirectoryStore);
    flushInitialReps();

    directory
      .createRep({ name: 'Jordan Reyes', email: 'jordan@example.com', phone: '', salesRepType: 'referralAgent', address: '', city: '', state: '', zip: '', status: 'pending', passedCertification: false, businessCardStatus: 'notSent', consultantFeePaid: false })
      .subscribe();
    httpMock.expectOne(apiUrl('reps')).flush(repDto());

    fixture = TestBed.createComponent(AdminRepsDetials);
    fixture.componentRef.setInput('repId', '1001');
    component = fixture.componentInstance;
    httpMock.expectOne(apiUrl('traininghublinks')).flush([
      {
        oId: 1, productVideoEnglishLink: 'https://youtu.be/product-en', productVideoSpanishLink: 'https://youtu.be/product-es',
        dashboardVideoEnglishLink: 'https://youtu.be/dashboard-en', dashboardVideoSpanishLink: 'https://youtu.be/dashboard-es',
      },
    ]);
    await fixture.whenStable(); // lets the constructor's effect() run once so it fires the fetch

    const req = httpMock.expectOne(apiUrl('documents/rep/1001'));
    expect(req.request.method).toBe('GET');
    req.flush([{ oId: 5, repId: 1, kind: 'agreement', fileName: 'signed.pdf', uploadedAt: '2026-08-06T00:00:00Z' }]);

    httpMock.expectOne(apiUrl('repbankdetails/rep/1001')).flush(null, { status: 404, statusText: 'Not Found' });

    const trainingReq = httpMock.expectOne((r) => r.url === apiUrl('traininghub/filter') && r.params.get('roleId') === '1001');
    expect(trainingReq.request.method).toBe('GET');
    trainingReq.flush([
      { oId: 9, roleId: '1001', title: 'Renewal pitch', category: 'Team Uploads', description: '', fileType: 'Video', fileName: 'a.mp4', length: '12 min', uploadedBy: 'Rep', uploadedAt: '2026-08-06T00:00:00Z', language: 'English' },
    ]);
    await fixture.whenStable();

    expect(component.rep()?.docs.agreement).toEqual({ oId: 5, name: 'signed.pdf', uploadedAt: '2026-08-06' });
    expect(component.trainingResources()).toHaveLength(1);
  });

  it('saveLinks() identifies the rep by its plain RepId, not its database OId', async () => {
    // Regression test: rep.oId (1) and rep.repId ('1001') are deliberately different here so a
    // save that posts the wrong one is caught — the backend's api/reps/link endpoint matches on
    // RepId and 404s if OId is sent instead.
    const directory = TestBed.inject(RepDirectoryStore);
    flushInitialReps();

    directory
      .createRep({ name: 'Jordan Reyes', email: 'jordan@example.com', phone: '', salesRepType: 'referralAgent', address: '', city: '', state: '', zip: '', status: 'pending', passedCertification: false, businessCardStatus: 'notSent', consultantFeePaid: false })
      .subscribe();
    httpMock.expectOne(apiUrl('reps')).flush(repDto());

    fixture = TestBed.createComponent(AdminRepsDetials);
    fixture.componentRef.setInput('repId', '1001');
    component = fixture.componentInstance;
    httpMock.expectOne(apiUrl('traininghublinks')).flush([
      {
        oId: 1, productVideoEnglishLink: 'https://youtu.be/product-en', productVideoSpanishLink: 'https://youtu.be/product-es',
        dashboardVideoEnglishLink: 'https://youtu.be/dashboard-en', dashboardVideoSpanishLink: 'https://youtu.be/dashboard-es',
      },
    ]);
    await fixture.whenStable();

    httpMock.expectOne(apiUrl('documents/rep/1001')).flush([]);
    httpMock.expectOne(apiUrl('repbankdetails/rep/1001')).flush(null, { status: 404, statusText: 'Not Found' });
    httpMock.expectOne((r) => r.url === apiUrl('traininghub/filter') && r.params.get('roleId') === '1001').flush([]);
    await fixture.whenStable();

    component.startEditLinks();
    component.linksForm.setValue({
      googleLink: 'https://maps.google.com/x',
      resourceLink: '',
      pricingSheetLink: '',
      powerPointLink: '',
    });
    component.saveLinks();

    const req = httpMock.expectOne(apiUrl('reps/link'));
    expect(req.request.body.repsId).toBe(1001);
    req.flush(repDto({ googleLink: 'https://maps.google.com/x' }));
  });

  it('saveCertification() PUTs the toggled onboarding flags and exits edit mode', async () => {
    const directory = TestBed.inject(RepDirectoryStore);
    flushInitialReps();

    directory
      .createRep({ name: 'Jordan Reyes', email: 'jordan@example.com', phone: '', salesRepType: 'referralAgent', address: '', city: '', state: '', zip: '', status: 'pending', passedCertification: false, businessCardStatus: 'notSent', consultantFeePaid: false })
      .subscribe();
    httpMock.expectOne(apiUrl('reps')).flush(repDto({ passedCertification: false, businessCardStatus: 0, consultantFeePaid: false }));

    fixture = TestBed.createComponent(AdminRepsDetials);
    fixture.componentRef.setInput('repId', '1001');
    component = fixture.componentInstance;
    httpMock.expectOne(apiUrl('traininghublinks')).flush([
      {
        oId: 1, productVideoEnglishLink: 'https://youtu.be/product-en', productVideoSpanishLink: 'https://youtu.be/product-es',
        dashboardVideoEnglishLink: 'https://youtu.be/dashboard-en', dashboardVideoSpanishLink: 'https://youtu.be/dashboard-es',
      },
    ]);
    await fixture.whenStable();

    httpMock.expectOne(apiUrl('documents/rep/1001')).flush([]);
    httpMock.expectOne(apiUrl('repbankdetails/rep/1001')).flush(null, { status: 404, statusText: 'Not Found' });
    httpMock.expectOne((r) => r.url === apiUrl('traininghub/filter') && r.params.get('roleId') === '1001').flush([]);
    await fixture.whenStable();

    component.startEditCertification();
    component.certificationForm.setValue({ passedCertification: true, businessCardStatus: 'waitingApproval', consultantFeePaid: false });
    component.saveCertification();

    const req = httpMock.expectOne(apiUrl('reps/1'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(
      expect.objectContaining({ passedCertification: true, businessCardStatus: 1, consultantFeePaid: false }),
    );
    req.flush(repDto({ passedCertification: true, businessCardStatus: 1, consultantFeePaid: false }));

    expect(component.editingCertification()).toBe(false);
  });

  it('saveBankDetails() posts the new details, reloads them, and exits edit mode', async () => {
    const directory = TestBed.inject(RepDirectoryStore);
    flushInitialReps();

    directory
      .createRep({ name: 'Jordan Reyes', email: 'jordan@example.com', phone: '', salesRepType: 'referralAgent', address: '', city: '', state: '', zip: '', status: 'pending', passedCertification: false, businessCardStatus: 'notSent', consultantFeePaid: false })
      .subscribe();
    httpMock.expectOne(apiUrl('reps')).flush(repDto());

    fixture = TestBed.createComponent(AdminRepsDetials);
    fixture.componentRef.setInput('repId', '1001');
    component = fixture.componentInstance;
    httpMock.expectOne(apiUrl('traininghublinks')).flush([
      {
        oId: 1, productVideoEnglishLink: 'https://youtu.be/product-en', productVideoSpanishLink: 'https://youtu.be/product-es',
        dashboardVideoEnglishLink: 'https://youtu.be/dashboard-en', dashboardVideoSpanishLink: 'https://youtu.be/dashboard-es',
      },
    ]);
    await fixture.whenStable();

    httpMock.expectOne(apiUrl('documents/rep/1001')).flush([]);
    httpMock.expectOne(apiUrl('repbankdetails/rep/1001')).flush(null, { status: 404, statusText: 'Not Found' });
    httpMock.expectOne((r) => r.url === apiUrl('traininghub/filter') && r.params.get('roleId') === '1001').flush([]);
    await fixture.whenStable();

    component.startEditBankDetails();
    component.bankDetailsForm.setValue({ bankName: 'First Bank', routingNumber: '111000025', accountNumber: '123456789' });
    component.saveBankDetails();

    const postReq = httpMock.expectOne(apiUrl('repbankdetails'));
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({
      repId: '1001', bankName: 'First Bank', routingNumber: '111000025', accountNumber: '123456789',
    });
    postReq.flush({ oId: 1, repId: '1001', bankName: 'First Bank', routingNumber: '111000025', accountNumber: '123456789', updatedAt: '2026-08-10T00:00:00Z' });

    // setBankDetails() doesn't itself update the store, so a GET must follow to refresh rep.bankDetails.
    const getReq = httpMock.expectOne(apiUrl('repbankdetails/rep/1001'));
    expect(getReq.request.method).toBe('GET');
    getReq.flush({ oId: 1, repId: '1001', bankName: 'First Bank', routingNumber: '111000025', accountNumber: '123456789', updatedAt: '2026-08-10T00:00:00Z' });

    expect(component.editingBankDetails()).toBe(false);
    expect(component.rep()?.bankDetails).toEqual({
      bankName: 'First Bank', routingNumber: '111000025', accountNumber: '123456789', updatedAt: '2026-08-10',
    });
  });
});
