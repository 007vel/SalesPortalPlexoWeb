import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { MarketingHubAdmin } from './marketing-hub-admin';
import { provideTestHttp, apiUrl } from '../testing/http-test-helpers';

describe('MarketingHubAdmin', () => {
  let component: MarketingHubAdmin;
  let fixture: ComponentFixture<MarketingHubAdmin>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketingHubAdmin],
      providers: [provideTestHttp()],
    }).compileComponents();

    fixture = TestBed.createComponent(MarketingHubAdmin);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function flushMarketing(): void {
    const req = httpMock.expectOne((r) => r.url === apiUrl('traininghub'));
    expect(req.request.params.get('hubType')).toBe('Marketing');
    req.flush([
      { oId: 20, roleId: null, title: 'Brochure', category: 'Flyers', description: 'A flyer', fileType: 'Pdf', fileName: 'brochure.pdf', length: null, uploadedBy: 'Admin', uploadedAt: '2026-08-06T00:00:00Z', language: 'English', hubType: 'Marketing' },
      { oId: 21, roleId: null, title: 'Sell sheet', category: 'Sell Sheets', description: 'A sell sheet', fileType: 'Pdf', fileName: 'sell-sheet.pdf', length: null, uploadedBy: 'Admin', uploadedAt: '2026-08-06T00:00:00Z', language: 'English', hubType: 'Marketing' },
      { oId: 22, roleId: null, title: 'Second flyer', category: 'Flyers', description: 'Another flyer', fileType: 'Pdf', fileName: 'flyer-2.pdf', length: null, uploadedBy: 'Admin', uploadedAt: '2026-08-06T00:00:00Z', language: 'English', hubType: 'Marketing' },
    ]);
  }

  function flushHubLinks(): void {
    httpMock.expectOne(apiUrl('traininghublinks')).flush([
      {
        oId: 1, productVideoEnglishLink: 'https://youtu.be/product-en', productVideoSpanishLink: 'https://youtu.be/product-es',
        dashboardVideoEnglishLink: 'https://youtu.be/dashboard-en', dashboardVideoSpanishLink: 'https://youtu.be/dashboard-es',
        knowledgeBaseLink: null, salesLeadLink: null,
      },
    ]);
  }

  it('loads only Marketing Hub resources on construction', async () => {
    flushMarketing();
    flushHubLinks();
    await fixture.whenStable();

    expect(component).toBeTruthy();
    expect(component.loaded()).toBe(true);
    expect(component.resources().length).toBe(3);
    expect(component.resources()[0]).toMatchObject({ title: 'Brochure', oId: 20, uploadedBy: 'Admin' });
  });

  it('categories() lists each distinct category once, sorted', async () => {
    flushMarketing();
    flushHubLinks();
    await fixture.whenStable();

    expect(component.categories()).toEqual(['Flyers', 'Sell Sheets']);
  });

  it('filteredResources() defaults to showing everything, and narrows down once a category is picked', async () => {
    flushMarketing();
    flushHubLinks();
    await fixture.whenStable();

    expect(component.filteredResources().length).toBe(3);

    component.categoryFilter.set('Flyers');
    expect(component.filteredResources().map((r) => r.oId).sort()).toEqual([20, 22]);

    component.categoryFilter.set('all');
    expect(component.filteredResources().length).toBe(3);
  });

  it('marks itself loaded even if the request fails', async () => {
    const req = httpMock.expectOne((r) => r.url === apiUrl('traininghub'));
    req.flush('error', { status: 500, statusText: 'Server Error' });
    flushHubLinks();
    await fixture.whenStable();

    expect(component.loaded()).toBe(true);
    expect(component.resources()).toEqual([]);
  });
});
