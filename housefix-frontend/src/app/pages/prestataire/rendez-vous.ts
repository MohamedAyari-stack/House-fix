import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { RdvStatus, RendezVous, rdvStatusLabel } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage, isoDate, mapsUrl } from '../../core/utils';
import { StatusBadge } from '../../shared/status-badge';
import { translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';

type Tab = 'tous' | RdvStatus;
type ModalKind = 'accepter' | 'refuser' | 'horaire' | 'facture';

@Component({
  standalone: true,
  selector: 'app-prestataire-rendez-vous',
  imports: [FormsModule, RouterLink, StatusBadge, ...I18N],
  templateUrl: './rendez-vous.html',
  styleUrl: './rendez-vous.css',
})
export class PrestataireRendezVous {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  protected readonly tabs: Tab[] = ['tous', 'en_attente', 'accepte', 'termine', 'facture', 'refuse', 'annule_par_client'];
  protected readonly today = isoDate(new Date());

  protected readonly items = signal<RendezVous[]>([]);
  protected readonly loading = signal(true);
  protected readonly tab = signal<Tab>('tous');
  protected readonly busy = signal(false);

  protected readonly modal = signal<ModalKind | null>(null);
  protected readonly current = signal<RendezVous | null>(null);
  protected heure = '';
  protected date = '';
  protected motif = '';
  protected montant: number | null = null;
  protected details = '';
  protected readonly modalError = signal<string | null>(null);
  /** Taux de TVA du service, fourni par le serveur (jamais codé ici). */
  protected readonly tauxTva = signal<number | null>(null);

  protected readonly counts = computed(() => {
    const c: Record<string, number> = { tous: this.items().length };
    for (const r of this.items()) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  });
  protected readonly filtered = computed(() => {
    const t = this.tab();
    return t === 'tous' ? this.items() : this.items().filter((r) => r.status === t);
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.rendezVous().subscribe({
      next: (list) => {
        this.items.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected tabLabel(t: Tab): string {
    return t === 'tous' ? translate('prestataire.rdv.all') : rdvStatusLabel(t);
  }

  protected maps(r: RendezVous): string {
    return mapsUrl(r.latitude, r.longitude, r.address);
  }

  protected open(kind: ModalKind, r: RendezVous): void {
    this.current.set(r);
    this.modal.set(kind);
    this.modalError.set(null);
    this.heure = r.heure ?? '';
    this.date = '';
    this.motif = '';
    this.montant = null;
    this.details = '';
    this.tauxTva.set(null);
    if (kind === 'facture') {
      this.api.categories().subscribe({
        next: (list) => this.tauxTva.set(list.find((c) => c.id === r.categorie_service_id)?.taux_tva ?? null),
        error: () => undefined,
      });
    }
  }

  /** Aperçu HT / TVA / TTC ; la facture elle-même est calculée par le serveur. */
  protected apercuTva(): { tva: number; ttc: number } | null {
    const taux = this.tauxTva();
    if (taux === null || !this.montant || this.montant <= 0) return null;
    const ht = Math.round(this.montant * 100) / 100;
    const tva = Math.round(ht * taux) / 100;
    return { tva, ttc: Math.round((ht + tva) * 100) / 100 };
  }

  protected close(): void {
    this.modal.set(null);
    this.current.set(null);
  }

  protected confirmModal(): void {
    const r = this.current();
    const kind = this.modal();
    if (!r || !kind) return;
    switch (kind) {
      case 'accepter':
        this.run(this.api.accepterRendezVous(r.id, this.heure || null), translate('prestataire.rdv.toast.accepted'));
        break;
      case 'refuser':
        this.run(this.api.refuserRendezVous(r.id, this.motif.trim() || null), translate('prestataire.rdv.toast.refused'));
        break;
      case 'horaire':
        if (!this.heure) {
          this.modalError.set(translate('prestataire.rdv.errors.timeRequired'));
          return;
        }
        this.run(this.api.modifierHoraire(r.id, this.heure, this.date || null), translate('prestataire.rdv.toast.scheduleUpdated'));
        break;
      case 'facture':
        if (!this.montant || this.montant <= 0) {
          this.modalError.set(translate('prestataire.rdv.errors.amountPositive'));
          return;
        }
        this.busy.set(true);
        this.api.genererFacture(r.id, this.montant, this.details.trim() || null).subscribe({
          next: (facture) => {
            this.replace({ ...r, status: 'facture', facture });
            this.busy.set(false);
            this.close();
            this.toast.success(translate('prestataire.rdv.toast.invoiceGenerated', { numero: facture.numero }));
          },
          error: (err) => this.fail(err),
        });
        break;
    }
  }

  protected terminer(r: RendezVous): void {
    if (!window.confirm(translate('prestataire.rdv.confirmFinish', { nom: r.client.nom }))) return;
    this.current.set(r);
    this.run(this.api.terminerRendezVous(r.id), translate('prestataire.rdv.toast.finished'));
  }

  private run(obs: ReturnType<ApiService['getRendezVous']>, message: string): void {
    this.busy.set(true);
    this.modalError.set(null);
    obs.subscribe({
      next: (updated) => {
        this.replace(updated);
        this.busy.set(false);
        this.close();
        this.toast.success(message);
      },
      error: (err) => this.fail(err),
    });
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    if (this.modal()) this.modalError.set(errorMessage(err));
    else this.toast.error(errorMessage(err));
  }

  private replace(updated: RendezVous): void {
    this.items.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
  }
}
