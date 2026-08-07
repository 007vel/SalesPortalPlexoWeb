import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RepTrainingHub } from './rep-training-hub';

describe('RepTrainingHub', () => {
  let component: RepTrainingHub;
  let fixture: ComponentFixture<RepTrainingHub>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RepTrainingHub],
    }).compileComponents();

    fixture = TestBed.createComponent(RepTrainingHub);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
