import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { RepTrainingHub } from './rep-training-hub';
import { Auth } from '../auth/auth';
import { provideTestHttp, apiUrl } from '../testing/http-test-helpers';

describe('RepTrainingHub', () => {
  let component: RepTrainingHub;
  let fixture: ComponentFixture<RepTrainingHub>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RepTrainingHub],
      providers: [provideTestHttp()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('creates with no active session (no fetch fired)', async () => {
    fixture = TestBed.createComponent(RepTrainingHub);
    component = fixture.componentInstance;
    await fixture.whenStable();

    expect(component).toBeTruthy();
  });

  it('fetches the signed-in rep\'s training hub documents by RepId', async () => {
    const auth = TestBed.inject(Auth);
    auth.login('jordan@example.com', '1001').subscribe();
    httpMock.expectOne(apiUrl('users/rep-login-validate')).flush({ isValid: true, message: 'match' });

    fixture = TestBed.createComponent(RepTrainingHub);
    component = fixture.componentInstance;
    await fixture.whenStable();

    const req = httpMock.expectOne((r) => r.url === apiUrl('traininghub/filter'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('roleId')).toBe('1001');
    expect(req.request.params.get('includeAdmin')).toBe('true');
    req.flush([]);
  });
});
