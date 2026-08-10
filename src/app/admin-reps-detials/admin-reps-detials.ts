import { Component, computed, effect, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { RepDirectoryStore, RepStatus, portalLink, repStatusBadge } from '../rep-directory-store/rep-directory-store';
import { Toast } from '../toast/toast';

@Component({
  selector: 'app-admin-reps-detials',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatSelectModule, NgTemplateOutlet],
  templateUrl: './admin-reps-detials.html',
  styleUrl: './admin-reps-detials.scss',
})
export class AdminRepsDetials {
  private readonly directory = inject(RepDirectoryStore);
  private readonly toast = inject(Toast);
  private loadedForRepId: string | null = null;

  readonly repId = input.required<string>();

  readonly rep = computed(() => this.directory.findByRepId(this.repId()));
  readonly fullAddress = computed(() => {
    const rep = this.rep();
    if (!rep) return '';
    return [rep.address, rep.city, rep.state, rep.zip].filter(Boolean).join(', ');
  });

  readonly portalLink = portalLink;
  readonly statusBadge = repStatusBadge;

  constructor() {
    // Docs live in RepDirectoryStore's in-memory list — fetch this rep's once it's actually
    // present there, and again whenever admin navigates to a different rep's detail page.
    effect(() => {
      const repId = this.repId();
      if (repId === this.loadedForRepId) return;
      if (!this.directory.findByRepId(repId)) return;
      this.loadedForRepId = repId;
      this.directory.loadDocuments(repId).subscribe();
    });
  }

  copyLink(): void {
    const repId = this.repId();
    const link = portalLink(repId);
    navigator.clipboard?.writeText(`https://${link}`).catch(() => { });
    this.toast.show(`Copied ${link}`);
  }

  copyEmail(): void {
    const email = this.rep()?.email;
    if (!email) return;
    navigator.clipboard?.writeText(email).catch(() => { });
    this.toast.show(`Copied ${email}`);
  }

  updateStatus(status: RepStatus): void {
    this.directory.updateStatus(this.repId(), status).subscribe({
      next: () => this.toast.show(`Status updated to ${status}`),
      error: () => this.toast.show('Failed to update status'),
    });
  }

  downloadDocument(oId: number, fileName: string): void {
    this.directory.downloadDocument(oId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        this.toast.show('Download started');
      },
      error: () => this.toast.show('Failed to update status'),
    });
  }
}