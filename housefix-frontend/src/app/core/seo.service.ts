import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoPage {
  title: string;
  description: string;
  /** Chemin de la page (ex. /services/plomberie?gouvernorat=Sousse), pour l'URL canonique. */
  path: string;
  /** Données structurées schema.org (JSON-LD) lues par Google. */
  jsonLd?: object;
}

const JSON_LD_ID = 'hf-jsonld';

/**
 * Balises de référencement des pages publiques : titre, description, URL canonique,
 * aperçu de partage (Open Graph) et données structurées. Les routes concernées ont
 * `data: { seo: true }` pour que AppTitleStrategy ne remplace pas leur titre.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  set(page: SeoPage): void {
    const url = this.document.location.origin + page.path;
    this.title.setTitle(page.title);
    this.meta.updateTag({ name: 'description', content: page.description });
    this.meta.updateTag({ property: 'og:title', content: page.title });
    this.meta.updateTag({ property: 'og:description', content: page.description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.link('canonical', url);
    this.jsonLd(page.jsonLd);
  }

  /** À appeler en quittant la page : les autres pages n'ont pas ces balises. */
  clear(): void {
    for (const selector of ["name='description'", "property='og:title'", "property='og:description'", "property='og:type'", "property='og:url'"]) {
      this.meta.removeTag(selector);
    }
    this.document.head.querySelector('link[rel=canonical]')?.remove();
    this.document.getElementById(JSON_LD_ID)?.remove();
  }

  private link(rel: string, href: string): void {
    let el = this.document.head.querySelector<HTMLLinkElement>(`link[rel=${rel}]`);
    if (!el) {
      el = this.document.createElement('link');
      el.rel = rel;
      this.document.head.appendChild(el);
    }
    el.href = href;
  }

  private jsonLd(data?: object): void {
    this.document.getElementById(JSON_LD_ID)?.remove();
    if (!data) return;
    const script = this.document.createElement('script');
    script.id = JSON_LD_ID;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    this.document.head.appendChild(script);
  }
}
