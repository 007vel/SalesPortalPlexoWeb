import { Component, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RepProfileStore } from '../rep-profile-store/rep-profile-store';

interface LinkRow {
  key: string;
  label: string;
  hint: string;
  icon: string;
  value: string;
  href: string;
}

@Component({
  selector: 'app-rep-links',
  imports: [MatCardModule, MatIconModule],
  templateUrl: './rep-links.html',
  styleUrl: './rep-links.scss',
})
export class RepLinks {
  private readonly repProfileStore = inject(RepProfileStore);

  readonly linkRows = computed<LinkRow[]>(() => {
    const profile = this.repProfileStore.profile();
    return [
      { key: 'googleLink', label: 'Sales Leads link', hint: 'Business, Maps, or Drive link', icon: 'storefront', value: profile.googleLink },
      { key: 'resourceLink', label: 'Knowledge Base', hint: 'Your personal doc share link', icon: 'menu_book', value: profile.resourceLink },
      { key: 'pricingSheetLink', label: 'Pricing sheet link', hint: 'Current pricing sheet', icon: 'request_quote', value: profile.pricingSheetLink },
      { key: 'powerPointLink', label: 'PowerPoint link', hint: 'Sales deck or presentation', icon: 'slideshow', value: profile.powerPointLink },
    ].map((row) => ({ ...row, href: this.toHref(row.value) }));
  });

  private toHref(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }
}
