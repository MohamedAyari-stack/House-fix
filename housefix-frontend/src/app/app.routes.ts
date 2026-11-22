import { Routes } from '@angular/router';
import { guestGuard, roleGuard } from './core/guards';
import { Shell } from './layout/shell';

// Pages communes à plusieurs rôles (le composant adapte son comportement au rôle connecté).
const common = {
  messages: () => import('./pages/common/messages').then((m) => m.Messages),
  litiges: () => import('./pages/common/litiges').then((m) => m.Litiges),
  parametres: () => import('./pages/common/parametres').then((m) => m.Parametres),
  factures: () => import('./pages/common/factures').then((m) => m.Factures),
  factureDetail: () => import('./pages/common/facture-detail').then((m) => m.FactureDetail),
};

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/public/accueil').then((m) => m.Accueil),
    title: 'layout.tabs.home',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/login').then((m) => m.Login),
    title: 'layout.tabs.login',
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/register').then((m) => m.Register),
    title: 'layout.tabs.register',
  },
  {
    path: 'verify-email',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/verify-email').then((m) => m.VerifyEmail),
    title: 'layout.tabs.verifyEmail',
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/forgot-password').then((m) => m.ForgotPassword),
    title: 'layout.tabs.forgotPassword',
  },

  // ---------------- Espace client ----------------
  {
    path: 'client',
    component: Shell,
    canActivate: [roleGuard('client')],
    children: [
      { path: '', data: { title: 'layout.titles.dashboard' }, loadComponent: () => import('./pages/client/dashboard').then((m) => m.ClientDashboardPage) },
      { path: 'rendez-vous', data: { title: 'layout.titles.myRdv' }, loadComponent: () => import('./pages/client/rendez-vous').then((m) => m.ClientRendezVous) },
      { path: 'rendez-vous/nouveau', data: { title: 'layout.titles.newRdv' }, loadComponent: () => import('./pages/client/nouveau-rdv').then((m) => m.NouveauRdv) },
      { path: 'prestataires', data: { title: 'layout.titles.prestataires' }, loadComponent: () => import('./pages/client/prestataires').then((m) => m.ClientPrestataires) },
      { path: 'prestataires/:id', data: { title: 'layout.titles.prestataireProfile' }, loadComponent: () => import('./pages/client/prestataire-detail').then((m) => m.PrestataireDetailPage) },
      { path: 'factures', data: { title: 'layout.titles.myInvoices' }, loadComponent: common.factures },
      { path: 'factures/:id', data: { title: 'layout.titles.invoiceDetail' }, loadComponent: common.factureDetail },
      { path: 'evaluations', data: { title: 'layout.titles.myReviews' }, loadComponent: () => import('./pages/client/evaluations').then((m) => m.ClientEvaluations) },
      { path: 'messages', data: { title: 'layout.titles.messages' }, loadComponent: common.messages },
      { path: 'litiges', data: { title: 'layout.titles.litiges' }, loadComponent: common.litiges },
      { path: 'parametres', data: { title: 'layout.titles.settings' }, loadComponent: common.parametres },
    ],
  },

  // ---------------- Espace prestataire ----------------
  {
    path: 'prestataire',
    component: Shell,
    canActivate: [roleGuard('prestataire')],
    children: [
      { path: '', data: { title: 'layout.titles.dashboard' }, loadComponent: () => import('./pages/prestataire/dashboard').then((m) => m.PrestataireDashboardPage) },
      { path: 'rendez-vous', data: { title: 'layout.titles.myRdv' }, loadComponent: () => import('./pages/prestataire/rendez-vous').then((m) => m.PrestataireRendezVous) },
      { path: 'calendrier', data: { title: 'layout.titles.calendar' }, loadComponent: () => import('./pages/prestataire/calendrier').then((m) => m.Calendrier) },
      { path: 'factures', data: { title: 'layout.titles.myInvoices' }, loadComponent: common.factures },
      { path: 'factures/:id', data: { title: 'layout.titles.invoiceDetail' }, loadComponent: common.factureDetail },
      { path: 'evaluations', data: { title: 'layout.titles.reviewsReceived' }, loadComponent: () => import('./pages/prestataire/evaluations').then((m) => m.PrestataireEvaluations) },
      { path: 'revenus', data: { title: 'layout.titles.myRevenue' }, loadComponent: () => import('./pages/prestataire/revenus').then((m) => m.RevenusPage) },
      { path: 'messages', data: { title: 'layout.titles.messages' }, loadComponent: common.messages },
      { path: 'litiges', data: { title: 'layout.titles.litiges' }, loadComponent: common.litiges },
      { path: 'parametres', data: { title: 'layout.titles.proProfile' }, loadComponent: common.parametres },
    ],
  },

  // ---------------- Espace administrateur ----------------
  {
    path: 'admin',
    component: Shell,
    canActivate: [roleGuard('admin')],
    children: [
      { path: '', data: { title: 'layout.titles.dashboard' }, loadComponent: () => import('./pages/admin/dashboard').then((m) => m.AdminDashboardPage) },
      { path: 'prestataires', data: { title: 'layout.titles.allPrestataires' }, loadComponent: () => import('./pages/admin/prestataires').then((m) => m.AdminPrestataires) },
      { path: 'validations', data: { title: 'layout.titles.validations' }, loadComponent: () => import('./pages/admin/validations').then((m) => m.Validations) },
      { path: 'categories', data: { title: 'layout.titles.categories' }, loadComponent: () => import('./pages/admin/categories').then((m) => m.CategoriesPage) },
      { path: 'rendez-vous', data: { title: 'layout.titles.rdvSupervision' }, loadComponent: () => import('./pages/admin/rendez-vous').then((m) => m.AdminRendezVous) },
      { path: 'litiges', data: { title: 'layout.titles.litigesManagement' }, loadComponent: () => import('./pages/admin/litiges').then((m) => m.AdminLitiges) },
      { path: 'utilisateurs', data: { title: 'layout.titles.users' }, loadComponent: () => import('./pages/admin/utilisateurs').then((m) => m.Utilisateurs) },
      { path: 'evaluations', data: { title: 'layout.titles.reviewsModeration' }, loadComponent: () => import('./pages/admin/evaluations').then((m) => m.AdminEvaluations) },
      { path: 'parametres', data: { title: 'layout.titles.settings' }, loadComponent: common.parametres },
    ],
  },

  // Pages publiques des services (référencement) : titre et balises fixés par le composant (SeoService).
  {
    path: 'services',
    loadComponent: () => import('./pages/public/services').then((m) => m.Services),
    data: { seo: true },
  },
  {
    path: 'services/:slug',
    loadComponent: () => import('./pages/public/service-page').then((m) => m.ServicePage),
    data: { seo: true },
  },
  // Pages légales : publiques, accessibles connecté ou non.
  {
    path: 'confidentialite',
    loadComponent: () => import('./pages/legal/legal-page').then((m) => m.LegalPage),
    data: { doc: 'privacy' },
    title: 'layout.tabs.privacy',
  },
  {
    path: 'conditions',
    loadComponent: () => import('./pages/legal/legal-page').then((m) => m.LegalPage),
    data: { doc: 'terms' },
    title: 'layout.tabs.terms',
  },
  { path: '**', redirectTo: '' },
];
