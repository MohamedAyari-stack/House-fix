import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Evaluation, RendezVous } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage } from '../../core/utils';
import { StarRating } from '../../shared/star-rating';
import { translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';

/**
 * Fenêtre modale de notation d'un prestataire.
 * - avec `rdv` : crée une évaluation pour ce rendez-vous ;
 * - avec `evaluation` : modifie l'évaluation existante.
 */
@Component({
  standalone: true,
  selector: 'app-evaluation-modal',
  imports: [...I18N, FormsModule, StarRating],
  template: `
    <div class="modal-backdrop" (click)="close()">
      <div class="modal" (click)="$event.stopPropagation()">
        <h3>{{ (evaluation() ? 'client.evaluationModal.titleEdit' : 'client.evaluationModal.titleNew') | t }}</h3>
        @if (subject(); as s) {
          <p class="muted small subject">
            <strong>{{ s.nom || ('client.shared.prestataire' | t) }}</strong>
            @if (s.detail) { · {{ s.detail }} }
            @if (s.date) { · {{ s.date | appDate: 'date' }} }
          </p>
        }
        <div class="rating">
          <app-star-rating [(value)]="note" [editable]="true" />
          <span class="muted small">{{ (note() >= 1 ? 'client.evaluationModal.notes.n' + note() : 'client.evaluationModal.chooseNote') | t }}</span>
        </div>
        <div class="form-group">
          <label class="form-label" for="commentaire">{{ 'client.evaluationModal.comment' | t }}</label>
          <textarea
            id="commentaire"
            class="form-control"
            rows="4"
            name="commentaire"
            [(ngModel)]="commentaire"
            [placeholder]="'client.evaluationModal.commentPlaceholder' | t"
          ></textarea>
        </div>
        @if (error()) {
          <div class="alert alert-danger">{{ error() }}</div>
        }
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" (click)="close()" [disabled]="saving()">{{ 'common.actions.cancel' | t }}</button>
          <button type="button" class="btn btn-primary" (click)="submit()" [disabled]="saving() || note() < 1">
            <i class="bi bi-star-fill"></i> {{ (saving() ? 'common.actions.sending' : evaluation() ? 'common.actions.save' : 'client.evaluationModal.publish') | t }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .subject {
      margin: -6px 0 14px;
    }

    .rating {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      margin-bottom: 14px;
    }
  `,
})
export class EvaluationModal implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly rdv = input<RendezVous | null>(null);
  readonly evaluation = input<Evaluation | null>(null);
  readonly saved = output<Evaluation>();
  readonly closed = output<void>();

  protected readonly note = signal(0);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly subject = signal<{ nom: string; detail?: string; date?: string } | null>(null);
  protected commentaire = '';

  ngOnInit(): void {
    const ev = this.evaluation();
    const rdv = this.rdv();
    if (ev) {
      this.note.set(ev.note);
      this.commentaire = ev.commentaire ?? '';
      this.subject.set({ nom: ev.prestataire?.nom ?? '', date: ev.created_at });
    } else if (rdv) {
      this.subject.set({ nom: rdv.prestataire?.nom ?? '', detail: rdv.categorie?.nom, date: rdv.date });
    }
  }

  protected close(): void {
    if (!this.saving()) this.closed.emit();
  }

  protected submit(): void {
    if (this.note() < 1) return;
    const commentaire = this.commentaire.trim() || null;
    const ev = this.evaluation();
    const rdv = this.rdv();
    const request = ev
      ? this.api.updateEvaluation(ev.id, { note: this.note(), commentaire })
      : rdv
        ? this.api.createEvaluation({ rendez_vous_id: rdv.id, note: this.note(), commentaire })
        : null;
    if (!request) return;

    this.saving.set(true);
    this.error.set(null);
    request.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.toast.success(translate(ev ? 'client.evaluationModal.toastUpdated' : 'client.evaluationModal.toastCreated'));
        this.saved.emit(result);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
