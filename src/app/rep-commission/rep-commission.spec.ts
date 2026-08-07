import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { RepCommission } from './rep-commission';
import { provideTestHttp, flushInitialReps } from '../testing/http-test-helpers';

describe('RepCommission', () => {
  let component: RepCommission;
  let fixture: ComponentFixture<RepCommission>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RepCommission],
      providers: [provideTestHttp()],
    }).compileComponents();

    fixture = TestBed.createComponent(RepCommission);
    component = fixture.componentInstance;
    flushInitialReps();
    await fixture.whenStable();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
