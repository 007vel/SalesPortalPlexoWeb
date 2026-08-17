import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { Api } from '../api/api';
import { MOCK_CONFIG } from '../mock-config/mock-config';

export type RepStatus = 'active' | 'pending' | 'inactive';

export type SalesRepType = 'referralAgent' | 'marketingConsultant';

export interface RepDocRecord {
  oId: number;
  name: string;
  uploadedAt: string;
}

export interface RepDocs {
  agreement: RepDocRecord | null;
  w4: RepDocRecord | null;
  certification: RepDocRecord | null;
  pricingSheet: RepDocRecord | null;
  powerPoint: RepDocRecord | null;
  /** How-to-access instructions for the rep's PWR Rewards email — admin-uploaded PDF, details view only. */
  pwrInstructions: RepDocRecord | null;
}

const EMPTY_DOCS: RepDocs = { agreement: null, w4: null, certification: null, pricingSheet: null, powerPoint: null, pwrInstructions: null };

/** A single document row across every rep — used by admin oversight views. */
export interface RepDocumentRecord {
  oId: number;
  repId: string;
  kind: string;
  fileName: string;
  uploadedAt: string;
}

export interface CommissionDay {
  date: string;
  amount: number;
}

export interface RepRecord {
  oId: number;
  repId: string;
  name: string;
  businessName: string;
  email: string;
  phone: string;
  salesRepType: SalesRepType;
  address: string;
  city: string;
  state: string;
  zip: string;
  googleLink: string;
  resourceLink: string;
  pricingSheetLink: string;
  powerPointLink: string;
  portalLink: string;
  status: RepStatus;
  passedCertification: boolean;
  businessCardsSent: boolean;
  consultantFeePaid: boolean;
  docs: RepDocs;
  bankDetails: RepBankDetails | null;
  commissions: CommissionDay[];
  createdAt: string;

  // ----- admin-only, set after creation — shown only on the admin Rep Details page -----
  contractWizardLink: string;
  contractWizardUsername: string;
  contractWizardPassword: string;
  contractWizardInstructionsLink: string;
  pwrRewardsEmail: string;
  pwrRewardsEmailPassword: string;
}

export interface NewRepInput {
  name: string;
  businessName?: string;
  email: string;
  phone: string;
  salesRepType: SalesRepType;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: RepStatus;
  passedCertification: boolean;
  businessCardsSent: boolean;
  consultantFeePaid: boolean;
  googleLink?: string;
  resourceLink?: string;
  pricingSheetLink?: string;
  powerPointLink?: string;
}

export interface NewRepBankDetails {
  bankName: string;
  routingNumber: string;
  accountNumber: string;
}

/** Bank details as returned for display — routing/account numbers are the full decrypted values, by explicit product decision. */
export interface RepBankDetails {
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  updatedAt: string;
}

/** Shape returned by GET/POST/PUT api/reps (PlexoRepPortal.Models.RepDto). */
interface RepDto {
  oId: number;
  repId: string;
  fullName: string;
  businessName: string | null;
  email: string;
  phone: string | null;
  salesRepType: number;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  googleLink: string | null;
  resourceLink: string | null;
  pricingSheetLink: string | null;
  powerPointLink: string | null;
  portalLink: string | null;
  status: number;
  passedCertification: boolean;
  businessCardsSent: boolean;
  consultantFeePaid: boolean;
  createdAt: string;
  updatedAt: string;
  contractWizardLink: string | null;
  contractWizardUsername: string | null;
  contractWizardPassword: string | null;
  contractWizardInstructionsLink: string | null;
  pwrRewardsEmail: string | null;
  pwrRewardsEmailPassword: string | null;
}

/** Body shape for POST api/reps (RepCreateRequest). */
interface RepWriteDto {
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  salesRepType: number;
  address: string;
  city: string;
  state: string;
  zip: string;
  googleLink: string;
  resourceLink: string;
  pricingSheetLink: string;
  powerPointLink: string;
  status: number;
  passedCertification: boolean;
  businessCardsSent: boolean;
  consultantFeePaid: boolean;
}

/** Body shape for POST api/repbankdetails (RepBankDetailsRequest). */
interface RepBankDetailsWriteDto {
  repId: string;
  bankName: string;
  routingNumber: string;
  accountNumber: string;
}

/** Shape returned by GET api/repbankdetails/rep/{repId} (RepBankDetailsDto) — full decrypted routing/account numbers. */
interface RepBankDetailsDto {
  oId: number;
  repId: string;
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  updatedAt: string;
}

/** Body shape for PUT api/reps/{oId} (RepUpdateRequest) — the whole record, RepId included. */
interface RepUpdateDto extends RepWriteDto {
  repId: string;
  contractWizardLink: string;
  contractWizardUsername: string;
  contractWizardPassword: string;
  contractWizardInstructionsLink: string;
  pwrRewardsEmail: string;
  pwrRewardsEmailPassword: string;
}

/** Body shape for POST api/reps/link (RepLinkUpdateRequest). */
interface RepLinkUpdateDto {
  repsId: number;
  googleLink: string;
  resourceLink: string;
  pricingSheetLink: string;
  powerPointLink: string;
}

export interface RepLinks {
  googleLink: string;
  resourceLink: string;
  pricingSheetLink: string;
  powerPointLink: string;
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

const SALES_REP_TYPE_TO_API: Record<SalesRepType, number> = { referralAgent: 0, marketingConsultant: 1 };
const SALES_REP_TYPE_FROM_API: SalesRepType[] = ['referralAgent', 'marketingConsultant'];

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

export function salesRepTypeLabel(type: SalesRepType): string {
  return type === 'marketingConsultant' ? 'Marketing Consultant' : 'Referral Agent';
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

  /**
   * Fetches a filtered view via `api/reps/filter` — every param is optional and combines with AND.
   * Deliberately does NOT touch `repsSignal`: it returns the filtered list for a caller (the admin
   * reps list) to hold locally, so the app-wide directory other pages rely on (e.g. rep detail pages
   * resolving `findByRepId`) never loses reps that a filter would otherwise hide.
   */
  filterReps(filters: { status?: RepStatus; salesRepType?: SalesRepType; search?: string }): Observable<RepRecord[]> {
    const params: Record<string, string | number> = {};
    if (filters.status) params['status'] = STATUS_TO_API[filters.status];
    if (filters.salesRepType) params['salesRepType'] = SALES_REP_TYPE_TO_API[filters.salesRepType];
    if (filters.search) params['search'] = filters.search;

    return this.api.get<RepDto[]>('reps/filter', params).pipe(map((dtos) => dtos.map((dto) => this.mergeDto(dto))));
  }

  createRep(input: NewRepInput): Observable<RepRecord> {
    const body: RepWriteDto = {
      fullName: input.name,
      businessName: input.businessName ?? '',
      email: input.email,
      phone: input.phone,
      salesRepType: SALES_REP_TYPE_TO_API[input.salesRepType],
      address: input.address,
      city: input.city,
      state: input.state,
      zip: input.zip,
      googleLink: input.googleLink ?? '',
      resourceLink: input.resourceLink ?? '',
      pricingSheetLink: input.pricingSheetLink ?? '',
      powerPointLink: input.powerPointLink ?? '',
      status: STATUS_TO_API[input.status],
      passedCertification: input.passedCertification,
      businessCardsSent: input.businessCardsSent,
      consultantFeePaid: input.consultantFeePaid,
    };
    return this.api.post<RepDto>('reps', body).pipe(
      map((dto) => this.mergeDto(dto)),
      tap((rep) => this.repsSignal.update((list) => [rep, ...list])),
    );
  }

  /** Encrypts and saves (or replaces) the one bank-details record on file for a rep — see api/repbankdetails. */
  setBankDetails(repId: string, details: NewRepBankDetails): Observable<void> {
    const body: RepBankDetailsWriteDto = {
      repId,
      bankName: details.bankName,
      routingNumber: details.routingNumber,
      accountNumber: details.accountNumber,
    };
    return this.api.post('repbankdetails', body).pipe(map(() => undefined));
  }

  /** Fetches the bank details on file for a rep, if any — via `api/repbankdetails/rep/{repId}`. Resolves `null` rather than erroring when the rep has none on file yet. */
  loadBankDetails(repId: string): Observable<RepBankDetails | null> {
    return this.api.get<RepBankDetailsDto>(`repbankdetails/rep/${repId}`).pipe(
      map(
        (dto): RepBankDetails => ({
          bankName: dto.bankName,
          routingNumber: dto.routingNumber,
          accountNumber: dto.accountNumber,
          updatedAt: dto.updatedAt.slice(0, 10),
        }),
      ),
      catchError((err: HttpErrorResponse) => (err.status === 404 ? of(null) : throwError(() => err))),
      tap((bankDetails) => this.repsSignal.update((list) => list.map((r) => (r.repId === repId ? { ...r, bankDetails } : r)))),
    );
  }

  updateStatus(repId: string, status: RepStatus): Observable<RepRecord> {
    return this.updateRep(repId, { status });
  }

  /** POSTs just the link fields via api/reps/link, identifying the rep by its plain RepId rather than the full record PUT requires. */
  updateLinksByRepId(repId: number, links: RepLinks): Observable<RepRecord> {
    const body: RepLinkUpdateDto = { repsId: repId, ...links };
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

  /** Removes the file in the given doc slot with no replacement. */
  deleteDocument(repId: string, kind: keyof RepDocs): Observable<void> {
    const rep = this.findByRepId(repId);
    const doc = rep?.docs[kind];
    if (!rep || !doc) return of(undefined);

    return this.api.delete<void>(`documents/${doc.oId}`).pipe(
      tap(() => {
        this.repsSignal.update((list) =>
          list.map((r) => (r.repId === repId ? { ...r, docs: { ...r.docs, [kind]: null } } : r)),
        );
      }),
    );
  }

  /** Fetches every document on file for a rep (via `api/documents/rep/{repId}`) and fills in its agreement/w4 slots. */
  loadDocuments(repId: string): Observable<RepDocs> {
    return this.api.get<RepDocumentDto[]>(`documents/rep/${repId}`).pipe(
      map((dtos): RepDocs => {
        const docs: RepDocs = { ...EMPTY_DOCS };
        for (const dto of dtos) {
          if (dto.kind === 'agreement' || dto.kind === 'w4' || dto.kind === 'certification' || dto.kind === 'pricingSheet' || dto.kind === 'powerPoint' || dto.kind === 'pwrInstructions') {
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

  /** Fetches every document uploaded by every rep (via `api/documents`) — used by admin oversight. */
  loadAllDocuments(): Observable<RepDocumentRecord[]> {
    return this.api.get<RepDocumentDto[]>('documents').pipe(
      map((dtos) => dtos.map((dto) => ({ oId: dto.oId, repId: dto.repId, kind: dto.kind, fileName: dto.fileName, uploadedAt: dto.uploadedAt }))),
    );
  }

  /** Deletes a rep permanently via `api/reps/{oId}` and drops it from the in-memory directory. */
  deleteRep(oId: number): Observable<void> {
    return this.api.delete<void>(`reps/${oId}`).pipe(
      tap(() => this.repsSignal.update((list) => list.filter((r) => r.oId !== oId))),
    );
  }

  /** PUTs the whole rep record — RepId included — merging `changes` over the currently-known rep. Every field must round-trip on every save since the endpoint replaces the full record. */
  updateRep(repId: string, changes: Partial<RepRecord>): Observable<RepRecord> {
    const rep = this.findByRepId(repId);
    if (!rep) return throwError(() => new Error('Rep not found'));

    const merged = { ...rep, ...changes };
    const body: RepUpdateDto = {
      repId: merged.repId,
      fullName: merged.name,
      businessName: merged.businessName,
      email: merged.email,
      phone: merged.phone,
      salesRepType: SALES_REP_TYPE_TO_API[merged.salesRepType],
      address: merged.address,
      city: merged.city,
      state: merged.state,
      zip: merged.zip,
      googleLink: merged.googleLink,
      resourceLink: merged.resourceLink,
      pricingSheetLink: merged.pricingSheetLink,
      powerPointLink: merged.powerPointLink,
      status: STATUS_TO_API[merged.status],
      passedCertification: merged.passedCertification,
      businessCardsSent: merged.businessCardsSent,
      consultantFeePaid: merged.consultantFeePaid,
      contractWizardLink: merged.contractWizardLink,
      contractWizardUsername: merged.contractWizardUsername,
      contractWizardPassword: merged.contractWizardPassword,
      contractWizardInstructionsLink: merged.contractWizardInstructionsLink,
      pwrRewardsEmail: merged.pwrRewardsEmail,
      pwrRewardsEmailPassword: merged.pwrRewardsEmailPassword,
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
      businessName: dto.businessName ?? '',
      email: dto.email,
      phone: dto.phone ?? '',
      salesRepType: SALES_REP_TYPE_FROM_API[dto.salesRepType] ?? 'referralAgent',
      address: dto.address ?? '',
      city: dto.city ?? '',
      state: dto.state ?? '',
      zip: dto.zip ?? '',
      googleLink: dto.googleLink ?? '',
      resourceLink: dto.resourceLink ?? '',
      pricingSheetLink: dto.pricingSheetLink ?? '',
      powerPointLink: dto.powerPointLink ?? '',
      portalLink: dto.portalLink ?? '',
      status: STATUS_FROM_API[dto.status] ?? 'pending',
      passedCertification: dto.passedCertification,
      businessCardsSent: dto.businessCardsSent,
      consultantFeePaid: dto.consultantFeePaid,
      docs: existing?.docs ?? { ...EMPTY_DOCS },
      bankDetails: existing?.bankDetails ?? null,
      commissions: existing?.commissions ?? emptyCommissionHistory(14),
      createdAt: dto.createdAt.slice(0, 10),
      contractWizardLink: dto.contractWizardLink ?? '',
      contractWizardUsername: dto.contractWizardUsername ?? '',
      contractWizardPassword: dto.contractWizardPassword ?? '',
      contractWizardInstructionsLink: dto.contractWizardInstructionsLink ?? '',
      pwrRewardsEmail: dto.pwrRewardsEmail ?? '',
      pwrRewardsEmailPassword: dto.pwrRewardsEmailPassword ?? '',
    };
  }
}
