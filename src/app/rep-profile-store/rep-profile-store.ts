import { Injectable, computed, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { Auth } from '../auth/auth';
import { RepDirectoryStore, RepDocRecord, RepDocs, RepRecord, CommissionDay, SalesRepType, BusinessCardStatus } from '../rep-directory-store/rep-directory-store';

export interface RepProfileData {
  name: string;
  businessName: string;
  phone: string;
  salesRepType: SalesRepType;
  address: string;
  city: string;
  state: string;
  zip: string;
  googleLink: string;
  resourceLink: string;
  pricingSheetLink: string;
  powerPointLink: string;
  passedCertification: boolean;
  businessCardStatus: BusinessCardStatus;
  consultantFeePaid: boolean;
  docs: RepDocs;
  commissions: CommissionDay[];
  /** Assigned once the rep becomes a Marketing Consultant — only meaningful when salesRepType is 'marketingConsultant'. */
  pwrRewardsEmail: string;
  pwrRewardsEmailPassword: string;
  contractWizardLink: string;
  contractWizardUsername: string;
  contractWizardPassword: string;
  contractWizardInstructionsLink: string;
}

function emptyRepProfile(): RepProfileData {
  return {
    name: '',
    businessName: '',
    phone: '',
    salesRepType: 'referralAgent',
    address: '',
    city: '',
    state: '',
    zip: '',
    googleLink: '',
    resourceLink: '',
    pricingSheetLink: '',
    powerPointLink: '',
    passedCertification: false,
    businessCardStatus: 'notSent',
    consultantFeePaid: false,
    docs: { agreement: null, w4: null, certification: null, pricingSheet: null, powerPoint: null, pwrInstructions: null, businessCards: null },
    commissions: [],
    pwrRewardsEmail: '',
    pwrRewardsEmailPassword: '',
    contractWizardLink: '',
    contractWizardUsername: '',
    contractWizardPassword: '',
    contractWizardInstructionsLink: '',
  };
}

function toProfileData(rep: RepRecord | undefined): RepProfileData {
  if (!rep) return emptyRepProfile();
  return {
    name: rep.name,
    businessName: rep.businessName,
    phone: rep.phone,
    salesRepType: rep.salesRepType,
    address: rep.address,
    city: rep.city,
    state: rep.state,
    zip: rep.zip,
    googleLink: rep.googleLink,
    resourceLink: rep.resourceLink,
    pricingSheetLink: rep.pricingSheetLink,
    powerPointLink: rep.powerPointLink,
    passedCertification: rep.passedCertification,
    businessCardStatus: rep.businessCardStatus,
    consultantFeePaid: rep.consultantFeePaid,
    docs: rep.docs,
    commissions: rep.commissions,
    pwrRewardsEmail: rep.pwrRewardsEmail,
    pwrRewardsEmailPassword: rep.pwrRewardsEmailPassword,
    contractWizardLink: rep.contractWizardLink,
    contractWizardUsername: rep.contractWizardUsername,
    contractWizardPassword: rep.contractWizardPassword,
    contractWizardInstructionsLink: rep.contractWizardInstructionsLink,
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

  approveBusinessCard(): Observable<RepRecord> {
    const repId = this.auth.session()?.repId;
    if (!repId) return throwError(() => new Error('Not signed in'));
    return this.directory.updateRep(repId, { businessCardStatus: 'approved' });
  }
}