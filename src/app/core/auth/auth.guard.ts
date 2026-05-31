import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  try {
    const session = await auth.getSession();
    if (session) return true;
  } catch (err) {
    console.error('Error de autenticación:', err);
  }
  return router.createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  try {
    const session = await auth.getSession();
    if (!session) return true;
    return router.createUrlTree(['/dashboard']);
  } catch {
    return true;
  }
};
