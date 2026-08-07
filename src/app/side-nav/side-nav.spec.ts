import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';

import { SideNav } from './side-nav';
import { Auth } from '../auth/auth';
import { AdminAuth } from '../admin-auth/admin-auth';
import { provideTestHttp, flushInitialReps } from '../testing/http-test-helpers';

describe('SideNav', () => {
  let component: SideNav;
  let fixture: ComponentFixture<SideNav>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SideNav],
      providers: [provideRouter([]), provideTestHttp()],
    }).compileComponents();

    fixture = TestBed.createComponent(SideNav);
    component = fixture.componentInstance;
    flushInitialReps();
    await fixture.whenStable();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('defaults to rep mode', () => {
    expect(component.isAdmin()).toBe(false);
  });

  it('switches to admin mode when the mode input is set', () => {
    fixture.componentRef.setInput('mode', 'admin');
    expect(component.isAdmin()).toBe(true);
  });

  it('signOut() in rep mode logs out of Auth and navigates to /login', () => {
    const auth = TestBed.inject(Auth);
    const adminAuth = TestBed.inject(AdminAuth);
    const router = TestBed.inject(Router);
    const authLogout = vi.spyOn(auth, 'logout');
    const adminLogout = vi.spyOn(adminAuth, 'logout');
    const navigate = vi.spyOn(router, 'navigateByUrl');

    component.signOut();

    expect(authLogout).toHaveBeenCalled();
    expect(adminLogout).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('signOut() in admin mode logs out of AdminAuth and navigates to /login', () => {
    fixture.componentRef.setInput('mode', 'admin');

    const auth = TestBed.inject(Auth);
    const adminAuth = TestBed.inject(AdminAuth);
    const router = TestBed.inject(Router);
    const authLogout = vi.spyOn(auth, 'logout');
    const adminLogout = vi.spyOn(adminAuth, 'logout');
    const navigate = vi.spyOn(router, 'navigateByUrl');

    component.signOut();

    expect(adminLogout).toHaveBeenCalled();
    expect(authLogout).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
