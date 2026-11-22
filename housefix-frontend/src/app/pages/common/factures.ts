import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Facture, StatutPaiement, UserRef } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { downloadBlob, errorMessage } from '../../core/utils';
import { Avatar } from '../../shared/avatar';
import { StatusBadge } from '../../shared/status-badge';
import { translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';

type Filtre = 'toutes' | StatutPaiement;

@Component({
  standalone: true,
  selector: 'app-factures',
  imports: [RouterLink, StatusBadge, Avatar, ...I18N],
  templateUrl: './factures.html',
  styleUrl: './factures.css',
})
export class Factures {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly isClient = computed(() => this.auth.role() === 'client');
  protected readonly base = computed(() => '/' + this.auth.role());
  protected readonly loading = signal(true);
  protected readonly factures = signal<Facture[]>([]);
  protected readonly filtre = signal<Filtre>('toutes');
  protected readonly downloading = signal<number | null>(null);

  /** Libellés : pages.factures.tabs.<key>. */
  protected readonly tabs: Filtre[] = ['toutes', 'non_payee', 'en_attente', 'payee'];

  protected readonly filtered = computed(() => {
    const f = this.filtre();
    return f === 'toutes' ? this.factures() : this.factures().filter((x) => x.statut_paiement === f);
  });

  protected readonly totalPaye = computed(() =>
    this.factures().filter((f) => f.statut_paiement === 'payee').reduce((s, f) => s + Number(f.montant), 0),
  );
  protected readonly totalImpaye = computed(() =>
    this.factures().filter((f) => f.statut_paiement !== 'payee').reduce((s, f) => s + Number(f.montant), 0),
  );

  constructor() {
    this.api.factures().subscribe({
      next: (list) => {
        this.factures.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected count(key: Filtre): number {
    return key === 'toutes' ? this.factures().length : this.factures().filter((f) => f.statut_paiement === key).length;
  }

  /** L'autre partie de la facture : le prestataire pour un client, le client pour un prestataire. */
  protected otherParty(f: Facture): UserRef | undefined {
    return this.isClient() ? f.rendez_vous?.prestataire : f.rendez_vous?.client;
  }

  protected pdf(f: Facture): void {
    this.downloading.set(f.id);
    this.api.facturePdf(f.id).subscribe({
      next: (blob) => {
        this.downloading.set(null);
        downloadBlob(blob, 'facture-' + f.numero + '.pdf');
      },
      error: (err) => {
        this.downloading.set(null);
        this.toast.error(errorMessage(err, translate('pages.factures.pdfError')));
      },
    });
  }
}
