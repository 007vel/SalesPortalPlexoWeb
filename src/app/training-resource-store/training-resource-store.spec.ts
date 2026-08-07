import { TestBed } from '@angular/core/testing';
import { TrainingResourceStore } from './training-resource-store';

describe('TrainingResourceStore', () => {
  let store: TrainingResourceStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(TrainingResourceStore);
  });

  it('should create', () => {
    expect(store).toBeTruthy();
  });

  it('starts empty', () => {
    expect(store.resources()).toEqual([]);
  });

  it('addVideo prepends a new unfeatured video resource', () => {
    store.addVideo({
      title: 'Renewal pitch walkthrough',
      category: 'Team Uploads',
      duration: '12 min',
      description: 'A live call example.',
      url: 'https://example.com/video',
      addedBy: 'Jordan',
    });

    const resources = store.resources();
    expect(resources.length).toBe(1);
    expect(resources[0]).toMatchObject({
      title: 'Renewal pitch walkthrough',
      type: 'video',
      featured: false,
      addedBy: 'Jordan',
    });
  });

  it('remove drops the resource with the matching id', () => {
    store.addVideo({ title: 'A', category: 'X', duration: '', description: '', url: 'https://a', addedBy: 'A' });
    const id = store.resources()[0].id;

    store.remove(id);

    expect(store.resources()).toEqual([]);
  });

  it('addResource adds any resource type with no addedBy', () => {
    store.addResource({
      title: 'Objection Handling Playbook', category: 'Sales Playbooks', type: 'pdf',
      duration: '14 pages', featured: false, description: 'Common pushback.', url: 'https://example.com/pdf',
    });

    const resources = store.resources();
    expect(resources.length).toBe(1);
    expect(resources[0].addedBy).toBeUndefined();
    expect(resources[0].type).toBe('pdf');
  });

  it('updateResource edits an existing resource in place', () => {
    store.addResource({
      title: 'Old title', category: 'X', type: 'doc', duration: '', featured: false, description: '', url: 'https://a',
    });
    const id = store.resources()[0].id;

    store.updateResource(id, {
      title: 'New title', category: 'Y', type: 'doc', duration: '', featured: false, description: '', url: 'https://a',
    });

    expect(store.resources()[0].title).toBe('New title');
    expect(store.resources()[0].category).toBe('Y');
    expect(store.resources().length).toBe(1);
  });

  it('only one resource can be featured at a time', () => {
    store.addResource({ title: 'A', category: 'X', type: 'doc', duration: '', featured: true, description: '', url: 'https://a' });
    store.addResource({ title: 'B', category: 'X', type: 'doc', duration: '', featured: false, description: '', url: 'https://b' });

    const idA = store.resources().find((r) => r.title === 'A')!.id;
    const idB = store.resources().find((r) => r.title === 'B')!.id;
    expect(store.resources().find((r) => r.id === idA)?.featured).toBe(true);

    store.updateResource(idB, { title: 'B', category: 'X', type: 'doc', duration: '', featured: true, description: '', url: 'https://b' });

    expect(store.resources().find((r) => r.id === idA)?.featured).toBe(false);
    expect(store.resources().find((r) => r.id === idB)?.featured).toBe(true);
  });

  it('sharedHubLink starts empty and can be set', () => {
    expect(store.sharedHubLink()).toBe('');
    store.setSharedHubLink('https://training.plexopro.com/hub');
    expect(store.sharedHubLink()).toBe('https://training.plexopro.com/hub');
  });
});
