import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, of, tap } from 'rxjs';
import { Api } from '../api/api';

export type TrainingResourceType = 'video' | 'image' | 'pdf' | 'doc' | 'link';

export interface TrainingResource {
  id: string;
  title: string;
  category: string;
  type: TrainingResourceType;
  duration: string;
  featured: boolean;
  description: string;
  url: string;
  /** Set only for resources backed by a real uploaded file (api/traininghub); absent for admin link-only entries. */
  oId?: number;
}

export interface NewTrainingHubUpload {
  title: string;
  category: string;
  length: string;
  description: string;
  /** The uploading rep's RepId — the backend filters retrieval by this same value. */
  roleId: string;
}

export interface ResourcePayload {
  title: string;
  category: string;
  type: TrainingResourceType;
  duration: string;
  featured: boolean;
  description: string;
  url: string;
}

/** Shape returned by POST/GET api/traininghub (PlexoRepPortal.Models.TrainingHubDocumentDto). */
interface TrainingHubDocumentDto {
  oId: number;
  roleId: string;
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
 * The team-wide Training & Resource Hub library. Reps upload real files
 * (video/image/pdf/etc, backed by `api/traininghub`, filtered server-side by
 * the uploading rep's RepId); admin can additionally curate plain link-only
 * resources, which stay purely client-side (no file, no backend row) — those
 * entries never carry an `oId`.
 */
@Injectable({ providedIn: 'root' })
export class TrainingResourceStore {
  private readonly api = inject(Api);
  private readonly resourcesSignal = signal<TrainingResource[]>([]);
  private readonly sharedHubLinkSignal = signal('');
  private nextId = 1;

  readonly resources = this.resourcesSignal.asReadonly();
  readonly sharedHubLink = this.sharedHubLinkSignal.asReadonly();

  /** Fetches every training hub document uploaded under the given RepId and merges it into the list, keeping any local-only link resources. */
  loadForRole(roleId: string): Observable<TrainingResource[]> {
    return this.api.get<TrainingHubDocumentDto[]>(`traininghub/role/${roleId}`).pipe(
      map((dtos) => dtos.map((dto) => this.mapDto(dto))),
      tap((docs) => {
        this.resourcesSignal.update((list) => [...docs, ...list.filter((r) => r.oId == null)]);
      }),
    );
  }

  /** Uploads a real file (video/image/pdf/etc) to api/traininghub and adds it to the hub. */
  uploadDocument(input: NewTrainingHubUpload, file: File): Observable<TrainingResource> {
    const formData = new FormData();
    formData.append('roleId', input.roleId);
    formData.append('title', input.title);
    formData.append('category', input.category);
    formData.append('description', input.description);
    formData.append('length', input.length);
    formData.append('file', file);

    return this.api.post<TrainingHubDocumentDto>('traininghub', formData).pipe(
      map((dto) => this.mapDto(dto)),
      tap((resource) => this.resourcesSignal.update((list) => [resource, ...list])),
    );
  }

  addResource(payload: ResourcePayload): void {
    this.insert(payload);
  }

  updateResource(id: string, payload: ResourcePayload): void {
    this.resourcesSignal.update((list) =>
      list.map((r) => {
        if (r.id === id) return { ...r, ...payload };
        return payload.featured ? { ...r, featured: false } : r;
      }),
    );
  }

  /** Removes a resource — deletes the backend file/row first when it's a real upload, otherwise just drops the local entry. */
  remove(id: string): Observable<void> {
    const resource = this.resourcesSignal().find((r) => r.id === id);
    if (!resource || resource.oId == null) {
      this.resourcesSignal.update((list) => list.filter((r) => r.id !== id));
      return of(undefined);
    }
    return this.api.delete<void>(`traininghub/${resource.oId}`).pipe(
      tap(() => this.resourcesSignal.update((list) => list.filter((r) => r.id !== id))),
    );
  }

  setSharedHubLink(url: string): void {
    this.sharedHubLinkSignal.set(url);
  }

  private mapDto(dto: TrainingHubDocumentDto): TrainingResource {
    return {
      id: `doc-${dto.oId}`,
      oId: dto.oId,
      title: dto.title,
      category: dto.category ?? 'Team Uploads',
      type: FILE_TYPE_TO_RESOURCE_TYPE[dto.fileType] ?? 'doc',
      duration: dto.length ?? '',
      featured: false,
      description: dto.description ?? '',
      url: this.api.fileUrl(`traininghub/${dto.oId}`),
    };
  }

  private insert(resource: Omit<TrainingResource, 'id'>): void {
    const full: TrainingResource = { id: String(this.nextId++), ...resource };
    this.resourcesSignal.update((list) => {
      const cleared = full.featured ? list.map((r) => ({ ...r, featured: false })) : list;
      return [full, ...cleared];
    });
  }
}
