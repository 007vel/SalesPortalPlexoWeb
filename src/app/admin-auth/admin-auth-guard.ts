import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuth } from './admin-auth';

export const adminAuthGuard: CanActivateFn = () => {
  const adminAuth = inject(AdminAuth);
  const router = inject(Router);
  return adminAuth.isSignedIn() ? true : router.parseUrl('/login');
};
