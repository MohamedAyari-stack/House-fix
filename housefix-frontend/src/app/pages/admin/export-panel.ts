import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { downloadBlob, errorMessage } from '../../core/utils';
import { translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';

type Dataset = 'statistiques' | 'utilisateurs' | 'prestataires' | 'rendez_vous' | 'factures' | 'litiges' | 'tout';
type Format = 'xlsx' | 'csv';

/** Export des données de la plateforme (GET /admin/export) : jeu de données, période, format Excel ou CSV. */
@Component({
  standalone: true,
  selector: 'app-export-panel',
  imports: [FormsModule, ...I18N],
  template: `
    <form class="card export" (ngSubmit)="download()" [attr.aria-labelledby]="'export-title'">
      <div class="card-header">
        <h3 id="export-title"><i class="bi bi-file-earmark-arrow-down"></i> {{ 'admin.export.title' | t }}</h3>
        <button type="button" class="btn btn-ghost btn-icon" (click)="closed.emit()" [attr.aria-label]="'common.actions.close' | t">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <p class="muted small intro">{{ 'admin.export.intro' | t }}</p>

      <div class="grid">
        <div class="form-group">
          <label class="form-label" for="export-dataset">{{ 'admin.export.dataset' | t }}</label>
          <select id="export-dataset" class="form-control" name="dataset" [ngModel]="dataset()" (ngModelChange)="setDataset($event)">
            @for (d of datasets; track d) {
              <option [value]="d">{{ 'admin.export.datasets.' + d | t }}</option>
            }
          </select>
        </div>

        <fieldset class="form-group period">
          <legend class="form-label">{{ 'admin.export.period' | t }}</legend>
          <div class="dates">
            <label>
              <span>{{ 'admin.export.from' | t }}</span>
              <input class="form-control" type="date" name="du" [(ngModel)]="du" [max]="au || null" />
            </label>
            <label>
              <span>{{ 'admin.export.to' | t }}</span>
              <input class="form-control" type="date" name="au" [(ngModel)]="au" [min]="du || null" />
            </label>
          </div>
          <span class="form-hint">{{ 'admin.export.periodHint' | t }}</span>
        </fieldset>

        <fieldset class="form-group">
          <legend class="form-label">{{ 'admin.export.format' | t }}</legend>
          <div class="tabs" role="radiogroup">
            <button type="button" role="radio" [attr.aria-checked]="format() === 'xlsx'" [class.active]="format() === 'xlsx'" (click)="format.set('xlsx')">
              <i class="bi bi-file-earmark-excel"></i> {{ 'admin.export.excel' | t }}
            </button>
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="format() === 'csv'"
              [class.active]="format() === 'csv'"
              [disabled]="dataset() === 'tout'"
              (click)="format.set('csv')"
            >
              <i class="bi bi-filetype-csv"></i> {{ 'admin.export.csv' | t }}
            </button>
          </div>
          @if (dataset() === 'tout') {
            <span class="form-hint">{{ 'admin.export.csvOnlyOne' | t }}</span>
          } @else if (dataset() === 'statistiques' && format() === 'csv') {
            <span class="form-hint">{{ 'admin.export.statsCsv' | t }}</span>
          }
        </fieldset>
      </div>

      @if (error()) {
        <div class="alert alert-danger" role="alert">{{ error() }}</div>
      }

      <div class="footer">
        <span class="muted small"><i class="bi bi-shield-lock"></i> {{ 'admin.export.privacy' | t }}</span>
        <button class="btn btn-primary" type="submit" [disabled]="loading()">
          <i class="bi bi-download"></i> {{ (loading() ? 'admin.export.downloading' : 'admin.export.download') | t }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .export {
      margin-bottom: 20px;
    }
    .intro {
      margin: 0 0 14px;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(200px, 1fr) minmax(260px, 1.4fr) minmax(200px, 1fr);
      gap: 16px;
      align-items: start;
    }
    fieldset {
      border: none;
      margin: 0;
      padding: 0;
      min-width: 0;
    }
    legend {
      padding: 0;
    }
    .dates {
      display: flex;
      gap: 10px;
    }
    .dates label {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .tabs button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 6px;
      padding-top: 14px;
      border-top: 1px solid var(--border);
    }
    @media (max-width: 1000px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ExportPanel {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly closed = output<void>();

  protected readonly datasets: Dataset[] = ['statistiques', 'utilisateurs', 'prestataires', 'rendez_vous', 'factures', 'litiges', 'tout'];
  protected readonly dataset = signal<Dataset>('statistiques');
  protected readonly format = signal<Format>('xlsx');
  protected du = '';
  protected au = '';
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly filename = computed(
    () => `housefix-${this.dataset().replace('_', '-')}-${new Date().toISOString().slice(0, 10)}.${this.format()}`,
  );

  protected setDataset(d: Dataset): void {
    this.dataset.set(d);
    // Le classeur complet (plusieurs feuilles) n'existe qu'en Excel.
    if (d === 'tout') this.format.set('xlsx');
  }

  protected download(): void {
    this.error.set(null);
    if (this.du && this.au && this.au < this.du) {
      this.error.set(translate('admin.export.errors.dates'));
      return;
    }
    this.loading.set(true);
    const name = this.filename();
    this.api.adminExport({ type: this.dataset(), format: this.format(), du: this.du || null, au: this.au || null }).subscribe({
      next: (blob) => {
        this.loading.set(false);
        downloadBlob(blob, name);
        this.toast.success(translate('admin.export.done', { name }));
      },
      error: async (err) => {
        this.loading.set(false);
        this.error.set(await blobErrorMessage(err));
      },
    });
  }
}

/** Avec responseType 'blob', le JSON d'erreur de Laravel arrive dans un Blob : on le relit pour afficher son message. */
async function blobErrorMessage(err: unknown): Promise<string> {
  if (err instanceof HttpErrorResponse && err.error instanceof Blob) {
    try {
      const body = JSON.parse(await err.error.text());
      return errorMessage(new HttpErrorResponse({ status: err.status, error: body }));
    } catch {
      /* corps illisible : message générique ci-dessous */
    }
  }
  return errorMessage(err);
}
