import { Injectable, signal } from '@angular/core';

export type TrainingResourceType = 'video' | 'pdf' | 'doc' | 'link';

export interface TrainingResource {
  id: string;
  title: string;
  category: string;
  type: TrainingResourceType;
  duration: string;
  featured: boolean;
  description: string;
  url: string;
  addedBy?: string;
}

export interface NewVideoResource {
  title: string;
  category: string;
  duration: string;
  description: string;
  url: string;
  addedBy: string;
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

const TYPE_ICON: Record<TrainingResourceType, string> = { video: 'movie', pdf: 'description', doc: 'article', link: 'link' };
const TYPE_LABEL: Record<TrainingResourceType, string> = { video: 'Video', pdf: 'PDF', doc: 'Guide', link: 'Link' };

export function trainingResourceTypeIcon(type: TrainingResourceType): string {
  return TYPE_ICON[type] ?? 'school';
}

export function trainingResourceTypeLabel(type: TrainingResourceType): string {
  return TYPE_LABEL[type] ?? 'Open';
}

/**
 * The team-wide Training & Resource Hub library. Now updated from two
 * places: reps can add their own videos, and admin can curate any resource
 * type (add/edit/remove, feature one at a time). Starts empty — no
 * predefined resources.
 */
@Injectable({ providedIn: 'root' })
export class TrainingResourceStore {
  private readonly resourcesSignal = signal<TrainingResource[]>([]);
  private readonly sharedHubLinkSignal = signal('');
  private nextId = 1;

  readonly resources = this.resourcesSignal.asReadonly();
  readonly sharedHubLink = this.sharedHubLinkSignal.asReadonly();

  addVideo(input: NewVideoResource): void {
    this.insert({
      title: input.title,
      category: input.category,
      type: 'video',
      duration: input.duration,
      featured: false,
      description: input.description,
      url: input.url,
      addedBy: input.addedBy,
    });
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

  remove(id: string): void {
    this.resourcesSignal.update((list) => list.filter((r) => r.id !== id));
  }

  setSharedHubLink(url: string): void {
    this.sharedHubLinkSignal.set(url);
  }

  private insert(resource: Omit<TrainingResource, 'id'>): void {
    const full: TrainingResource = { id: String(this.nextId++), ...resource };
    this.resourcesSignal.update((list) => {
      const cleared = full.featured ? list.map((r) => ({ ...r, featured: false })) : list;
      return [full, ...cleared];
    });
  }
}
