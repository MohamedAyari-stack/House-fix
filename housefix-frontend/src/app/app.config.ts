import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeArTN from '@angular/common/locales/ar-TN';
import localeEnGB from '@angular/common/locales/en-GB';
import localeFr from '@angular/common/locales/fr';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { AppTitleStrategy } from './i18n/title-strategy';

// Dates et nombres : les pipes appDate / appNumber (i18n/pipes.ts) choisissent la locale selon la langue.
registerLocaleData(localeFr);
registerLocaleData(localeArTN);
registerLocaleData(localeEnGB);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    { provide: TitleStrategy, useClass: AppTitleStrategy },
  ],
};
