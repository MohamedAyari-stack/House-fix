import { formatNumber } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ServicePageData } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { currentLang, currentLocale, translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';
import { Avatar } from '../../shared/avatar';
import { PublicFooter } from '../../shared/public-footer';
import { PublicHeader } from '../../shared/public-header';
import { StarRating } from '../../shared/star-rating';

/**
 * /services/:slug(?gouvernorat=Sousse) : page publique d'un métier, pensée pour le référencement
 * (« Plombier à Sousse ») : chiffres réels, prestataires les mieux notés, avis, FAQ, données structurées.
 */
@Component({
  standalone: true,
  selector: 'app-service-page',
  imports: [RouterLink, Avatar, StarRating, PublicHeader, PublicFooter, ...I18N],
  templateUrl: './service-page.html',
  styleUrl: './services-pages.css',
})
export class ServicePage {
  private readonly api = inject(ApiService);
  private readonly seo = inject(SeoService);
  protected readonly auth = inject(AuthService);

  /** Paramètre de route et paramètre de requête (withComponentInputBinding). */
  readonly slug = input.required<string>();
  readonly gouvernorat = input<string | undefined>();

  protected readonly data = signal<ServicePageData | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly placeholders = [1, 2, 3, 4];

  /** « Plomberie à Sousse » ou « Plomberie en Tunisie », dans la langue courante. */
  protected readonly heading = computed(() => {
    const d = this.data();
    if (!d) return '';
    currentLang();
    return d.gouvernorat
      ? translate('services.page.titleIn', { service: d.service.nom, ville: this.ville(d.gouvernorat) })
      : translate('services.page.titleAll', { service: d.service.nom });
  });

  /** « à Sousse » / « en Tunisie », pour la FAQ. */
  protected readonly lieu = computed(() => {
    const g = this.data()?.gouvernorat;
    currentLang();
    return g ? translate('services.page.faq.inCity', { ville: this.ville(g) }) : translate('services.page.faq.inTunisia');
  });

  /** Réserver : un client connecté va droit au formulaire ; un visiteur crée d'abord un compte. */
  protected readonly canBook = computed(() => !this.auth.isLoggedIn() || this.auth.role() === 'client');

  constructor() {
    // Rechargé quand le service, la ville ou la langue change (noms traduits par le serveur).
    effect(() => {
      const slug = this.slug();
      const gouvernorat = this.gouvernorat() ?? null;
      currentLang();
      untracked(() => this.load(slug, gouvernorat));
    });
    inject(DestroyRef).onDestroy(() => this.seo.clear());
  }

  protected bookLink(prestataireId?: number): { path: unknown[]; query: Record<string, unknown> } {
    const d = this.data();
    if (this.auth.role() === 'client' && d) {
      return { path: ['/client/rendez-vous/nouveau'], query: { categorie: d.service.id, ...(prestataireId ? { prestataire: prestataireId } : {}) } };
    }
    return { path: ['/register'], query: { role: 'client' } };
  }

  protected ville(g: string): string {
    return translate(`common.gouvernorats.${g}`);
  }

  private load(slug: string, gouvernorat: string | null): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.api.servicePage(slug, gouvernorat).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
        this.updateSeo(d);
      },
      error: (err) => {
        this.loading.set(false);
        this.data.set(null);
        this.notFound.set(err instanceof HttpErrorResponse && (err.status === 404 || err.status === 422));
        this.seo.clear();
      },
    });
  }

  private updateSeo(d: ServicePageData): void {
    const place = d.gouvernorat ? this.ville(d.gouvernorat) : null;
    const path = `/services/${d.service.slug}` + (d.gouvernorat ? `?gouvernorat=${encodeURIComponent(d.gouvernorat)}` : '');
    const s = d.stats;
    const price = (n: number | null) => (n === null ? null : formatNumber(n, currentLocale(), '1.0-2'));
    this.seo.set({
      title: `${this.heading()} — DarFix`,
      description: place
        ? translate('services.page.metaDescriptionIn', { service: d.service.nom, ville: place, count: s.prestataires })
        : translate('services.page.metaDescriptionAll', { service: d.service.nom, count: s.prestataires }),
      path,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Service',
            name: this.heading(),
            serviceType: d.service.nom,
            description: d.service.description ?? undefined,
            provider: { '@type': 'Organization', name: 'DarFix', url: location.origin },
            areaServed: { '@type': 'AdministrativeArea', name: place ?? 'Tunisie' },
            ...(s.tarif_min !== null
              ? { offers: { '@type': 'AggregateOffer', priceCurrency: 'TND', lowPrice: price(s.tarif_min), highPrice: price(s.tarif_max), offerCount: s.prestataires } }
              : {}),
            ...(s.avis > 0 && s.note_moyenne !== null
              ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: s.note_moyenne, reviewCount: s.avis, bestRating: 5 } }
              : {}),
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'DarFix', item: location.origin + '/' },
              { '@type': 'ListItem', position: 2, name: translate('services.nav.services'), item: location.origin + '/services' },
              { '@type': 'ListItem', position: 3, name: this.heading(), item: location.origin + path },
            ],
          },
        ],
      },
    });
  }
}
