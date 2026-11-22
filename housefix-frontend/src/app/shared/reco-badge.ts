import { Component, input } from '@angular/core';
import { I18N } from '../i18n/pipes';

/** Badge « Prestataire recommandé » : décidé par le serveur (is_recommended), jamais calculé ici. */
@Component({
  standalone: true,
  selector: 'app-reco-badge',
  imports: [...I18N],
  template: `
    <span class="reco" [class.compact]="compact()" [title]="'common.reco.criteria' | t" role="img" [attr.aria-label]="('common.reco.label' | t) + ' — ' + ('common.reco.criteria' | t)">
      <i class="bi bi-award-fill" aria-hidden="true"></i>
      @if (!compact()) { <span aria-hidden="true">{{ 'common.reco.label' | t }}</span> }
    </span>
  `,
  styles: `
    .reco {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: 999px;
      background: linear-gradient(135deg, #f59e0b, #f97316);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35);
      cursor: help;
    }
    .reco.compact {
      padding: 3px 6px;
    }
  `,
})
export class RecoBadge {
  /** Icône seule (cartes étroites, listes). */
  readonly compact = input(false);
}
