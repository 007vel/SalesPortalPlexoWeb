import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarketingHubAdmin } from './marketing-hub-admin';

describe('MarketingHubAdmin', () => {
  let component: MarketingHubAdmin;
  let fixture: ComponentFixture<MarketingHubAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketingHubAdmin],
    }).compileComponents();

    fixture = TestBed.createComponent(MarketingHubAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
