import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminSettings } from './admin-settings';
import { provideTestHttp } from '../testing/http-test-helpers';

describe('AdminSettings', () => {
  let component: AdminSettings;
  let fixture: ComponentFixture<AdminSettings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminSettings],
      providers: [provideTestHttp()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminSettings);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
