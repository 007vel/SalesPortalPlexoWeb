import { Injectable, computed, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { Auth } from '../auth/auth';
import { RepDirectoryStore, RepDocRecord, RepDocs, RepRecord, CommissionDay } from '../rep-directory-store/rep-directory-store';

export interface RepProfileData {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  googleLink: string;
  resourceLink: string;
  docs: RepDocs;
  commissions: CommissionDay[];
}

function emptyRepProfile(): RepProfileData {
  return {
    name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    googleLink: '',
    resourceLink: '',
    docs: { agreement: null, w4: null },
    commissions: [],
  };
}

function toProfileData(rep: RepRecord | undefined): RepProfileData {
  if (!rep) return emptyRepProfile();
  return {
    name: rep.name,
    phone: rep.phone,
    address: rep.address,
    city: rep.city,
    state: rep.state,
    zip: rep.zip,
    googleLink: rep.googleLink,
    resourceLink: rep.resourceLink,
    docs: rep.docs,
    commissions: rep.commissions,
  };
}

/**
 * A thin per-session view over `RepDirectoryStore` — resolves "the current
 * rep" from `Auth.session()` so every consumer keeps reading/writing "my
 * profile" without knowing about Rep IDs. A rep's record only exists once
 * admin has created it in the directory.
 */
@Injectable({ providedIn: 'root' })
export class RepProfileStore {
  private readonly auth = inject(Auth);
  private readonly directory = inject(RepDirectoryStore);

  readonly profile = computed<RepProfileData>(() => {
    const repId = this.auth.session()?.repId;
    const rep = repId ? this.directory.findByRepId(repId) : undefined;
    return toProfileData(rep);
  });

  setDocument(kind: keyof RepDocs, file: File): Observable<RepDocRecord> {
    const repId = this.auth.session()?.repId;
    if (!repId) return throwError(() => new Error('Not signed in'));
    return this.directory.setDocument(repId, kind, file);
  }
}
