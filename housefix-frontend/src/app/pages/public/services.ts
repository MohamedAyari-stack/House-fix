import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ServiceSummary } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { currentLang, translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';
import { PublicFooter } from '../../shared/public-footer';
import { PublicHeader } from '../../shared/public-header';

/** /services : tous les métiers, avec nombre de prestataires, tarif de départ et note. */
@Component({
  standalone: true,
  selector: 'app-services',
  imports: [RouterLink, PublicHeader, PublicFooter, ...I18N],
  template: `
    <app-public-header />
    <main class="wrap page">
      <header class="svc-hero">
        <span class="eyebrow">{{ 'services.index.eyebrow' | t }}</span>
        <h1>{{ 'services.index.title' | t }}</h1>
        <p class="lead">{{ 'services.index.intro' | t }}</p>
      </header>

      <div class="service-grid">
        @if (loading()) {
          @for (p of placeholders; track p) {
            <div class="card service-card"><span class="sk sk-icon"></span><span class="sk sk-line"></span><span class="sk sk-line short"></span></div>
          }
        } @else {
          @for (s of items(); track s.id) {
            <a class="card service-card" [routerLink]="['/services', s.slug]">
              <span class="service-icon"><i class="bi" [class]="'bi ' + (s.icone || 'bi-tools')"></i></span>
              <h2>{{ s.nom }}</h2>
              @if (s.description) {
                <p class="muted">{{ s.description }}</p>
              }
              <div class="facts">
                @if (s.prestataires) {
                  <span><i class="bi bi-people"></i> {{ (s.prestataires === 1 ? 'services.index.providersOne' : 'services.index.providersOther') | t: { count: s.prestataires } }}</span>
                  @if (s.tarif_min) {
                    <span><i class="bi bi-cash"></i> {{ 'services.index.from' | t: { price: (s.tarif_min | appNumber: '1.0-0') } }}</span>
                  }
                  @if (s.note_moyenne) {
                    <span class="rating"><i class="bi bi-star-fill"></i> {{ s.note_moyenne | appNumber: '1.1-1' }}</span>
                  }
                } @else {
                  <span class="badge badge-info">{{ 'services.index.soon' | t }}</span>
                }
              </div>
              <span class="go">{{ 'services.index.see' | t }} <i class="bi bi-arrow-right"></i></span>
            </a>
          }
        }
      </div>
    </main>
    <app-public-footer />
  `,
  styleUrl: './services-pages.css',
})
export class Services {
  private readonly api = inject(ApiService);
  private readonly seo = inject(SeoService);

  protected readonly items = signal<ServiceSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly placeholders = [1, 2, 3, 4, 5, 6, 7, 8];

  constructor() {
    // Rechargé à chaque changement de langue : les noms et descriptions viennent traduits du serveur.
    effect(() => {
      currentLang();
      this.api.services().subscribe({
        next: (list) => {
          this.items.set(list);
          this.loading.set(false);
          this.seo.set({
            title: translate('services.index.metaTitle'),
            description: translate('services.index.metaDescription'),
            path: '/services',
            jsonLd: {
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              itemListElement: list.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.nom, url: `${location.origin}/services/${s.slug}` })),
            },
          });
        },
        error: () => this.loading.set(false),
      });
    });
    inject(DestroyRef).onDestroy(() => this.seo.clear());
  }
}
