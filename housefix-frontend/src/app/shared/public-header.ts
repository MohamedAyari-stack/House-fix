import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { I18N } from '../i18n/pipes';
import { LangSwitch } from './lang-switch';
import { ThemeToggle } from './theme-toggle';

/** En-tête des pages publiques (services) : logo, navigation, langue, thème, connexion. */
@Component({
  standalone: true,
  selector: 'app-public-header',
  imports: [RouterLink, RouterLinkActive, LangSwitch, ThemeToggle, ...I18N],
  template: `
    <header class="nav">
      <div class="wrap nav-inner">
        <a class="brand" routerLink="/" [attr.aria-label]="'services.nav.home' | t">
          <span class="brand-icon"><i class="bi bi-house-gear-fill"></i></span>
          <span>DarFix</span>
        </a>

        <nav class="links" [class.open]="menuOpen()" (click)="menuOpen.set(false)">
          <a routerLink="/services" routerLinkActive="active">{{ 'services.nav.services' | t }}</a>
          <a routerLink="/" fragment="fonctionnement">{{ 'services.nav.howItWorks' | t }}</a>
          @if (!auth.isLoggedIn()) {
            <a class="mobile-only" routerLink="/login">{{ 'services.nav.login' | t }}</a>
          }
        </nav>

        <div class="actions">
          <app-lang-switch />
          <app-theme-toggle class="desktop-only" />
          @if (auth.isLoggedIn()) {
            <a class="btn btn-primary" [routerLink]="auth.homeFor(auth.role())">{{ 'layout.nav.dashboard' | t }}</a>
          } @else {
            <a class="btn btn-ghost desktop-only" routerLink="/login">{{ 'services.nav.login' | t }}</a>
            <a class="btn btn-primary" routerLink="/register">{{ 'services.nav.register' | t }}</a>
          }
          <button
            type="button"
            class="btn btn-outline btn-icon burger"
            (click)="menuOpen.set(!menuOpen())"
            [attr.aria-expanded]="menuOpen()"
            [attr.aria-label]="'services.nav.menu' | t"
          >
            <i class="bi" [class.bi-list]="!menuOpen()" [class.bi-x-lg]="menuOpen()"></i>
          </button>
        </div>
      </div>
    </header>
  `,
  styles: `
    .nav {
      position: sticky;
      top: 0;
      z-index: 20;
      background: var(--surface-glass);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }
    .wrap {
      max-width: 1160px;
      margin: 0 auto;
      padding: 0 20px;
    }
    .nav-inner {
      position: relative;
      display: flex;
      align-items: center;
      gap: 24px;
      height: 68px;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-family: "Poppins", sans-serif;
      font-weight: 800;
      font-size: 19px;
      color: var(--text);
      text-decoration: none;
    }
    .brand-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      color: #fff;
      background: linear-gradient(135deg, #2563eb, #4f46e5);
    }
    .links {
      display: flex;
      gap: 22px;
      margin-inline-end: auto;
    }
    .links a {
      color: var(--text-muted);
      font-weight: 600;
      font-size: 14px;
      text-decoration: none;
    }
    .links a:hover,
    .links a.active {
      color: var(--primary);
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .burger,
    .mobile-only {
      display: none;
    }
    @media (max-width: 760px) {
      .burger,
      .mobile-only {
        display: inline-flex;
      }
      .desktop-only {
        display: none;
      }
      .links {
        display: none;
        position: absolute;
        top: 68px;
        inset-inline: -20px;
        flex-direction: column;
        gap: 0;
        padding: 8px 20px 16px;
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        box-shadow: var(--shadow);
      }
      .links.open {
        display: flex;
      }
      .links a {
        padding: 12px 0;
        font-size: 15px;
      }
    }
    @media (max-width: 420px) {
      .actions .btn-primary {
        padding: 8px 12px;
        font-size: 13px;
      }
    }
  `,
})
export class PublicHeader {
  protected readonly auth = inject(AuthService);
  protected readonly menuOpen = signal(false);
}
