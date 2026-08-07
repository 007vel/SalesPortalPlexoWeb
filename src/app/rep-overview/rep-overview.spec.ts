import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { RepOverview } from './rep-overview';
import { provideTestHttp, flushInitialReps } from '../testing/http-test-helpers';

describe('RepOverview', () => {
  let component: RepOverview;
  let fixture: ComponentFixture<RepOverview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RepOverview],
      providers: [provideRouter([]), provideTestHttp()],
    }).compileComponents();

    fixture = TestBed.createComponent(RepOverview);
    component = fixture.componentInstance;
    flushInitialReps();
    await fixture.whenStable();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
