import { Component, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { Auth } from '../auth/auth';
import { RepProfileStore, RepProfileData } from '../rep-profile-store/rep-profile-store';
import { TrainingResourceStore } from '../training-resource-store/training-resource-store';
import { RepDirectoryStore, portalLink } from '../rep-directory-store/rep-directory-store';
import { MOCK_CONFIG } from '../mock-config/mock-config';
import { Toast } from '../toast/toast';

interface ChecklistItem {
  label: string;
  done: boolean;
}

function calcProgressPct(profile: RepProfileData, email: string | undefined): number {
  const fields = [
    profile.name, profile.address, profile.city, profile.state, profile.zip,
    profile.phone, email, profile.googleLink, profile.resourceLink,
  ];
  let filled = fields.filter((v) => !!v && v.trim().length > 0).length;
  if (profile.docs.agreement) filled++;
  if (profile.docs.w4) filled++;
  return Math.round((filled / (fields.length + 2)) * 100);
}

@Component({
  selector: 'app-rep-overview',
  imports: [RouterLink, MatCardModule, MatIconModule, MatListModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './rep-overview.html',
  styleUrl: './rep-overview.scss',
})
export class RepOverview {
  private readonly auth = inject(Auth);
  private readonly repProfileStore = inject(RepProfileStore);
  private readonly directory = inject(RepDirectoryStore);
  private readonly trainingResourceStore = inject(TrainingResourceStore);
  private readonly toast = inject(Toast);
  private loadedForRepId: string | null = null;

  readonly portalDomain = MOCK_CONFIG.portalDomain;

  readonly session = this.auth.session;
  readonly profile = this.repProfileStore.profile;
  readonly trainingResourceCount = computed(() => this.trainingResourceStore.resources().length);

  readonly repId = computed(() => this.session()?.repId ?? '');

  readonly welcomeText = computed(() => {
    const name = this.profile().name;
    return name ? `Welcome back, ${name.split(' ')[0]}` : 'Welcome';
  });

  readonly progressPct = computed(() => calcProgressPct(this.profile(), this.session()?.email));

  readonly checklist = computed<ChecklistItem[]>(() => {
    const p = this.profile();
    const email = this.session()?.email ?? '';
    return [
      { label: 'Contact info', done: !!(p.name && p.address && p.city && p.state && p.zip && p.phone && email) },
      { label: 'Google & resource links', done: !!(p.googleLink && p.resourceLink) },
      { label: 'Representative Agreement', done: !!p.docs.agreement },
      { label: 'W-4 form', done: !!p.docs.w4 },
    ];
  });

  constructor() {
    // Docs live in RepDirectoryStore's in-memory list, keyed by rep — fetch them once the
    // signed-in rep is actually present in that list (it loads asynchronously on app start).
    effect(() => {
      const repId = this.auth.session()?.repId;
      if (!repId || repId === this.loadedForRepId) return;
      if (!this.directory.findByRepId(repId)) return;
      this.loadedForRepId = repId;
      this.directory.loadDocuments(repId).subscribe();
    });
  }

  copyMyLink(): void {
    const repId = this.repId();
    if (!repId) return;
    const link = portalLink(repId);
    navigator.clipboard?.writeText(`https://${link}`).catch(() => {});
    this.toast.show(`Copied ${link}`);
  }
}