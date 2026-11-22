import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Role } from '../core/models';
import { Avatar } from '../shared/avatar';
import { NotificationBell } from '../shared/notification-bell';
import { TranslatePipe } from '../i18n/pipes';
import { LangSwitch } from '../shared/lang-switch';
import { ThemeToggle } from '../shared/theme-toggle';

interface NavItem {
  /** Clé de traduction (layout.nav.*). */
  label: string;
  icon: string;
  path: string;
  exact?: boolean;
}

const NAV: Record<Role, NavItem[]> = {
  client: [
    { label: 'layout.nav.home', icon: 'bi-grid-1x2', path: '/client', exact: true },
    { label: 'layout.nav.rdv', icon: 'bi-calendar-event', path: '/client/rendez-vous' },
    { label: 'layout.nav.invoices', icon: 'bi-receipt', path: '/client/factures' },
    { label: 'layout.nav.reviews', icon: 'bi-star', path: '/client/evaluations' },
    { label: 'layout.nav.prestataires', icon: 'bi-people', path: '/client/prestataires' },
    { label: 'layout.nav.messages', icon: 'bi-chat-dots', path: '/client/messages' },
    { label: 'layout.nav.litiges', icon: 'bi-exclamation-triangle', path: '/client/litiges' },
  ],
  prestataire: [
    { label: 'layout.nav.dashboard', icon: 'bi-grid-1x2', path: '/prestataire', exact: true },
    { label: 'layout.nav.rdv', icon: 'bi-calendar-event', path: '/prestataire/rendez-vous' },
    { label: 'layout.nav.calendar', icon: 'bi-calendar3', path: '/prestataire/calendrier' },
    { label: 'layout.nav.invoices', icon: 'bi-receipt', path: '/prestataire/factures' },
    { label: 'layout.nav.reviews', icon: 'bi-star', path: '/prestataire/evaluations' },
    { label: 'layout.nav.revenue', icon: 'bi-cash-stack', path: '/prestataire/revenus' },
    { label: 'layout.nav.messages', icon: 'bi-chat-dots', path: '/prestataire/messages' },
    { label: 'layout.nav.litiges', icon: 'bi-exclamation-triangle', path: '/prestataire/litiges' },
  ],
  admin: [
    { label: 'layout.nav.dashboard', icon: 'bi-grid-1x2', path: '/admin', exact: true },
    { label: 'layout.nav.prestataires', icon: 'bi-people', path: '/admin/prestataires' },
    { label: 'layout.nav.validations', icon: 'bi-patch-check', path: '/admin/validations' },
    { label: 'layout.nav.categories', icon: 'bi-tags', path: '/admin/categories' },
    { label: 'layout.nav.rdv', icon: 'bi-calendar-event', path: '/admin/rendez-vous' },
    { label: 'layout.nav.litiges', icon: 'bi-exclamation-triangle', path: '/admin/litiges' },
    { label: 'layout.nav.blocks', icon: 'bi-person-lock', path: '/admin/utilisateurs' },
    { label: 'layout.nav.reviews', icon: 'bi-star', path: '/admin/evaluations' },
  ],
};


/** Mise en page des espaces connectés : barre latérale par rôle + barre supérieure. */
@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Avatar, ThemeToggle, NotificationBell, LangSwitch, TranslatePipe],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);

  protected readonly menuOpen = signal(false);
  protected readonly unreadMessages = signal(0);
  protected readonly role = computed(() => this.auth.role() ?? 'client');
  protected readonly nav = computed(() => NAV[this.role()]);
  protected readonly roleKey = computed(() => `common.roles.${this.role()}`);
  protected readonly settingsPath = computed(() => `/${this.role()}/parametres`);

  /** Titre de la page courante, lu dans `data.title` de la route active. */
  protected readonly title = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.currentTitle()),
    ),
    { initialValue: this.currentTitle() },
  );

  constructor() {
    // Rafraîchit le profil (statut de validation, photo…) à l'ouverture de l'espace.
    this.auth.refreshUser().subscribe({ error: () => undefined });
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.menuOpen.set(false);
      this.refreshUnread();
    });
    // Badge des messages non lus (admin : pas de messagerie). En pause quand l'onglet est caché.
    const timer = setInterval(() => document.visibilityState === 'visible' && this.refreshUnread(), 30000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  private refreshUnread(): void {
    if (this.role() === 'admin') return;
    this.api.unreadMessages().subscribe({ next: (r) => this.unreadMessages.set(r.count), error: () => undefined });
  }

  private currentTitle(): string {
    let r = this.router.routerState.snapshot.root;
    while (r.firstChild) r = r.firstChild;
    return (r.data['title'] as string) ?? '';
  }
}
