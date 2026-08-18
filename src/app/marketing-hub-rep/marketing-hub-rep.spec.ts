import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { MarketingHubRep } from './marketing-hub-rep';
import { provideTestHttp, apiUrl } from '../testing/http-test-helpers';

describe('MarketingHubRep', () => {
  let component: MarketingHubRep;
  let fixture: ComponentFixture<MarketingHubRep>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketingHubRep],
      providers: [provideTestHttp()],
    }).compileComponents();

    fixture = TestBed.createComponent(MarketingHubRep);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function flushMarketing(): void {
    const req = httpMock.expectOne((r) => r.url === apiUrl('traininghub'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('hubType')).toBe('Marketing');
    req.flush([
      { oId: 20, roleId: null, title: 'Brochure', category: 'Flyers', description: 'A flyer', fileType: 'Pdf', fileName: 'brochure.pdf', length: null, uploadedBy: 'Admin', uploadedAt: '2026-08-06T00:00:00Z', language: 'English', hubType: 'Marketing' },
      { oId: 21, roleId: null, title: 'Sell sheet', category: 'Sell Sheets', description: 'A sell sheet', fileType: 'Pdf', fileName: 'sell-sheet.pdf', length: null, uploadedBy: 'Admin', uploadedAt: '2026-08-06T00:00:00Z', language: 'English', hubType: 'Marketing' },
    ]);
  }

  it('loads Marketing Hub resources on construction, regardless of sign-in state', async () => {
    flushMarketing();
    await fixture.whenStable();

    expect(component).toBeTruthy();
    expect(component.loaded()).toBe(true);
    expect(component.resources().length).toBe(2);
  });

  it('filteredResources() narrows down to the selected category', async () => {
    flushMarketing();
    await fixture.whenStable();

    expect(component.categories()).toEqual(['Flyers', 'Sell Sheets']);
    expect(component.filteredResources().length).toBe(2);

    component.categoryFilter.set('Sell Sheets');
    expect(component.filteredResources().map((r) => r.oId)).toEqual([21]);
  });
});
