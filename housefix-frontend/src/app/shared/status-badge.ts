import { Component, computed, input } from '@angular/core';
import { litigeStatutLabel, paiementLabel, rdvStatusLabel } from '../core/models';
import { currentLang } from '../i18n/i18n';

type Kind = 'rdv' | 'paiement' | 'litige';

const CLASSES: Record<string, string> = {
  en_attente: 'badge-warning',
  accepte: 'badge-success',
  refuse: 'badge-danger',
  annule_par_client: 'badge',
  termine: 'badge-primary',
  facture: 'badge-violet',
  non_payee: 'badge-danger',
  payee: 'badge-success',
  ouvert: 'badge-warning',
  en_cours: 'badge-info',
  resolu: 'badge-success',
  rejete: 'badge-danger',
};

/** Badge coloré pour un statut de rendez-vous, de paiement ou de litige. */
@Component({
  standalone: true,
  selector: 'app-status-badge',
  template: `<span class="badge" [class]="'badge ' + cssClass()">{{ label() }}</span>`,
})
export class StatusBadge {
  readonly status = input.required<string>();
  readonly kind = input<Kind>('rdv');

  protected readonly label = computed(() => {
    currentLang(); // recalcule le libellé quand la langue change
    const s = this.status();
    switch (this.kind()) {
      case 'paiement':
        return paiementLabel(s);
      case 'litige':
        return litigeStatutLabel(s);
      default:
        return rdvStatusLabel(s);
    }
  });

  protected readonly cssClass = computed(() => CLASSES[this.status()] ?? '');
}
