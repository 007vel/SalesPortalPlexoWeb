import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, of, tap } from 'rxjs';
import { Api } from '../api/api';

export type TrainingResourceType = 'video' | 'youtube' | 'image' | 'pdf' | 'doc' | 'link';
export type TrainingResourceLanguage = 'English' | 'Spanish';
export type HubType = 'Training' | 'Marketing';

export interface TrainingResource {
  id: string;
  oId: number;
  /** The RepId of the rep who uploaded this resource. */
  repId: string;
  /** Who uploaded this — used to separate Admin-shared material from a rep's own uploads in the UI. */
  uploadedBy: 'Admin' | 'Rep';
  title: string;
  category: string;
  type: TrainingResourceType;
  duration: string;
  featured: boolean;
  description: string;
  url: string;
  fileName: string;
  language: TrainingResourceLanguage;
}

export interface NewTrainingHubUpload {
  title: string;
  category: string;
  length: string;
  description: string;
  /** The uploading rep's RepId — the backend filters retrieval by this same value. Omitted for Admin uploads, which are stored with a null RoleId. */
  roleId?: string;
  /** Who uploaded this — the backend requires it to be 'Rep' or 'Admin'. */
  uploadedBy: 'Admin' | 'Rep';
  language: TrainingResourceLanguage;
  /** Omit for Training Hub uploads (server defaults to 'Training'); pass 'Marketing' for Marketing Hub uploads. */
  hubType?: HubType;
}

export interface TrainingHubEdit {
  title: string;
  category: string;
  length: string;
  description: string;
  language: TrainingResourceLanguage;
}

/** Shape returned by POST/GET api/traininghub (PlexoRepPortal.Models.TrainingHubDocumentDto). */
interface TrainingHubDocumentDto {
  oId: number;
  roleId: string | null;
  title: string;
  category: string | null;
  description: string | null;
  fileType: string;
  fileName: string;
  length: string | null;
  uploadedBy: string;
  uploadedAt: string;
  language: string;
  hubType: string;
}

const TYPE_ICON: Record<TrainingResourceType, string> = { video: 'movie', youtube: 'smart_display', image: 'image', pdf: 'description', doc: 'article', link: 'link' };
const TYPE_LABEL: Record<TrainingResourceType, string> = { video: 'Video', youtube: 'Video', image: 'Image', pdf: 'PDF', doc: 'Guide', link: 'Link' };
const FILE_TYPE_TO_RESOURCE_TYPE: Record<string, TrainingResourceType> = { Video: 'video', Image: 'image', Pdf: 'pdf', Document: 'doc' };
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'm4v'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];

export function trainingResourceTypeIcon(type: TrainingResourceType): string {
  return TYPE_ICON[type] ?? 'school';
}

export function trainingResourceTypeLabel(type: TrainingResourceType): string {
  return TYPE_LABEL[type] ?? 'Open';
}

/** Guesses a viewer-relevant type from a file's extension — used for plain uploads (agreement/W-4) that don't carry a `TrainingResourceType` from the backend. */
export function detectFileKind(fileName: string): TrainingResourceType {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (VIDEO_EXTENSIONS.includes(extension)) return 'video';
  if (IMAGE_EXTENSIONS.includes(extension)) return 'image';
  if (extension === 'pdf') return 'pdf';
  return 'doc';
}

/**
 * The Training & Resource Hub's "Shared by Admin" material is a fixed set of slots — not a
 * free-form upload list — matched to whatever's actually been uploaded by `category`. Defined once
 * here so admin-settings (which can upload/replace), admin-reps-detials, and rep-training-hub (both
 * read-only) all agree on the same slots instead of drifting.
 *
 * The 4 product/dashboard videos are NOT here — those are YouTube links, not uploaded files, so
 * they're admin-edited via TrainingHubLinksStore instead. Only the 2 PDF slots remain file-based.
 */
export interface HubSlotDef {
  key: string;
  label: string;
  category: string;
  language: TrainingResourceLanguage;
  accept: string;
  icon: string;
}

export const HUB_SLOTS: HubSlotDef[] = [
  { key: 'trainingMaterial', label: 'Training Material (PDF)', category: 'Training Material', language: 'English', accept: '.pdf', icon: 'picture_as_pdf' },
  { key: 'faq', label: 'FAQ (PDF)', category: 'FAQ', language: 'English', accept: '.pdf', icon: 'picture_as_pdf' },
];

/** Matches each fixed slot to its uploaded resource (if any) by category. `resources` should already be Admin-only. */
export function matchHubSlots(resources: TrainingResource[]): (HubSlotDef & { resource: TrainingResource | null })[] {
  return HUB_SLOTS.map((def) => ({ ...def, resource: resources.find((r) => r.category === def.category) ?? null }));
}

/**
 * The team-wide Training & Resource Hub library — real files (video/image/pdf/etc)
 * reps upload, backed by `api/traininghub`. Reps see their own uploads
 * (`loadForRole`); admin can browse every rep's uploads at once (`loadAll`).
 */
@Injectable({ providedIn: 'root' })
export class TrainingResourceStore {
  private readonly api = inject(Api);
  private readonly resourcesSignal = signal<TrainingResource[]>([]);

  readonly resources = this.resourcesSignal.asReadonly();

  /** Fetches every training hub document uploaded under the given RepId. */
  loadForRole(roleId: string): Observable<TrainingResource[]> {
    return this.api.get<TrainingHubDocumentDto[]>(`traininghub/role/${roleId}`).pipe(
      map((dtos) => dtos.map((dto) => this.mapDto(dto))),
      tap((docs) => this.resourcesSignal.set(docs)),
    );
  }

  /** Fetches every training hub document across every rep — used by admin oversight. */
  loadAll(): Observable<TrainingResource[]> {
    return this.api.get<TrainingHubDocumentDto[]>('traininghub').pipe(
      map((dtos) => dtos.map((dto) => this.mapDto(dto))),
      tap((docs) => this.resourcesSignal.set(docs)),
    );
  }

  /** Fetches only the documents Admin uploaded (RoleId is null) — used by the Admin Settings training hub. */
  loadAdminUploads(): Observable<TrainingResource[]> {
    return this.api.get<TrainingHubDocumentDto[]>('traininghub/filter', { includeAdmin: true }).pipe(
      map((dtos) => dtos.map((dto) => this.mapDto(dto))),
      tap((docs) => this.resourcesSignal.set(docs)),
    );
  }

  /** Fetches what a given rep sees in their own Training Hub — their uploads plus every Admin upload. */
  loadForRoleWithAdmin(roleId: string): Observable<TrainingResource[]> {
    return this.api.get<TrainingHubDocumentDto[]>('traininghub/filter', { roleId, includeAdmin: true }).pipe(
      map((dtos) => dtos.map((dto) => this.mapDto(dto))),
      tap((docs) => this.resourcesSignal.set(docs)),
    );
  }

  /** Fetches every Marketing Hub resource — always admin-uploaded, visible to every rep. Used by both Marketing Hub Admin and Marketing Hub Rep. */
  loadMarketing(): Observable<TrainingResource[]> {
    return this.api.get<TrainingHubDocumentDto[]>('traininghub', { hubType: 'Marketing' }).pipe(
      map((dtos) => dtos.map((dto) => this.mapDto(dto))),
      tap((docs) => this.resourcesSignal.set(docs)),
    );
  }

  /** Uploads a real file (video/image/pdf/etc) to api/traininghub and adds it to the hub. */
  uploadDocument(input: NewTrainingHubUpload, file: File): Observable<TrainingResource> {
    const formData = new FormData();
    if (input.roleId) {
      formData.append('roleId', input.roleId);
    }
    formData.append('title', input.title);
    formData.append('category', input.category);
    formData.append('description', input.description);
    formData.append('length', input.length);
    formData.append('uploadedBy', input.uploadedBy);
    formData.append('language', input.language);
    if (input.hubType) {
      formData.append('hubType', input.hubType);
    }
    formData.append('file', file);

    return this.api.post<TrainingHubDocumentDto>('traininghub', formData).pipe(
      map((dto) => this.mapDto(dto)),
      tap((resource) => this.resourcesSignal.update((list) => [resource, ...list])),
    );
  }

  /** Edits a resource's metadata via PUT api/traininghub/{oId}, optionally swapping its file. */
  updateDocument(oId: number, patch: TrainingHubEdit, file?: File): Observable<TrainingResource> {
    const formData = new FormData();
    formData.append('title', patch.title);
    formData.append('category', patch.category);
    formData.append('description', patch.description);
    formData.append('length', patch.length);
    formData.append('language', patch.language);
    if (file) {
      formData.append('file', file);
    }

    return this.api.put<TrainingHubDocumentDto>(`traininghub/${oId}`, formData).pipe(
      map((dto) => this.mapDto(dto)),
      tap((resource) => this.resourcesSignal.update((list) => list.map((r) => (r.oId === oId ? resource : r)))),
    );
  }

  /** Fetches the raw file bytes for a resource — used to view or download it. */
  downloadDocument(oId: number): Observable<Blob> {
    return this.api.get(`traininghub/${oId}`, undefined, 'blob');
  }

  /** Deletes the resource from the backend and drops it from the list. */
  remove(id: string): Observable<void> {
    const resource = this.resourcesSignal().find((r) => r.id === id);
    if (!resource) {
      return of(undefined);
    }
    return this.api.delete<void>(`traininghub/${resource.oId}`).pipe(
      tap(() => this.resourcesSignal.update((list) => list.filter((r) => r.id !== id))),
    );
  }

  private mapDto(dto: TrainingHubDocumentDto): TrainingResource {
    return {
      id: `doc-${dto.oId}`,
      oId: dto.oId,
      repId: dto.roleId ?? '',
      uploadedBy: dto.uploadedBy === 'Admin' ? 'Admin' : 'Rep',
      title: dto.title,
      category: dto.category ?? 'Team Uploads',
      type: FILE_TYPE_TO_RESOURCE_TYPE[dto.fileType] ?? 'doc',
      duration: dto.length ?? '',
      featured: false,
      description: dto.description ?? '',
      url: this.api.fileUrl(`traininghub/${dto.oId}`),
      fileName: dto.fileName,
      language: dto.language === 'Spanish' ? 'Spanish' : 'English',
    };
  }
}
