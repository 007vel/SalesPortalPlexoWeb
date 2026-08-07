import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { filter } from 'rxjs';
import { Auth } from '../auth/auth';
import { AdminAuth } from '../admin-auth/admin-auth';
import { RepProfileStore } from '../rep-profile-store/rep-profile-store';

export type NavMode = 'rep' | 'admin';

const MOBILE_NAV_QUERY = '(max-width: 960px)';

/**
 * One shell for both portals. `mode` (bound from each parent route's
 * `data.mode` via `withComponentInputBinding()`) picks which nav items and
 * sign-out flow render — everything else (sidenav layout, styling) is shared.
 */
@Component({
  selector: 'app-side-nav',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, MatListModule, MatSidenavModule, MatDividerModule],
  templateUrl: './side-nav.html',
  styleUrl: './side-nav.scss',
})
export class SideNav {
  readonly mode = input<NavMode>('rep');

  private readonly auth = inject(Auth);
  private readonly adminAuth = inject(AdminAuth);
  private readonly router = inject(Router);
  private readonly repProfileStore = inject(RepProfileStore);
  private readonly breakpointObserver = inject(BreakpointObserver);

  readonly isAdmin = computed(() => this.mode() === 'admin');

  readonly profile = this.repProfileStore.profile;
  readonly displayName = computed(() => this.profile().name || 'Unnamed rep');
  readonly avatarInitial = computed(() => {
    const name = this.profile().name.trim();
    return name ? name.charAt(0).toUpperCase() : '?';
  });

  // Sidenav becomes an overlay drawer below 960px instead of a permanent side panel.
  private readonly breakpointState = toSignal(this.breakpointObserver.observe(MOBILE_NAV_QUERY), {
    initialValue: { matches: this.breakpointObserver.isMatched(MOBILE_NAV_QUERY), breakpoints: {} },
  });
  readonly isMobile = computed(() => this.breakpointState().matches);

  readonly opened = signal(!this.breakpointObserver.isMatched(MOBILE_NAV_QUERY));

  constructor() {
    // Start closed on mobile, stay permanently open on desktop.
    effect(() => {
      this.opened.set(!this.isMobile());
    });

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.isMobile()) {
          this.opened.set(false);
        }
      });
  }

  toggleNav(): void {
    this.opened.update((v) => !v);
  }

  signOut(): void {
    if (this.isAdmin()) {
      this.adminAuth.logout();
    } else {
      this.auth.logout();
    }
    this.router.navigateByUrl('/login');
  }
}