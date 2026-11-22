import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { LITIGE_STATUTS, Litige, LitigeStatut, Role, litigeStatutLabel, roleLabel } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage } from '../../core/utils';
import { translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';
import { StatusBadge } from '../../shared/status-badge';

type Tab = 'tous' | LitigeStatut;

@Component({
  standalone: true,
  selector: 'app-admin-litiges',
  imports: [...I18N, FormsModule, StatusBadge],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h2>{{ 'admin.litiges.title' | t }}</h2>
          <p>{{ 'admin.litiges.subtitle' | t }}</p>
        </div>
      </div>

      <div class="tabs">
        @for (t of tabs; track t) {
          <button type="button" [class.active]="tab() === t" (click)="tab.set(t)">
            {{ t === 'tous' ? ('admin.shared.all' | t) : statutLabel(t) }} ({{ counts()[t] ?? 0 }})
          </button>
        }
      </div>

      @if (loading()) {
        <div class="spinner"></div>
      } @else {
        <div class="stack">
          @for (l of filtered(); track l.id) {
            <div class="card">
              <div class="row-between">
                <h3>{{ l.sujet }}</h3>
                <app-status-badge [status]="l.statut" kind="litige" />
              </div>
              <div class="small muted meta">
                {{ 'admin.litiges.openedOn' | t: { date: (l.created_at | appDate: 'datetime') } }} ·
                {{ 'admin.shared.rdvRef' | t: { id: l.rendez_vous.id } }} · {{ l.rendez_vous.categorie.nom }} · {{ l.rendez_vous.date | appDate: 'date' }}
              </div>
              <div class="parties">
                <span class="party"><i class="bi bi-person"></i> {{ l.declarant.nom }} <span class="badge">{{ roleLabel(l.declarant.role) }}</span></span>
                <i class="bi bi-arrow-right muted"></i>
                <span class="party"><i class="bi bi-person-exclamation"></i> {{ l.cible.nom }} <span class="badge">{{ roleLabel(l.cible.role) }}</span></span>
              </div>
              <p class="desc">{{ l.description }}</p>
              @if (l.reponse_admin) {
                <div class="reply">
                  <div class="small muted">
                    <i class="bi bi-shield-check"></i> {{ 'admin.litiges.adminReply' | t }}
                    @if (l.traite_le) { · {{ l.traite_le | appDate: 'date' }} }
                  </div>
                  <p>{{ l.reponse_admin }}</p>
                </div>
              }
              <div class="card-footer">
                <button type="button" class="btn btn-primary btn-sm" (click)="open(l)"><i class="bi bi-hammer"></i> {{ 'admin.litiges.treat' | t }}</button>
                <button type="button" class="btn btn-outline btn-sm" (click)="manage(l)">
                  <i class="bi bi-person-gear"></i> {{ 'admin.litiges.manage' | t: { nom: l.cible.nom } }}
                </button>
              </div>
            </div>
          } @empty {
            <div class="card empty-state">
              <i class="bi bi-shield-check"></i>
              {{ 'admin.litiges.empty' | t }}
            </div>
          }
        </div>
      }
    </div>

    @if (current(); as l) {
      <div class="modal-backdrop" (click)="current.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>{{ 'admin.litiges.modalTitle' | t }}</h3>
          <p class="small muted mb">{{ l.sujet }} — {{ 'admin.litiges.versus' | t: { declarant: l.declarant.nom, cible: l.cible.nom } }}</p>
          <div class="form-group">
            <label class="form-label" for="lit-statut">{{ 'admin.shared.status' | t }}</label>
            <select id="lit-statut" class="form-control" [(ngModel)]="statut">
              @for (s of statuts; track s) {
                <option [value]="s">{{ statutLabel(s) }}</option>
              }
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="lit-rep">{{ 'admin.litiges.adminReply' | t }}</label>
            <textarea id="lit-rep" class="form-control" rows="4" [(ngModel)]="reponse" [placeholder]="'admin.litiges.replyPlaceholder' | t"></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" (click)="current.set(null)">{{ 'common.actions.cancel' | t }}</button>
            <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save(l)"><i class="bi bi-check-lg"></i> {{ 'common.actions.save' | t }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .meta {
      margin-top: 6px;
    }

    .parties {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 12px;
    }

    .party {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }

    .desc {
      margin-top: 12px;
      white-space: pre-line;
    }

    .reply {
      margin-top: 12px;
      padding: 10px 14px;
      border-radius: var(--radius-sm);
      background: var(--primary-soft);
      border-inline-start: 3px solid var(--primary);
    }
    .reply p {
      margin-top: 4px;
    }

    .mb {
      margin-bottom: 12px;
    }
  `,
})
export class AdminLitiges {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly statutLabel = litigeStatutLabel;
  protected readonly statuts: LitigeStatut[] = LITIGE_STATUTS;
  protected readonly tabs: Tab[] = ['tous', ...this.statuts];

  protected readonly items = signal<Litige[]>([]);
  protected readonly loading = signal(true);
  protected readonly tab = signal<Tab>('tous');
  protected readonly current = signal<Litige | null>(null);
  protected readonly saving = signal(false);
  protected statut: LitigeStatut = 'en_cours';
  protected reponse = '';

  protected readonly counts = computed(() => {
    const c: Partial<Record<Tab, number>> = { tous: this.items().length };
    for (const l of this.items()) c[l.statut] = (c[l.statut] ?? 0) + 1;
    return c;
  });

  protected readonly filtered = computed(() => {
    const t = this.tab();
    return t === 'tous' ? this.items() : this.items().filter((l) => l.statut === t);
  });

  constructor() {
    this.api.litiges().subscribe({
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

  protected roleLabel(role: Role | undefined): string {
    return role ? roleLabel(role) : '';
  }

  protected open(l: Litige): void {
    this.statut = l.statut === 'ouvert' ? 'en_cours' : l.statut;
    this.reponse = l.reponse_admin ?? '';
    this.current.set(l);
  }

  protected save(l: Litige): void {
    this.saving.set(true);
    this.api.traiterLitige(l.id, this.statut, this.reponse.trim() || null).subscribe({
      next: (updated) => {
        this.items.update((list) => list.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
        this.saving.set(false);
        this.current.set(null);
        this.toast.success(translate('admin.litiges.updated'));
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected manage(l: Litige): void {
    this.router.navigate(['/admin/utilisateurs'], { queryParams: { q: l.cible.nom } });
  }
}
