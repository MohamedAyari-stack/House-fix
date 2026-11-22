import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { currentLang } from '../i18n/i18n';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

/** Ajoute le jeton Bearer et gère les sessions expirées (401) ou les comptes bloqués (403). */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const token = auth.token();

  const request = req.clone({
    setHeaders: {
      Accept: 'application/json',
      // Laravel répond (messages, erreurs de validation) dans la langue de l'interface.
      'Accept-Language': currentLang(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      const isAuthCall = req.url.includes('/auth/login') || req.url.includes('/auth/register');
      if (!isAuthCall && token && err.status === 401) {
        auth.clearSession();
        toast.error('Votre session a expiré, veuillez vous reconnecter.');
        router.navigate(['/login']);
      } else if (!isAuthCall && token && err.status === 403 && /bloqu/i.test(err.error?.message ?? '')) {
        auth.clearSession();
        toast.error(err.error.message);
        router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};
