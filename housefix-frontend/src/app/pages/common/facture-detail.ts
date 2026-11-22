import { Location, formatNumber } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Facture, Paiement } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { downloadBlob, errorMessage } from '../../core/utils';
import { StatusBadge } from '../../shared/status-badge';
import { currentLocale, translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';

type Mode = 'en_ligne' | 'especes';

/** Classe CSS par statut ; libellé : pages.factureDetail.paiementStatut.<statut>. */
const PAIEMENT_STATUT: Record<Paiement['statut'], { css: string }> = {
  en_attente: { css: 'badge-warning' },
  valide: { css: 'badge-success' },
  refuse: { css: 'badge-danger' },
  annule: { css: 'badge-info' },
};

/** Actions sur un paiement en espèces : appel API, question de confirmation et message de succès. */
type CashAction = 'confirm' | 'record' | 'reject' | 'cancel';

@Component({
  standalone: true,
  selector: 'app-facture-detail',
  imports: [FormsModule, StatusBadge, ...I18N],
  templateUrl: './facture-detail.html',
  styleUrl: './facture-detail.css',
})
export class FactureDetail {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly id = input.required<string>();

  protected readonly role = this.auth.role;
  protected readonly loading = signal(true);
  protected readonly facture = signal<Facture | null>(null);
  protected readonly notFound = signal<string | null>(null);
  protected readonly downloading = signal(false);
  protected readonly cashBusy = signal<CashAction | null>(null);

  // Modale de paiement
  protected readonly payOpen = signal(false);
  protected readonly mode = signal<Mode>('en_ligne');
  protected readonly paying = signal(false);
  protected readonly payError = signal<string | null>(null);
  protected readonly cardErrors = signal<Record<string, string>>({});
  protected card = { name: '', number: '', expiry: '', cvv: '' };

  protected readonly paiementStatut = PAIEMENT_STATUT;

  protected readonly rdv = computed(() => this.facture()?.rendez_vous ?? null);
  protected readonly canPay = computed(() => this.role() === 'client' && this.facture()?.statut_paiement === 'non_payee');
  protected readonly canConfirm = computed(
    () => this.role() === 'prestataire' && this.facture()?.statut_paiement === 'en_attente',
  );
  /** Le prestataire peut encaisser des espèces reçues sur place même sans déclaration du client. */
  protected readonly canRecordCash = computed(
    () => this.role() === 'prestataire' && this.facture()?.statut_paiement === 'non_payee',
  );
  protected readonly canCancelCash = computed(
    () => this.role() === 'client' && this.facture()?.statut_paiement === 'en_attente',
  );

  constructor() {
    effect(() => this.load(Number(this.id())));
  }

  private load(id: number): void {
    this.api.facture(id).subscribe({
      next: (f) => {
        this.facture.set(f);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notFound.set(errorMessage(err, translate('pages.factureDetail.notFound')));
      },
    });
  }

  private reload(): void {
    const f = this.facture();
    if (f) this.load(f.id);
  }

  protected back(): void {
    if (window.history.length > 1) this.location.back();
    else this.router.navigate(['/' + this.role(), 'factures']);
  }

  protected pdf(): void {
    const f = this.facture();
    if (!f) return;
    this.downloading.set(true);
    this.api.facturePdf(f.id).subscribe({
      next: (blob) => {
        this.downloading.set(false);
        downloadBlob(blob, 'facture-' + f.numero + '.pdf');
      },
      error: (err) => {
        this.downloading.set(false);
        this.toast.error(errorMessage(err, translate('pages.factures.pdfError')));
      },
    });
  }

  // --- Paiement (client) ---
  protected openPay(): void {
    this.card = { name: this.auth.user()?.nom ?? '', number: '', expiry: '', cvv: '' };
    this.mode.set('en_ligne');
    this.payError.set(null);
    this.cardErrors.set({});
    this.payOpen.set(true);
  }

  protected closePay(): void {
    if (!this.paying()) this.payOpen.set(false);
  }

  /** Numéro de carte : chiffres uniquement, groupés par 4. */
  protected onCardNumber(event: Event): void {
    const el = event.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '').slice(0, 16);
    this.card.number = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    el.value = this.card.number;
  }

  /** Expiration : MM/AA avec insertion automatique de la barre oblique. */
  protected onExpiry(event: Event): void {
    const el = event.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '').slice(0, 4);
    this.card.expiry = digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits;
    el.value = this.card.expiry;
  }

  protected onCvv(event: Event): void {
    const el = event.target as HTMLInputElement;
    this.card.cvv = el.value.replace(/\D/g, '').slice(0, 3);
    el.value = this.card.cvv;
  }

  private validateCard(): boolean {
    const e: Record<string, string> = {};
    if (!this.card.name.trim()) e['card_name'] = translate('pages.factureDetail.errors.cardName');
    if (this.card.number.replace(/\s/g, '').length !== 16) e['card_number'] = translate('pages.factureDetail.errors.cardNumber');
    const m = /^(\d{2})\/(\d{2})$/.exec(this.card.expiry);
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) {
      e['expiry'] = translate('pages.factureDetail.errors.expiryFormat');
    } else {
      const now = new Date();
      const year = 2000 + Number(m[2]);
      const month = Number(m[1]);
      if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
        e['expiry'] = translate('pages.factureDetail.errors.expired');
      }
    }
    if (!/^\d{3}$/.test(this.card.cvv)) e['cvv'] = translate('pages.factureDetail.errors.cvv');
    this.cardErrors.set(e);
    return Object.keys(e).length === 0;
  }

  protected pay(): void {
    const f = this.facture();
    if (!f) return;
    this.payError.set(null);
    const mode = this.mode();
    if (mode === 'en_ligne' && !this.validateCard()) return;

    const payload =
      mode === 'en_ligne'
        ? {
            mode,
            card_name: this.card.name.trim(),
            card_number: this.card.number.replace(/\s/g, ''),
            expiry: this.card.expiry,
            cvv: this.card.cvv,
          }
        : { mode };

    this.paying.set(true);
    this.api.payerFacture(f.id, payload).subscribe({
      next: () => {
        this.paying.set(false);
        this.payOpen.set(false);
        this.toast.success(
          mode === 'en_ligne'
            ? translate('pages.factureDetail.toasts.paidOnline')
            : translate('pages.factureDetail.toasts.cashDeclared'),
        );
        this.reload();
      },
      error: (err) => {
        this.paying.set(false);
        if (err instanceof HttpErrorResponse && err.status === 402) {
          this.payError.set(errorMessage(err, translate('pages.factureDetail.errors.declined')));
          this.reload();
        } else if (err instanceof HttpErrorResponse && err.status === 409) {
          this.payOpen.set(false);
          this.toast.error(errorMessage(err, translate('pages.factureDetail.errors.alreadyPaid')));
          this.reload();
        } else {
          this.payError.set(errorMessage(err));
        }
      },
    });
  }

  // --- Espèces : confirmer / encaisser / signaler non reçu (prestataire), annuler (client) ---
  protected cashAction(action: CashAction): void {
    const f = this.facture();
    if (!f || this.cashBusy()) return;
    const amount = formatNumber(Number(f.montant), currentLocale(), '1.2-2');
    if (!window.confirm(translate('pages.factureDetail.cashPrompts.' + action, { amount, numero: f.numero }))) return;

    const call = {
      confirm: () => this.api.confirmerEspeces(f.id),
      record: () => this.api.encaisserEspeces(f.id),
      reject: () => this.api.refuserEspeces(f.id),
      cancel: () => this.api.annulerEspeces(f.id),
    }[action];

    this.cashBusy.set(action);
    call().subscribe({
      next: (updated) => {
        this.cashBusy.set(null);
        this.facture.set(updated);
        this.toast.success(translate('pages.factureDetail.cashToasts.' + action));
      },
      error: (err) => {
        this.cashBusy.set(null);
        this.toast.error(errorMessage(err));
        this.reload();
      },
    });
  }
}
