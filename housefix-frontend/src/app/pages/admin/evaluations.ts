import { Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { Evaluation } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage } from '../../core/utils';
import { translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';
import { Avatar } from '../../shared/avatar';
import { StarRating } from '../../shared/star-rating';

type Filter = 'tous' | 'negatifs' | 'positifs';

@Component({
  standalone: true,
  selector: 'app-admin-evaluations',
  imports: [...I18N, Avatar, StarRating],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h2>{{ 'admin.evaluations.title' | t }}</h2>
          <p>{{ 'admin.evaluations.subtitle' | t }}</p>
        </div>
      </div>

      <div class="tabs">
        @for (f of filters; track f) {
          <button type="button" [class.active]="filter() === f" (click)="filter.set(f)">
            {{ 'admin.evaluations.filters.' + f | t }} ({{ counts()[f] }})
          </button>
        }
      </div>

      @if (loading()) {
        <div class="spinner"></div>
      } @else {
        <div class="stack">
          @for (e of filtered(); track e.id) {
            <div class="card" [class.negative]="e.note <= 2">
              <div class="row-between">
                <div class="row parties">
                  <app-avatar [nom]="e.client?.nom" [photoUrl]="e.client?.photo_url" />
                  <div>
                    <strong>{{ e.client?.nom ?? ('common.roles.client' | t) }}</strong>
                    <i class="bi bi-arrow-right muted arrow"></i>
                    <strong>{{ e.prestataire?.nom ?? ('common.roles.prestataire' | t) }}</strong>
                    <div class="small muted">{{ e.created_at | appDate: 'datetime' }} · {{ 'admin.shared.rdvRef' | t: { id: e.rendez_vous_id } }}</div>
                  </div>
                </div>
                <app-star-rating [value]="e.note" />
              </div>
              <p class="comment">{{ e.commentaire || ('admin.evaluations.noComment' | t) }}</p>
              @if (e.reponse) {
                <div class="reply">
                  <div class="small muted"><i class="bi bi-reply-fill"></i> {{ 'admin.evaluations.reply' | t }}</div>
                  <p>{{ e.reponse }}</p>
                </div>
              }
              <div class="card-footer">
                <button type="button" class="btn btn-danger btn-sm" [disabled]="deleting() === e.id" (click)="remove(e)">
                  <i class="bi bi-trash"></i> {{ 'common.actions.delete' | t }}
                </button>
              </div>
            </div>
          } @empty {
            <div class="card empty-state">
              <i class="bi bi-chat-square-heart"></i>
              {{ 'admin.evaluations.empty' | t }}
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .negative {
      border-inline-start: 4px solid var(--danger);
    }

    .parties {
      flex-wrap: nowrap;
      min-width: 0;
    }

    .arrow {
      margin-inline: 6px;
    }

    .comment {
      margin-top: 12px;
    }

    .reply {
      margin-block-start: 12px;
      margin-inline-start: 24px;
      padding: 10px 14px;
      border-radius: 14px;
      border-start-start-radius: 4px;
      background: var(--primary-soft);
      border-inline-start: 3px solid var(--primary);
    }
    .reply p {
      margin-top: 4px;
    }

    @media (max-width: 700px) {
      .reply {
        margin-inline-start: 8px;
      }
    }
  `,
})
export class AdminEvaluations {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  protected readonly filters: Filter[] = ['tous', 'negatifs', 'positifs'];

  protected readonly items = signal<Evaluation[]>([]);
  protected readonly loading = signal(true);
  protected readonly filter = signal<Filter>('tous');
  protected readonly deleting = signal<number | null>(null);

  protected readonly counts = computed(() => {
    const list = this.items();
    return {
      tous: list.length,
      negatifs: list.filter((e) => e.note <= 2).length,
      positifs: list.filter((e) => e.note >= 4).length,
    };
  });

  protected readonly filtered = computed(() => {
    const f = this.filter();
    const list = this.items();
    if (f === 'negatifs') return list.filter((e) => e.note <= 2);
    if (f === 'positifs') return list.filter((e) => e.note >= 4);
    return list;
  });

  constructor() {
    this.api.evaluations().subscribe({
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

  protected remove(e: Evaluation): void {
    const message = translate('admin.evaluations.confirmDelete', {
      client: e.client?.nom ?? translate('admin.evaluations.thisClient'),
      prestataire: e.prestataire?.nom ?? translate('admin.evaluations.thisPrestataire'),
    });
    if (!window.confirm(message)) return;
    this.deleting.set(e.id);
    this.api.deleteEvaluation(e.id).subscribe({
      next: () => {
        this.deleting.set(null);
        this.items.update((list) => list.filter((x) => x.id !== e.id));
        this.toast.success(translate('admin.evaluations.deleted'));
      },
      error: (err) => {
        this.deleting.set(null);
        this.toast.error(errorMessage(err));
      },
    });
  }
}
