import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18N } from '../../i18n/pipes';

/** Fenêtre de refus d'une inscription de prestataire, avec motif optionnel. */
@Component({
  standalone: true,
  selector: 'app-refus-modal',
  imports: [FormsModule, ...I18N],
  template: `
    <div class="modal-backdrop" (click)="closed.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <h3>{{ 'admin.refusModal.title' | t: { nom: nom() } }}</h3>
        <div class="form-group">
          <label class="form-label" for="refus-motif">{{ 'admin.refusModal.motif' | t }}</label>
          <textarea id="refus-motif" class="form-control" [(ngModel)]="motif" [placeholder]="'admin.refusModal.motifPlaceholder' | t"></textarea>
          <span class="form-hint">{{ 'admin.refusModal.hint' | t }}</span>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" (click)="closed.emit()">{{ 'common.actions.cancel' | t }}</button>
          <button type="button" class="btn btn-danger" [disabled]="busy()" (click)="confirmed.emit(motif.trim() || null)">
            <i class="bi bi-x-lg"></i> {{ 'admin.shared.refuse' | t }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class RefusModal {
  readonly nom = input.required<string>();
  readonly busy = input(false);
  readonly confirmed = output<string | null>();
  readonly closed = output<void>();
  protected motif = '';
}
