import { Component, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Auth } from '../auth/auth';
import { RepProfileStore } from '../rep-profile-store/rep-profile-store';

interface ProfileRow {
  key: string;
  label: string;
  value: string;
  wide: boolean;
}

@Component({
  selector: 'app-rep-profile',
  imports: [MatCardModule, MatIconModule],
  templateUrl: './rep-profile.html',
  styleUrl: './rep-profile.scss',
})
export class RepProfile {
  private readonly auth = inject(Auth);
  private readonly repProfileStore = inject(RepProfileStore);

  readonly rows = computed<ProfileRow[]>(() => {
    const p = this.repProfileStore.profile();
    const email = this.auth.session()?.email ?? '';
    return [
      { key: 'name', label: 'Full name', value: p.name, wide: false },
      { key: 'email', label: 'Email', value: email, wide: false },
      { key: 'phone', label: 'Phone', value: p.phone, wide: false },
      { key: 'address', label: 'Address', value: p.address, wide: true },
      { key: 'city', label: 'City', value: p.city, wide: false },
      { key: 'state', label: 'State', value: p.state, wide: false },
      { key: 'zip', label: 'Zip', value: p.zip, wide: false },
    ];
  });
}