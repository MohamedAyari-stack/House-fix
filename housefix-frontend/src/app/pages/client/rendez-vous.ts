import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Evaluation, RDV_STATUSES, RdvStatus, RendezVous } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage, mapsUrl } from '../../core/utils';
import { StatusBadge } from '../../shared/status-badge';
import { EvaluationModal } from './evaluation-modal';
import { translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';

type Filtre = 'tous' | RdvStatus;

@Component({
  standalone: true,
  selector: 'app-client-rendez-vous',
  imports: [...I18N, RouterLink, StatusBadge, EvaluationModal],
  templateUrl: './rendez-vous.html',
  styleUrl: './rendez-vous.css',
})
export class ClientRendezVous {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly rdvs = signal<RendezVous[]>([]);
  protected readonly filtre = signal<Filtre>('tous');
  protected readonly busy = signal<number | null>(null);
  protected readonly evaluating = signal<RendezVous | null>(null);

  /** Onglets : le libellé est une clé de traduction, traduite dans le template. */
  protected readonly tabs: { key: Filtre; label: string }[] = [
    { key: 'tous', label: 'client.rendezVous.all' },
    ...RDV_STATUSES.map((k) => ({ key: k as Filtre, label: `common.status.rdv.${k}` })),
  ];

  protected readonly filtered = computed(() => {
    const f = this.filtre();
    return f === 'tous' ? this.rdvs() : this.rdvs().filter((r) => r.status === f);
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.api.rendezVous().subscribe({
      next: (list) => {
        this.rdvs.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected count(key: Filtre): number {
    return key === 'tous' ? this.rdvs().length : this.rdvs().filter((r) => r.status === key).length;
  }

  protected maps(r: RendezVous): string {
    return mapsUrl(r.latitude, r.longitude, r.address);
  }

  protected canCancel(r: RendezVous): boolean {
    return r.status === 'en_attente' || r.status === 'accepte';
  }

  protected canEvaluate(r: RendezVous): boolean {
    return (r.status === 'termine' || r.status === 'facture') && !r.evaluation;
  }

  protected cancel(r: RendezVous): void {
    if (!window.confirm(translate('client.rendezVous.confirmCancel', { id: r.id, categorie: r.categorie.nom }))) return;
    this.busy.set(r.id);
    this.api.annulerRendezVous(r.id).subscribe({
      next: (updated) => {
        this.busy.set(null);
        this.replace({ ...r, ...updated });
        this.toast.success(translate('client.rendezVous.cancelled'));
      },
      error: (err) => {
        this.busy.set(null);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected onEvaluated(r: RendezVous, ev: Evaluation): void {
    this.replace({ ...r, evaluation: ev });
    this.evaluating.set(null);
  }

  private replace(updated: RendezVous): void {
    this.rdvs.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
  }
}
