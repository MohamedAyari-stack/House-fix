import { formatDate, formatNumber } from '@angular/common';
import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import Chart from 'chart.js/auto';
import { ApiService } from '../../core/api.service';
import { Facture, Revenus } from '../../core/models';
import { ThemeService } from '../../core/theme.service';
import { ToastService } from '../../core/toast.service';
import { errorMessage } from '../../core/utils';
import { currentLang, currentLocale, translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

@Component({
  standalone: true,
  selector: 'app-revenus',
  imports: [RouterLink, ...I18N],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h2>{{ 'prestataire.revenus.title' | t }}</h2>
          <p>{{ 'prestataire.revenus.subtitle' | t }}</p>
        </div>
      </div>

      @if (loading()) {
        <div class="spinner"></div>
      } @else if (data(); as d) {
        <div class="grid-3">
          <div class="card rev-card primary">
            <div class="rev-icon"><i class="bi bi-wallet2"></i></div>
            <div>
              <div class="muted small">{{ 'prestataire.revenus.total' | t }}</div>
              <div class="rev-value">{{ d.total | appNumber: '1.2-2' }} {{ 'common.units.currency' | t }}</div>
              <div class="small muted">{{ 'prestataire.revenus.paidInvoices' | t }}</div>
            </div>
          </div>
          <div class="card rev-card success">
            <div class="rev-icon"><i class="bi bi-calendar-check"></i></div>
            <div>
              <div class="muted small">{{ 'prestataire.revenus.thisMonth' | t }}</div>
              <div class="rev-value">{{ d.mois_courant | appNumber: '1.2-2' }} {{ 'common.units.currency' | t }}</div>
              <div class="small">
                <span [class.text-success]="d.evolution_pct > 0" [class.text-danger]="d.evolution_pct < 0">
                  <i class="bi" [class.bi-arrow-up-right]="d.evolution_pct >= 0" [class.bi-arrow-down-right]="d.evolution_pct < 0"></i>
                  {{ d.evolution_pct > 0 ? '+' : '' }}{{ d.evolution_pct | appNumber: '1.0-1' }} %
                </span>
                <span class="muted"> {{ 'prestataire.revenus.vsLastMonth' | t }}</span>
              </div>
            </div>
          </div>
          <div class="card rev-card violet">
            <div class="rev-icon"><i class="bi bi-clock-history"></i></div>
            <div>
              <div class="muted small">{{ 'prestataire.revenus.lastMonth' | t }}</div>
              <div class="rev-value">{{ d.mois_dernier | appNumber: '1.2-2' }} {{ 'common.units.currency' | t }}</div>
              <div class="small muted">{{ 'prestataire.revenus.previousMonth' | t }}</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>{{ 'prestataire.revenus.monthly' | t }}</h3>
            <span class="small muted">{{ 'prestataire.revenus.last6' | t }}</span>
          </div>
          <div class="chart-box"><canvas #chart></canvas></div>
        </div>
      }

      <div class="card">
        <div class="card-header">
          <h3>{{ 'prestataire.revenus.lastPaid' | t }}</h3>
          <a routerLink="/prestataire/factures" class="btn btn-ghost btn-sm">{{ 'prestataire.revenus.allInvoices' | t }} <i class="bi bi-arrow-right"></i></a>
        </div>
        @if (facturesLoading()) {
          <div class="spinner"></div>
        } @else {
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'prestataire.revenus.number' | t }}</th>
                  <th>{{ 'prestataire.revenus.paymentDate' | t }}</th>
                  <th>{{ 'prestataire.revenus.client' | t }}</th>
                  <th class="text-right">{{ 'prestataire.revenus.amount' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (f of payees(); track f.id) {
                  <tr>
                    <td><a [routerLink]="['/prestataire/factures', f.id]"><strong>{{ f.numero }}</strong></a></td>
                    <td class="nowrap">{{ (f.paid_at ?? f.date) | appDate: 'date' }}</td>
                    <td>{{ f.rendez_vous?.client?.nom ?? ('common.states.none' | t) }}</td>
                    <td class="text-right nowrap"><strong>{{ f.montant | appNumber: '1.2-2' }} {{ 'common.units.currency' | t }}</strong></td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4">
                      <div class="empty-state"><i class="bi bi-receipt"></i>{{ 'prestataire.revenus.empty' | t }}</div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .rev-card {
      display: flex;
      gap: 14px;
      align-items: center;
      border-inline-start: 4px solid var(--accent);
      --accent: var(--primary);
      --accent-soft: var(--primary-soft);
    }
    .rev-card.success {
      --accent: var(--success);
      --accent-soft: var(--success-soft);
    }
    .rev-card.violet {
      --accent: var(--violet);
      --accent-soft: var(--violet-soft);
    }

    .rev-icon {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      font-size: 1.3rem;
      background: var(--accent-soft);
      color: var(--accent);
    }

    .rev-value {
      font-family: "Poppins", sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      margin: 2px 0;
    }

    .chart-box {
      position: relative;
      height: 320px;
    }

    @media (max-width: 700px) {
      .chart-box {
        height: 240px;
      }
    }
  `,
})
export class RevenusPage {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly theme = inject(ThemeService);

  protected readonly data = signal<Revenus | null>(null);
  protected readonly loading = signal(true);
  protected readonly factures = signal<Facture[]>([]);
  protected readonly facturesLoading = signal(true);
  protected readonly payees = computed(() =>
    this.factures()
      .filter((f) => f.statut_paiement === 'payee')
      .sort((a, b) => (b.paid_at ?? b.date).localeCompare(a.paid_at ?? a.date))
      .slice(0, 10),
  );

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('chart');
  private chart: Chart | null = null;

  constructor() {
    this.api.revenus().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(errorMessage(err));
      },
    });
    this.api.factures().subscribe({
      next: (list) => {
        this.factures.set(list);
        this.facturesLoading.set(false);
      },
      error: () => this.facturesLoading.set(false),
    });

    effect(() => {
      this.theme.theme();
      currentLang(); // labels et infobulles reconstruits au changement de langue
      const canvas = this.canvas();
      const data = this.data();
      if (canvas && data) this.render(canvas.nativeElement, data);
    });
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }

  private render(canvas: HTMLCanvasElement, data: Revenus): void {
    this.chart?.destroy();
    const primary = cssVar('--primary');
    const muted = cssVar('--text-muted');
    const border = cssVar('--border');
    const surface = cssVar('--surface');
    const locale = currentLocale();
    const currency = translate('common.units.currency');
    const rtl = currentLang() === 'ar';
    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.mensuel.map((m) => formatDate(`${m.mois}-01T00:00:00`, 'MMM y', locale)),
        datasets: [
          {
            label: translate('prestataire.revenus.chartLabel'),
            data: data.mensuel.map((m) => m.total),
            borderColor: primary,
            backgroundColor: primary + '26',
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: surface,
            pointBorderColor: primary,
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            rtl,
            textDirection: rtl ? 'rtl' : 'ltr',
            callbacks: {
              label: (ctx) => ` ${formatNumber(Number(ctx.parsed.y), locale, '1.2-2')} ${currency}`,
            },
          },
        },
        scales: {
          x: { ticks: { color: muted }, grid: { display: false }, border: { color: border } },
          y: {
            beginAtZero: true,
            ticks: { color: muted, callback: (v) => `${formatNumber(Number(v), locale, '1.0-2')} ${currency}` },
            grid: { color: border },
            border: { display: false },
          },
        },
      },
    });
  }
}
