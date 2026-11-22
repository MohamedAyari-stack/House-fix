import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18N } from '../i18n/pipes';

/** Pied de page des pages publiques (services). */
@Component({
  standalone: true,
  selector: 'app-public-footer',
  imports: [RouterLink, ...I18N],
  template: `
    <footer class="footer">
      <div class="wrap inner">
        <a class="brand" routerLink="/"><span class="brand-icon"><i class="bi bi-house-gear-fill"></i></span><span>DarFix</span></a>
        <nav>
          <a routerLink="/services">{{ 'services.footer.allServices' | t }}</a>
          <a routerLink="/confidentialite">{{ 'services.footer.privacy' | t }}</a>
          <a routerLink="/conditions">{{ 'services.footer.terms' | t }}</a>
        </nav>
        <small>{{ 'services.footer.copyright' | t: { year: year } }}</small>
      </div>
    </footer>
  `,
  styles: `
    .footer {
      border-top: 1px solid var(--border);
      padding: 28px 0;
      margin-top: 40px;
    }
    .wrap {
      max-width: 1160px;
      margin: 0 auto;
      padding: 0 20px;
    }
    .inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-family: "Poppins", sans-serif;
      font-weight: 800;
      color: var(--text);
      text-decoration: none;
    }
    .brand-icon {
      width: 32px;
      height: 32px;
      border-radius: 9px;
      display: grid;
      place-items: center;
      color: #fff;
      background: linear-gradient(135deg, #2563eb, #4f46e5);
    }
    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 18px;
    }
    nav a,
    small {
      font-size: 13px;
      color: var(--text-muted);
      text-decoration: none;
    }
    nav a:hover {
      color: var(--primary);
    }
  `,
})
export class PublicFooter {
  protected readonly year = new Date().getFullYear();
}
