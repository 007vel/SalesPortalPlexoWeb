import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, switchMap, tap } from 'rxjs';
import { Api } from '../api/api';

export interface TrainingHubLinks {
  oId: number;
  productVideoEnglishLink: string | null;
  productVideoSpanishLink: string | null;
  dashboardVideoEnglishLink: string | null;
  dashboardVideoSpanishLink: string | null;
  knowledgeBaseLink: string | null;
  salesLeadLink: string | null;
}

export type TrainingHubLinksInput = Omit<TrainingHubLinks, 'oId'>;

export interface VideoLinkRow {
  key: string;
  label: string;
  url: string;
}

/** Flattens the 4 fixed video link fields into display rows — shared by admin-settings' read view, rep-training-hub, and admin-reps-detials so they don't drift. */
export function videoLinkRows(links: TrainingHubLinks): VideoLinkRow[] {
  return [
    { key: 'productVideoEn', label: 'Product Video (English)', url: links.productVideoEnglishLink ?? '' },
    { key: 'productVideoEs', label: 'Product Video (Spanish)', url: links.productVideoSpanishLink ?? '' },
    { key: 'dashboardVideoEn', label: 'Dashboard Video (English)', url: links.dashboardVideoEnglishLink ?? '' },
    { key: 'dashboardVideoEs', label: 'Dashboard Video (Spanish)', url: links.dashboardVideoSpanishLink ?? '' },
  ];
}

/**
 * The 4 YouTube links shown in the Training & Resource Hub's video slots — a single admin-edited
 * row (api/traininghublinks), seeded once on the backend, not a per-rep or per-upload record.
 */
@Injectable({ providedIn: 'root' })
export class TrainingHubLinksStore {
  private readonly api = inject(Api);
  private readonly linksSignal = signal<TrainingHubLinks | null>(null);

  readonly links = this.linksSignal.asReadonly();

  /**
   * Fetches the single links row — normally seeded once by the backend deployment script, but
   * falls back to creating it here if that seed never ran (e.g. a fresh/unseeded database),
   * so the admin isn't stuck with a permanently-empty row that can't be edited.
   */
  load(): Observable<TrainingHubLinks> {
    return this.api.get<TrainingHubLinks[]>('traininghublinks').pipe(
      switchMap((rows) => (rows[0] ? of(rows[0]) : this.create())),
      tap((links) => this.linksSignal.set(links)),
    );
  }

  update(oId: number, input: TrainingHubLinksInput): Observable<TrainingHubLinks> {
    return this.api.put<TrainingHubLinks>(`traininghublinks/${oId}`, input).pipe(
      tap((links) => this.linksSignal.set(links)),
    );
  }

  private create(): Observable<TrainingHubLinks> {
    return this.api.post<TrainingHubLinks>('traininghublinks', {
      productVideoEnglishLink: '',
      productVideoSpanishLink: '',
      dashboardVideoEnglishLink: '',
      dashboardVideoSpanishLink: '',
      knowledgeBaseLink: '',
      salesLeadLink: '',
    });
  }
}
