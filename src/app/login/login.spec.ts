import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';

import { Login } from './login';
import { provideTestHttp, apiUrl } from '../testing/http-test-helpers';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideTestHttp()],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('Login (arriving via a portal link)', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideTestHttp(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ portalRepId: '1234' }) } } },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockImplementation(() => Promise.resolve(true));

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  it('hides the login form and auto-signs in without ever populating the form fields', () => {
    expect(component.portalRedirect()).toBe(true);
    expect(component.form.value.email).toBeFalsy();
    expect(component.form.value.repId).toBeFalsy();

    httpMock.expectOne(apiUrl('reps/validate/1234')).flush({ repId: '1234', email: 'jordan@example.com' });
    httpMock.expectOne(apiUrl('users/rep-login-validate')).flush({ isValid: true, message: 'match' });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/rep');
    expect(component.portalRedirect()).toBe(true);
  });

  it('falls back to the manual login form when the portal RepId is invalid', () => {
    httpMock.expectOne(apiUrl('reps/validate/1234')).flush(null, { status: 404, statusText: 'Not Found' });

    expect(component.portalRedirect()).toBe(false);
    expect(component.loginFailed()).toBe(true);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
