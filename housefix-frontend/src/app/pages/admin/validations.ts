import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { User } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage } from '../../core/utils';
import { translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';
import { Avatar } from '../../shared/avatar';
import { RefusModal } from './refus-modal';

@Component({
  standalone: true,
  selector: 'app-validations',
  imports: [...I18N, Avatar, RefusModal],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h2>{{ 'admin.validations.title' | t }}</h2>
          <p>{{ 'admin.validations.subtitle' | t }}</p>
        </div>
        @if (!loading()) {
          <span class="badge badge-warning">{{ 'admin.validations.pendingCount' | t: { count: items().length } }}</span>
        }
      </div>

      @if (loading()) {
        <div class="spinner"></div>
      } @else {
        <div class="grid-cards">
          @for (u of items(); track u.id) {
            <div class="card v-card">
              <div class="row">
                <app-avatar [nom]="u.nom" [photoUrl]="u.photo_url" size="lg" />
                <div class="ident">
                  <h3>{{ u.nom }}</h3>
                  <div class="small muted">{{ u.email }}</div>
                  <span class="badge badge-warning mt">{{ 'admin.validations.pending' | t }}</span>
                </div>
              </div>
              <div class="divider"></div>
              <div class="stack details">
                <div class="info-line"><i class="bi bi-telephone"></i><span>{{ u.telephone ?? ('admin.shared.notProvided' | t) }}</span></div>
                <div class="info-line"><i class="bi bi-geo-alt"></i><span>{{ u.gouvernorat ? (u.gouvernorat | gouv) : ('admin.shared.notProvided' | t) }}</span></div>
                <div class="info-line"><i class="bi bi-tools"></i><span><span class="lbl">{{ 'admin.shared.category' | t }}</span>{{ u.prestataire?.categorie?.nom ?? '—' }}</span></div>
                <div class="info-line"><i class="bi bi-briefcase"></i><span><span class="lbl">{{ 'admin.validations.specialty' | t }}</span>{{ u.prestataire?.specialite || '—' }}</span></div>
                <div class="info-line">
                  <i class="bi bi-award"></i>
                  <span><span class="lbl">{{ 'admin.validations.experience' | t }}</span>
                    @if (u.prestataire?.experience_annees != null) {
                      {{ (u.prestataire?.experience_annees === 1 ? 'admin.validations.years.one' : 'admin.validations.years.other') | t: { count: u.prestataire?.experience_annees } }}
                    } @else { — }
                  </span>
                </div>
                <div class="info-line"><i class="bi bi-patch-check"></i><span><span class="lbl">{{ 'admin.validations.certifications' | t }}</span>{{ u.prestataire?.certifications || ('admin.validations.noCertifications' | t) }}</span></div>
                <div class="info-line"><i class="bi bi-calendar-plus"></i><span><span class="lbl">{{ 'admin.validations.registeredOn' | t }}</span>{{ u.created_at | appDate: 'date' }}</span></div>
              </div>
              <div class="card-footer">
                <button type="button" class="btn btn-success grow" [disabled]="busy() === u.id" (click)="valider(u)">
                  <i class="bi bi-check-lg"></i> {{ 'admin.shared.validate' | t }}
                </button>
                <button type="button" class="btn btn-outline grow" [disabled]="busy() === u.id" (click)="refusing.set(u)">
                  <i class="bi bi-x-lg"></i> {{ 'admin.shared.refuse' | t }}
                </button>
              </div>
            </div>
          } @empty {
            <div class="card empty-state full">
              <i class="bi bi-patch-check"></i>
              {{ 'admin.validations.empty' | t }}
            </div>
          }
        </div>
      }
    </div>

    @if (refusing(); as u) {
      <app-refus-modal [nom]="u.nom" [busy]="busy() === u.id" (confirmed)="refuser(u, $event)" (closed)="refusing.set(null)" />
    }
  `,
  styles: `
    .v-card {
      display: flex;
      flex-direction: column;
    }

    .ident {
      min-width: 0;
    }

    .mt {
      margin-top: 6px;
    }

    .details {
      flex: 1;
      gap: 10px;
    }

    .lbl {
      display: block;
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .grow {
      flex: 1;
    }

    .full {
      grid-column: 1/-1;
    }
  `,
})
export class Validations {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<User[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal<number | null>(null);
  protected readonly refusing = signal<User | null>(null);

  constructor() {
    this.api.adminValidations().subscribe({
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

  protected valider(u: User): void {
    this.busy.set(u.id);
    this.api.validerPrestataire(u.id).subscribe({
      next: () => {
        this.remove(u.id);
        this.toast.success(translate('admin.validations.validated', { nom: u.nom }));
      },
      error: (err) => this.fail(err),
    });
  }

  protected refuser(u: User, motif: string | null): void {
    this.busy.set(u.id);
    this.api.refuserPrestataire(u.id, motif).subscribe({
      next: () => {
        this.remove(u.id);
        this.refusing.set(null);
        this.toast.success(translate('admin.shared.refused', { nom: u.nom }));
      },
      error: (err) => this.fail(err),
    });
  }

  private remove(id: number): void {
    this.busy.set(null);
    this.items.update((list) => list.filter((u) => u.id !== id));
  }

  private fail(err: unknown): void {
    this.busy.set(null);
    this.toast.error(errorMessage(err));
  }
}
