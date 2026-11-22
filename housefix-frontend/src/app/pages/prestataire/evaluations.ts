import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Evaluation } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage } from '../../core/utils';
import { Avatar } from '../../shared/avatar';
import { StarRating } from '../../shared/star-rating';
import { translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';

@Component({
  standalone: true,
  selector: 'app-prestataire-evaluations',
  imports: [FormsModule, Avatar, StarRating, ...I18N],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h2>{{ 'prestataire.evaluations.title' | t }}</h2>
          <p>{{ 'prestataire.evaluations.subtitle' | t }}</p>
        </div>
      </div>

      @if (loading()) {
        <div class="spinner"></div>
      } @else {
        <div class="card summary">
          <div class="big">
            <div class="avg">{{ average() | appNumber: '1.1-1' }}</div>
            <app-star-rating [value]="average()" />
            <div class="muted small">{{ (items().length === 1 ? 'prestataire.evaluations.count.one' : 'prestataire.evaluations.count.other') | t: { count: items().length } }}</div>
          </div>
          <div class="dist">
            @for (row of distribution(); track row.note) {
              <div class="dist-row">
                <span class="small nowrap">{{ row.note }} <i class="bi bi-star-fill star"></i></span>
                <div class="bar"><div class="fill" [style.width.%]="row.pct"></div></div>
                <span class="small muted count">{{ row.count }}</span>
              </div>
            }
          </div>
        </div>

        <div class="stack">
          @for (e of items(); track e.id) {
            <div class="card">
              <div class="row-between">
                <div class="row">
                  <app-avatar [nom]="e.client?.nom" [photoUrl]="e.client?.photo_url" />
                  <div>
                    <strong>{{ e.client?.nom ?? ('prestataire.evaluations.client' | t) }}</strong>
                    <div class="small muted">{{ e.created_at | appDate: 'long' }}</div>
                  </div>
                </div>
                <app-star-rating [value]="e.note" />
              </div>
              <p class="comment">{{ e.commentaire || ('prestataire.evaluations.noComment' | t) }}</p>

              @if (e.reponse) {
                <div class="reply">
                  <div class="small muted"><i class="bi bi-reply-fill"></i> {{ 'prestataire.evaluations.yourReply' | t }}</div>
                  <p>{{ e.reponse }}</p>
                </div>
              } @else {
                <div class="reply-form">
                  <textarea
                    class="form-control"
                    rows="2"
                    [placeholder]="'prestataire.evaluations.replyPlaceholder' | t"
                    [(ngModel)]="drafts[e.id]"
                    [attr.aria-label]="'prestataire.evaluations.replyTo' | t: { nom: e.client?.nom ?? ('prestataire.evaluations.client' | t) }"
                  ></textarea>
                  <button type="button" class="btn btn-primary btn-sm" [disabled]="sending() === e.id || !drafts[e.id]?.trim()" (click)="reply(e)">
                    <i class="bi bi-send"></i> {{ 'prestataire.evaluations.replyButton' | t }}
                  </button>
                </div>
              }
            </div>
          } @empty {
            <div class="card empty-state">
              <i class="bi bi-star"></i>
              {{ 'prestataire.evaluations.empty' | t }}
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .summary {
      display: grid;
      grid-template-columns: 200px minmax(0, 1fr);
      gap: 24px;
      align-items: center;
    }

    .big {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .avg {
      font-family: "Poppins", sans-serif;
      font-size: 3rem;
      font-weight: 700;
      line-height: 1;
    }

    .dist {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .dist-row {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr) 30px;
      gap: 10px;
      align-items: center;
    }

    .star {
      color: #f59e0b;
      font-size: 11px;
    }

    .bar {
      height: 8px;
      border-radius: 999px;
      background: var(--surface-2);
      overflow: hidden;
    }

    .fill {
      height: 100%;
      border-radius: 999px;
      background: #f59e0b;
      transition: width 0.4s;
    }

    .count {
      text-align: end;
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

    .reply-form {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: flex-end;
    }

    .reply-form textarea {
      min-height: 60px;
    }

    @media (max-width: 700px) {
      .summary {
        grid-template-columns: 1fr;
      }
      .reply {
        margin-inline-start: 8px;
      }
    }
  `,
})
export class PrestataireEvaluations {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<Evaluation[]>([]);
  protected readonly loading = signal(true);
  protected readonly sending = signal<number | null>(null);
  protected drafts: Record<number, string> = {};

  protected readonly average = computed(() => {
    const list = this.items();
    if (!list.length) return 0;
    return list.reduce((s, e) => s + e.note, 0) / list.length;
  });

  protected readonly distribution = computed(() => {
    const list = this.items();
    return [5, 4, 3, 2, 1].map((note) => {
      const count = list.filter((e) => Math.round(e.note) === note).length;
      return { note, count, pct: list.length ? (count / list.length) * 100 : 0 };
    });
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

  protected reply(e: Evaluation): void {
    const text = this.drafts[e.id]?.trim();
    if (!text) return;
    this.sending.set(e.id);
    this.api.repondreEvaluation(e.id, text).subscribe({
      next: (updated) => {
        this.items.update((list) => list.map((x) => (x.id === e.id ? { ...x, ...updated, client: updated.client ?? x.client } : x)));
        delete this.drafts[e.id];
        this.sending.set(null);
        this.toast.success(translate('prestataire.evaluations.published'));
      },
      error: (err) => {
        this.sending.set(null);
        this.toast.error(errorMessage(err));
      },
    });
  }
}
