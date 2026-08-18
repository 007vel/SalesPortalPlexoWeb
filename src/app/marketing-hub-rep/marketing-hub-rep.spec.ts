import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarketingHubRep } from './marketing-hub-rep';

describe('MarketingHubRep', () => {
  let component: MarketingHubRep;
  let fixture: ComponentFixture<MarketingHubRep>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketingHubRep],
    }).compileComponents();

    fixture = TestBed.createComponent(MarketingHubRep);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
