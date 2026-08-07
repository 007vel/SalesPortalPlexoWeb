import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { RepProfile } from './rep-profile';
import { provideTestHttp, flushInitialReps } from '../testing/http-test-helpers';

describe('RepProfile', () => {
  let component: RepProfile;
  let fixture: ComponentFixture<RepProfile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RepProfile],
      providers: [provideTestHttp()],
    }).compileComponents();

    fixture = TestBed.createComponent(RepProfile);
    component = fixture.componentInstance;
    flushInitialReps();
    await fixture.whenStable();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
