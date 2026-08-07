import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { AdminReps } from './admin-reps';
import { provideTestHttp, flushInitialReps } from '../testing/http-test-helpers';

describe('AdminReps', () => {
  let component: AdminReps;
  let fixture: ComponentFixture<AdminReps>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminReps],
      providers: [provideRouter([]), provideTestHttp()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminReps);
    component = fixture.componentInstance;
    flushInitialReps();
    await fixture.whenStable();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
