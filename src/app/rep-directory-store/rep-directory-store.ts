import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap, throwError } from 'rxjs';
import { Api } from '../api/api';
import { MOCK_CONFIG } from '../mock-config/mock-config';

export type RepStatus = 'active' | 'pending' | 'inactive';

export interface RepDocRecord {
  oId: number;
  name: string;
  uploadedAt: string;
}

export interface RepDocs {
  agreement: RepDocRecord | null;
  w4: RepDocRecord | null;
}

export interface CommissionDay {
  date: string;
  amount: number;
}

export interface RepRecord {
  oId: number;
  repId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  googleLink: string;
  resourceLink: string;
  status: RepStatus;
  docs: RepDocs;
  commissions: CommissionDay[];
  createdAt: string;
}

export interface NewRepInput {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: RepStatus;
}

/** Shape returned by GET/POST/PUT api/reps (PlexoRepPortal.Models.RepDto). */
interface RepDto {
  oId: number;
  repId: string;
  fullName: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  googleLink: string | null;
  resourceLink: string | null;
  status: number;
  createdAt: string;
  updatedAt: string;
}

/** Body shape for POST api/reps (RepCreateRequest). */
interface RepWriteDto {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  googleLink: string;
  resourceLink: string;
  status: number;
}

/** Body shape for PUT api/reps/{oId} (RepUpdateRequest) — the whole record, RepId included. */
interface RepUpdateDto extends RepWriteDto {
  repId: string;
}

/** Body shape for POST api/reps/link (RepLinkUpdateRequest). */
interface RepLinkUpdateDto {
  repsId: number;
  googleLink: string;
  resourceLink: string;
}

/** Shape returned by POST/GET api/documents (RepDocumentDto). */
interface RepDocumentDto {
  oId: number;
  repId: string;
  kind: string;
  fileName: string;
  uploadedAt: string;
}

const STATUS_TO_API: Record<RepStatus, number> = { inactive: 0, pending: 1, active: 2 };
const STATUS_FROM_API: RepStatus[] = ['inactive', 'pending', 'active'];

/** Last `days` calendar days ending today, each credited $0 — nothing's been credited yet. */
export function emptyCommissionHistory(days: number): CommissionDay[] {
  const out: CommissionDay[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push({ date: d.toISOString().slice(0, 10), amount: 0 });
  }
  return out;
}

export function repStatusBadge(status: RepStatus): { cssClass: string; label: string } {
  switch (status) {
    case 'active':
      return { cssClass: 'badge-active', label: 'Active' };
    case 'pending':
      return { cssClass: 'badge-pending', label: 'Pending' };
    case 'inactive':
      return { cssClass: 'badge-inactive', label: 'Inactive' };
  }
}

export function docsComplete(rep: Pick<RepRecord, 'docs'>): boolean {
  return !!(rep.docs.agreement && rep.docs.w4);
}

export function portalLink(repId: string): string {
  return MOCK_CONFIG.portalDomain + '/' + repId;
}

/**
 * The real multi-rep directory admin manages, backed by the PWR API
 * (`api/reps`, `api/documents`). Rep records carry `docs` (which of
 * agreement/w4 is filled, backed by `api/documents/rep/{repId}`) and
 * `commissions` — the backend doesn't model commissions yet, so that field
 * stays a local placeholder. `docs` starts empty for every rep until
 * `loadDocuments()` is called for it (see RepDocuments/AdminRepsDetials).
 */
@Injectable({ providedIn: 'root' })
export class RepDirectoryStore {
  private readonly api = inject(Api);
  private readonly repsSignal = signal<RepRecord[]>([]);
  private readonly loadingSignal = signal(false);

  readonly reps = this.repsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  constructor() {
    this.refresh().subscribe();
  }

  /** Re-fetches the directory from the backend. */
  refresh(): Observable<RepRecord[]> {
    this.loadingSignal.set(true);
    return this.api.get<RepDto[]>('reps').pipe(
      map((dtos) => dtos.map((dto) => this.mergeDto(dto))),
      tap((reps) => {
        this.repsSignal.set(reps);
        this.loadingSignal.set(false);
      }),
    );
  }

  findByRepId(repId: string): RepRecord | undefined {
    return this.reps().find((r) => r.repId === repId);
  }

  createRep(input: NewRepInput): Observable<RepRecord> {
    const body: RepWriteDto = {
      fullName: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      city: input.city,
      state: input.state,
      zip: input.zip,
      googleLink: '',
      resourceLink: '',
      status: STATUS_TO_API[input.status],
    };
    return this.api.post<RepDto>('reps', body).pipe(
      map((dto) => this.mergeDto(dto)),
      tap((rep) => this.repsSignal.update((list) => [rep, ...list])),
    );
  }

  updateStatus(repId: string, status: RepStatus): Observable<RepRecord> {
    return this.putRep(repId, { status });
  }

  /** POSTs just the two link fields via api/reps/link, identifying the rep by its plain RepId rather than the full record PUT requires. */
  updateLinksByRepId(repId: number, googleLink: string, resourceLink: string): Observable<RepRecord> {
    const body: RepLinkUpdateDto = { repsId: repId, googleLink, resourceLink };
    return this.api.post<RepDto>('reps/link', body).pipe(
      map((dto) => this.mergeDto(dto)),
      tap((updated) => this.repsSignal.update((list) => list.map((r) => (r.oId === updated.oId ? updated : r)))),
    );
  }

  /** Uploads a file for the given doc slot, replacing (and deleting) any previous upload in that slot. */
  setDocument(repId: string, kind: keyof RepDocs, file: File): Observable<RepDocRecord> {
    const rep = this.findByRepId(repId);
    if (!rep) return throwError(() => new Error('Rep not found'));

    const previous = rep.docs[kind];
    const formData = new FormData();
    formData.append('repId', rep.repId);
    formData.append('kind', kind);
    formData.append('file', file);

    return this.api.post<RepDocumentDto>('documents', formData).pipe(
      map((dto): RepDocRecord => ({ oId: dto.oId, name: dto.fileName, uploadedAt: dto.uploadedAt.slice(0, 10) })),
      tap((record) => {
        this.repsSignal.update((list) =>
          list.map((r) => (r.repId === repId ? { ...r, docs: { ...r.docs, [kind]: record } } : r)),
        );
        if (previous) this.api.delete(`documents/${previous.oId}`).subscribe();
      }),
    );
  }

  /** Fetches every document on file for a rep (via `api/documents/rep/{repId}`) and fills in its agreement/w4 slots. */
  loadDocuments(repId: string): Observable<RepDocs> {
    return this.api.get<RepDocumentDto[]>(`documents/rep/${repId}`).pipe(
      map((dtos): RepDocs => {
        const docs: RepDocs = { agreement: null, w4: null };
        for (const dto of dtos) {
          if (dto.kind === 'agreement' || dto.kind === 'w4') {
            docs[dto.kind] = { oId: dto.oId, name: dto.fileName, uploadedAt: dto.uploadedAt.slice(0, 10) };
          }
        }
        return docs;
      }),
      tap((docs) => this.repsSignal.update((list) => list.map((r) => (r.repId === repId ? { ...r, docs } : r)))),
    );
  }

  downloadDocument(oId: number): Observable<Blob> {
    return this.api.get(`documents/${oId}`, undefined, 'blob');
  }

  private putRep(repId: string, changes: Partial<Pick<RepRecord, 'status' | 'googleLink' | 'resourceLink'>>): Observable<RepRecord> {
    const rep = this.findByRepId(repId);
    if (!rep) return throwError(() => new Error('Rep not found'));

    const merged = { ...rep, ...changes };
    const body: RepUpdateDto = {
      repId: merged.repId,
      fullName: merged.name,
      email: merged.email,
      phone: merged.phone,
      address: merged.address,
      city: merged.city,
      state: merged.state,
      zip: merged.zip,
      googleLink: merged.googleLink,
      resourceLink: merged.resourceLink,
      status: STATUS_TO_API[merged.status],
    };
    return this.api.put<RepDto>(`reps/${rep.oId}`, body).pipe(
      map((dto) => this.mergeDto(dto)),
      tap((updated) => this.repsSignal.update((list) => list.map((r) => (r.oId === updated.oId ? updated : r)))),
    );
  }

  /** Maps a backend RepDto onto a RepRecord, preserving locally-tracked docs/commissions for a known rep. */
  private mergeDto(dto: RepDto): RepRecord {
    const existing = this.repsSignal().find((r) => r.oId === dto.oId);
    return {
      oId: dto.oId,
      repId: dto.repId,
      name: dto.fullName,
      email: dto.email,
      phone: dto.phone ?? '',
      address: dto.address ?? '',
      city: dto.city ?? '',
      state: dto.state ?? '',
      zip: dto.zip ?? '',
      googleLink: dto.googleLink ?? '',
      resourceLink: dto.resourceLink ?? '',
      status: STATUS_FROM_API[dto.status] ?? 'pending',
      docs: existing?.docs ?? { agreement: null, w4: null },
      commissions: existing?.commissions ?? emptyCommissionHistory(14),
      createdAt: dto.createdAt.slice(0, 10),
    };
  }
}
