import { formatDate } from '@angular/common';
import { Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import Chart from 'chart.js/auto';
import { ApiService } from '../../core/api.service';
import { AdminDashboard } from '../../core/models';
import { ThemeService } from '../../core/theme.service';
import { ToastService } from '../../core/toast.service';
import { errorMessage } from '../../core/utils';
import { currentLang, currentLocale, translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';
import { StatusBadge } from '../../shared/status-badge';
import { ExportPanel } from './export-panel';

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Libellés des derniers mois dans la langue courante. L'API renvoie les `count` derniers mois,
 * du plus ancien au mois en cours, avec un libellé français : on les recalcule côté client.
 */
function monthLabels(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) =>
    formatDate(new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1), 'MMM y', currentLocale()),
  );
}

@Component({
  standalone: true,
  selector: 'app-admin-dashboard',
  imports: [...I18N, RouterLink, StatusBadge, ExportPanel],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class AdminDashboardPage {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly theme = inject(ThemeService);

  protected readonly data = signal<AdminDashboard | null>(null);
  protected readonly loading = signal(true);
  /** Panneau « Exporter les données » (CSV / Excel). */
  protected readonly exportOpen = signal(false);

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('chart');
  private chart: Chart | null = null;

  constructor() {
    this.api.adminDashboard().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(errorMessage(err));
      },
    });

    effect(() => {
      this.theme.theme();
      currentLang(); // reconstruit les libellés du graphique au changement de langue
      const canvas = this.canvas();
      const data = this.data();
      if (canvas && data) this.render(canvas.nativeElement, data);
    });
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }

  private render(canvas: HTMLCanvasElement, data: AdminDashboard): void {
    this.chart?.destroy();
    const primary = cssVar('--primary');
    const muted = cssVar('--text-muted');
    const border = cssVar('--border');
    const rtl = currentLang() === 'ar';
    this.chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: monthLabels(data.rdv_par_mois.length),
        datasets: [
          {
            label: translate('admin.dashboard.chartDataset'),
            data: data.rdv_par_mois.map((m) => m.total),
            backgroundColor: primary,
            borderRadius: 8,
            maxBarThickness: 42,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        locale: currentLocale(),
        plugins: { legend: { display: false }, tooltip: { rtl } },
        scales: {
          x: { reverse: rtl, ticks: { color: muted }, grid: { display: false }, border: { color: border } },
          y: {
            beginAtZero: true,
            position: rtl ? 'right' : 'left',
            ticks: { color: muted, precision: 0 },
            grid: { color: border },
            border: { display: false },
          },
        },
      },
    });
  }
}
