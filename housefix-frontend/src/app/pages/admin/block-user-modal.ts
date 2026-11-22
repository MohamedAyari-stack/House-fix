import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { User } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage, isoDate } from '../../core/utils';
import { translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';

/** Fenêtre de blocage d'un compte (temporaire ou définitif), partagée par les pages admin. */
@Component({
  standalone: true,
  selector: 'app-block-user-modal',
  imports: [FormsModule, ...I18N],
  template: `
    <div class="modal-backdrop" (click)="closed.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <h3>{{ 'admin.blockModal.title' | t: { nom: user().nom } }}</h3>
        <div class="form-group">
          <span class="form-label">{{ 'admin.blockModal.type' | t }}</span>
          <div class="row">
            <label class="radio"><input type="radio" name="block-type" value="temporaire" [(ngModel)]="type" /> {{ 'admin.blockModal.temporary' | t }}</label>
            <label class="radio"><input type="radio" name="block-type" value="definitif" [(ngModel)]="type" /> {{ 'admin.blockModal.permanent' | t }}</label>
          </div>
        </div>
        @if (type === 'temporaire') {
          <div class="form-group">
            <label class="form-label" for="block-until">{{ 'admin.blockModal.until' | t }}</label>
            <input id="block-until" type="date" class="form-control" [min]="tomorrow" [(ngModel)]="jusquAu" />
          </div>
        }
        <div class="form-group">
          <label class="form-label" for="block-motif">{{ 'admin.blockModal.motif' | t }}</label>
          <textarea id="block-motif" class="form-control" [(ngModel)]="motif" [placeholder]="'admin.blockModal.motifPlaceholder' | t"></textarea>
        </div>
        @if (error()) {
          <div class="alert alert-danger">{{ error() }}</div>
        }
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" (click)="closed.emit()">{{ 'common.actions.cancel' | t }}</button>
          <button type="button" class="btn btn-danger" [disabled]="saving()" (click)="submit()">
            <i class="bi bi-slash-circle"></i> {{ 'admin.blockModal.submit' | t }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .radio {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      margin-inline-end: 12px;
    }
  `,
})
export class BlockUserModal {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly user = input.required<Pick<User, 'id' | 'nom'>>();
  readonly blocked = output<User>();
  readonly closed = output<void>();

  protected readonly tomorrow = isoDate(new Date(Date.now() + 86400000));
  protected type: 'temporaire' | 'definitif' = 'temporaire';
  protected jusquAu = '';
  protected motif = '';
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.type === 'temporaire') {
      if (!this.jusquAu) {
        this.error.set(translate('admin.blockModal.dateRequired'));
        return;
      }
      if (this.jusquAu < this.tomorrow) {
        this.error.set(translate('admin.blockModal.dateFuture'));
        return;
      }
    }
    this.saving.set(true);
    this.error.set(null);
    this.api
      .bloquerUser(this.user().id, {
        type: this.type,
        jusqu_au: this.type === 'temporaire' ? this.jusquAu : null,
        motif: this.motif.trim() || null,
      })
      .subscribe({
        next: (user) => {
          this.saving.set(false);
          this.toast.success(translate('admin.blockModal.success', { nom: user.nom }));
          this.blocked.emit(user);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(errorMessage(err));
        },
      });
  }
}
