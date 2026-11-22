import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Evaluation, RendezVous } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage } from '../../core/utils';
import { Avatar } from '../../shared/avatar';
import { StarRating } from '../../shared/star-rating';
import { EvaluationModal } from './evaluation-modal';
import { I18N } from '../../i18n/pipes';

@Component({
  standalone: true,
  selector: 'app-client-evaluations',
  imports: [...I18N, RouterLink, Avatar, StarRating, EvaluationModal],
  templateUrl: './evaluations.html',
  styleUrl: './evaluations.css',
})
export class ClientEvaluations {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  protected readonly rdvs = signal<RendezVous[]>([]);
  protected readonly evaluations = signal<Evaluation[]>([]);
  protected readonly loadingRdv = signal(true);
  protected readonly loadingEval = signal(true);
  protected readonly rating = signal<RendezVous | null>(null);
  protected readonly editing = signal<Evaluation | null>(null);

  /** Interventions terminées qui n'ont pas encore été évaluées. */
  protected readonly aEvaluer = computed(() => {
    const done = new Set(this.evaluations().map((e) => e.rendez_vous_id));
    return this.rdvs().filter((r) => (r.status === 'termine' || r.status === 'facture') && !r.evaluation && !done.has(r.id));
  });

  protected readonly moyenne = computed(() => {
    const list = this.evaluations();
    return list.length ? list.reduce((s, e) => s + e.note, 0) / list.length : 0;
  });

  constructor() {
    this.api.rendezVous().subscribe({
      next: (list) => {
        this.rdvs.set(list);
        this.loadingRdv.set(false);
      },
      error: (err) => {
        this.loadingRdv.set(false);
        this.toast.error(errorMessage(err));
      },
    });
    this.loadEvaluations();
  }

  private loadEvaluations(): void {
    this.api.evaluations().subscribe({
      next: (list) => {
        this.evaluations.set(list);
        this.loadingEval.set(false);
      },
      error: (err) => {
        this.loadingEval.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected onCreated(rdv: RendezVous, ev: Evaluation): void {
    this.rating.set(null);
    this.rdvs.update((list) => list.map((r) => (r.id === rdv.id ? { ...r, evaluation: ev } : r)));
    // L'avis créé peut arriver sans le prestataire : on reprend celui du rendez-vous.
    this.evaluations.update((list) => [{ ...ev, prestataire: ev.prestataire ?? rdv.prestataire }, ...list]);
  }

  protected onUpdated(ev: Evaluation): void {
    this.editing.set(null);
    this.evaluations.update((list) => list.map((e) => (e.id === ev.id ? { ...e, ...ev, prestataire: ev.prestataire ?? e.prestataire } : e)));
  }
}
