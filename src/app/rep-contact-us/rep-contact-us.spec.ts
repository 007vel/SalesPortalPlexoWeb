import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { RepContactUs } from './rep-contact-us';
import { provideTestHttp, flushInitialReps, apiUrl } from '../testing/http-test-helpers';

describe('RepContactUs', () => {
  let component: RepContactUs;
  let fixture: ComponentFixture<RepContactUs>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RepContactUs],
      providers: [provideTestHttp()],
    }).compileComponents();

    fixture = TestBed.createComponent(RepContactUs);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    flushInitialReps();
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('send() does nothing and marks the form touched when required fields are missing', () => {
    component.send();
    expect(component.sending()).toBe(false);
    expect(component.form.touched).toBe(true);
  });

  it('send() posts to the API and shows the success state', () => {
    component.form.setValue({ name: 'Jordan Reyes', email: 'jordan@example.com', message: 'Need help with my agreement.' });
    component.send();

    const req = httpMock.expectOne(apiUrl('support/contact-admin'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.name).toBe('Jordan Reyes');
    expect(req.request.body.email).toBe('jordan@example.com');
    expect(req.request.body.message).toBe('Need help with my agreement.');
    req.flush({});

    expect(component.sending()).toBe(false);
    expect(component.sent()).toBe(true);
  });

  it('send() shows an error state on failure', () => {
    component.form.setValue({ name: 'Jordan Reyes', email: 'jordan@example.com', message: 'Need help.' });
    component.send();

    httpMock.expectOne(apiUrl('support/contact-admin')).flush('error', { status: 500, statusText: 'Server Error' });

    expect(component.sending()).toBe(false);
    expect(component.sendFailed()).toBe(true);
    expect(component.sent()).toBe(false);
  });
});
