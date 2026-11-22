import { Injectable, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { currentLang, translate } from './i18n';

/**
 * Titre de l'onglet du navigateur, traduit.
 * Les routes donnent des clés : `title` (pages publiques) ou `data.title` (pages des espaces connectés).
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private last?: RouterStateSnapshot;

  constructor() {
    super();
    // Retraduit le titre affiché quand la langue change.
    effect(() => {
      currentLang();
      if (this.last) this.updateTitle(this.last);
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.last = snapshot;
    let leaf: ActivatedRouteSnapshot = snapshot.root;
    while (leaf.firstChild) leaf = leaf.firstChild;
    // Pages publiques référencées (services) : leur composant fixe le titre à partir des données (SeoService).
    if (leaf.data['seo']) return;
    const tabKey = this.buildTitle(snapshot);
    if (tabKey) {
      this.title.setTitle(translate(tabKey));
      return;
    }
    let route: ActivatedRouteSnapshot = snapshot.root;
    while (route.firstChild) route = route.firstChild;
    const pageKey = route.data['title'] as string | undefined;
    this.title.setTitle(pageKey ? `${translate(pageKey)} — DarFix` : 'DarFix');
  }
}
