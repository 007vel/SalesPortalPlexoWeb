import { TestBed } from '@angular/core/testing';
import { DocumentTemplateStore } from './document-template-store';

describe('DocumentTemplateStore', () => {
  let store: DocumentTemplateStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(DocumentTemplateStore);
  });

  it('should create', () => {
    expect(store).toBeTruthy();
  });

  it('starts with default template filenames', () => {
    expect(store.templates().agreement.name).toBe('Plexo_Representative_Agreement_Blank.pdf');
    expect(store.templates().w4.name).toBe('IRS_W4_Blank.pdf');
  });

  it('replace swaps only the given kind', () => {
    store.replace('agreement', 'Custom_Agreement.pdf');
    expect(store.templates().agreement.name).toBe('Custom_Agreement.pdf');
    expect(store.templates().w4.name).toBe('IRS_W4_Blank.pdf');
  });
});
