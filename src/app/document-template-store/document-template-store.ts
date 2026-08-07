import { Injectable, signal } from '@angular/core';
import { MOCK_CONFIG } from '../mock-config/mock-config';

export type DocTemplateKind = 'agreement' | 'w4';

export interface DocTemplate {
  name: string;
}

export type DocTemplates = Record<DocTemplateKind, DocTemplate>;

function defaultTemplates(): DocTemplates {
  const { defaultDocTemplates } = MOCK_CONFIG;
  return {
    agreement: { name: defaultDocTemplates.agreement },
    w4: { name: defaultDocTemplates.w4 },
  };
}

/** The blank document templates offered to every rep — admin can replace them. */
@Injectable({ providedIn: 'root' })
export class DocumentTemplateStore {
  private readonly templatesSignal = signal<DocTemplates>(defaultTemplates());

  readonly templates = this.templatesSignal.asReadonly();

  replace(kind: DocTemplateKind, name: string): void {
    this.templatesSignal.update((t) => ({ ...t, [kind]: { name } }));
  }
}
