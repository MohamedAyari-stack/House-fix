import { formatNumber } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { PrestataireDashboard, RendezVous } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage, mapsUrl } from '../../core/utils';
import { StatusBadge } from '../../shared/status-badge';
import { currentLocale, translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';

interface Trend {
  text: string;
  up: boolean | null;
}

/** Variation en % entre deux montants, avec gestion d'une base nulle. */
export function trend(current: number, previous: number): Trend {
  if (!previous) {
    if (!current) return { text: `${formatNumber(0, currentLocale())} %`, up: null };
    return { text: translate('prestataire.dashboard.trendNew'), up: true };
  }
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return { text: `${rounded > 0 ? '+' : ''}${formatNumber(rounded, currentLocale(), '1.0-1')} %`, up: rounded === 0 ? null : rounded > 0 };
}

@Component({
  standalone: true,
  selector: 'app-prestataire-dashboard',
  imports: [RouterLink, StatusBadge, ...I18N],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class PrestataireDashboardPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly user = this.auth.user;
  protected readonly data = signal<PrestataireDashboard | null>(null);
  protected readonly loading = signal(true);
  protected readonly savingAvailability = signal(false);

  protected readonly available = computed(() => !!this.user()?.prestataire?.is_available);
  protected readonly jourTrend = computed(() => {
    const d = this.data();
    return d ? trend(d.revenus_jour, d.revenus_hier) : null;
  });
  protected readonly semaineTrend = computed(() => {
    const d = this.data();
    return d ? trend(d.revenus_semaine, d.revenus_semaine_derniere) : null;
  });
  protected readonly next = computed(() => this.data()?.prochaine_intervention ?? null);
  protected readonly mapEmbed = computed<SafeResourceUrl | null>(() => {
    const rdv = this.next();
    if (!rdv || rdv.latitude == null || rdv.longitude == null) return null;
    const lat = Number(rdv.latitude);
    const lng = Number(rdv.longitude);
    const url =
      `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}` +
      `&layer=mapnik&marker=${lat},${lng}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  constructor() {
    this.api.prestataireDashboard().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected maps(rdv: RendezVous): string {
    return mapsUrl(rdv.latitude, rdv.longitude, rdv.address);
  }

  protected toggleAvailability(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.checked;
    this.savingAvailability.set(true);
    this.api.setAvailability(value).subscribe({
      next: (user) => {
        this.auth.setUser(user);
        this.savingAvailability.set(false);
        this.toast.success(translate(value ? 'prestataire.dashboard.nowAvailable' : 'prestataire.dashboard.nowUnavailable'));
      },
      error: (err) => {
        input.checked = !value;
        this.savingAvailability.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }
}
