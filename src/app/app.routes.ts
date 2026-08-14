import { Routes } from '@angular/router';
import { Login } from './login/login';
import { SideNav } from './side-nav/side-nav';
import { RepOverview } from './rep-overview/rep-overview';
import { RepProfile } from './rep-profile/rep-profile';
import { RepLinks } from './rep-links/rep-links';
import { RepDocuments } from './rep-documents/rep-documents';
import { RepCommission } from './rep-commission/rep-commission';
import { RepTrainingHub } from './rep-training-hub/rep-training-hub';
import { authGuard } from './auth/auth-guard';
import { AdminReps } from './admin-reps/admin-reps';
import { AdminRepsDetials } from './admin-reps-detials/admin-reps-detials';
import { AdminSettings } from './admin-settings/admin-settings';
import { adminAuthGuard } from './admin-auth/admin-auth-guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: Login },
  {
    path: 'rep',
    canActivate: [authGuard],
    component: SideNav,
    data: { mode: 'rep' },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', component: RepOverview },
      { path: 'profile', component: RepProfile },
      { path: 'links', component: RepLinks },
      { path: 'documents', component: RepDocuments },
      { path: 'commission', component: RepCommission },
      { path: 'training', component: RepTrainingHub },
    ],
  },
  {
    path: 'admin',
    canActivate: [adminAuthGuard],
    component: SideNav,
    data: { mode: 'admin' },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'reps' },
      { path: 'reps', component: AdminReps },
      { path: 'reps/:repId', component: AdminRepsDetials },
      { path: 'settings', component: AdminSettings },
    ],
  },
  { path: ':portalRepId', component: Login },
  { path: '**', redirectTo: 'login' },
];
