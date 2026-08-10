import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, of, tap } from 'rxjs';
import { Api } from '../api/api';

export type TrainingResourceType = 'video' | 'image' | 'pdf' | 'doc' | 'link';

export interface TrainingResource {
  id: string;
  oId: number;
  /** The RepId of the rep who uploaded this resource. */
  repId: string;
  title: string;
  category: string;
  type: TrainingResourceType;
  duration: string;
  featured: boolean;
  description: string;
  url: string;
  fileName: string;
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
  uploadedAt: string;
}

const TYPE_ICON: Record<TrainingResourceType, string> = { video: 'movie', image: 'image', pdf: 'description', doc: 'article', link: 'link' };
const TYPE_LABEL: Record<TrainingResourceType, string> = { video: 'Video', image: 'Image', pdf: 'PDF', doc: 'Guide', link: 'Link' };
const FILE_TYPE_TO_RESOURCE_TYPE: Record<string, TrainingResourceType> = { Video: 'video', Image: 'image', Pdf: 'pdf', Document: 'doc' };

export function trainingResourceTypeIcon(type: TrainingResourceType): string {
  return TYPE_ICON[type] ?? 'school';
}

export function trainingResourceTypeLabel(type: TrainingResourceType): string {
  return TYPE_LABEL[type] ?? 'Open';
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
    formData.append('file', file);

    return this.api.post<TrainingHubDocumentDto>('traininghub', formData).pipe(
      map((dto) => this.mapDto(dto)),
      tap((resource) => this.resourcesSignal.update((list) => [resource, ...list])),
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
      title: dto.title,
      category: dto.category ?? 'Team Uploads',
      type: FILE_TYPE_TO_RESOURCE_TYPE[dto.fileType] ?? 'doc',
      duration: dto.length ?? '',
      featured: false,
      description: dto.description ?? '',
      url: this.api.fileUrl(`traininghub/${dto.oId}`),
      fileName: dto.fileName,
    };
  }
}
