import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './models';

/** Bloque l'accès aux espaces privés sans session. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);
};

/** Réserve une route à un rôle ; redirige sinon vers l'espace de l'utilisateur. */
export function roleGuard(role: Role): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    if (!auth.isLoggedIn()) return inject(Router).createUrlTree(['/login']);
    return auth.role() === role ? true : inject(Router).createUrlTree([auth.homeFor(auth.role())]);
  };
}

/** Redirige un utilisateur déjà connecté hors des pages de connexion/inscription. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? inject(Router).createUrlTree([auth.homeFor(auth.role())]) : true;
};
