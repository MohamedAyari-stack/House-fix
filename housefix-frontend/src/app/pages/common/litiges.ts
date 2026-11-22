import { formatDate } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Litige, RendezVous } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage, fieldErrors } from '../../core/utils';
import { StatusBadge } from '../../shared/status-badge';
import { currentLocale, translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';

@Component({
  standalone: true,
  selector: 'app-litiges',
  imports: [FormsModule, StatusBadge, ...I18N],
  templateUrl: './litiges.html',
  styleUrl: './litiges.css',
})
export class Litiges {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly meId = computed(() => this.auth.user()?.id ?? 0);
  protected readonly rendezVous = signal<RendezVous[]>([]);
  protected readonly litiges = signal<Litige[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errors = signal<Record<string, string>>({});

  protected form = { rendez_vous_id: null as number | null, sujet: '', description: '' };

  constructor() {
    this.api.rendezVous().subscribe({ next: (r) => this.rendezVous.set(r), error: () => undefined });
    this.load();
  }

  private load(): void {
    this.api.litiges().subscribe({
      next: (list) => {
        this.litiges.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  /** Libellé d'un rendez-vous : « #12 · Plomberie · 13/04/2026 · Mohamed Ayari2 ». */
  protected rdvLabel(r: RendezVous): string {
    const other = r.client_id === this.meId() ? r.prestataire : r.client;
    const service = r.categorie?.nom ?? translate('pages.litiges.defaultService');
    return `#${r.id} · ${service} · ${formatDate(r.date, 'dd/MM/yyyy', currentLocale())} · ${other?.nom ?? ''}`;
  }

  protected submit(): void {
    const e: Record<string, string> = {};
    if (!this.form.rendez_vous_id) e['rendez_vous_id'] = translate('pages.litiges.errors.rdv');
    if (!this.form.sujet.trim()) e['sujet'] = translate('pages.litiges.errors.sujet');
    if (!this.form.description.trim()) e['description'] = translate('pages.litiges.errors.description');
    this.errors.set(e);
    if (Object.keys(e).length) return;

    this.saving.set(true);
    this.api
      .createLitige({
        rendez_vous_id: this.form.rendez_vous_id!,
        sujet: this.form.sujet.trim(),
        description: this.form.description.trim(),
      })
      .subscribe({
        next: (litige) => {
          this.saving.set(false);
          this.litiges.update((list) => [litige, ...list]);
          this.form = { rendez_vous_id: null, sujet: '', description: '' };
          this.toast.success(translate('pages.litiges.created'));
        },
        error: (err) => {
          this.saving.set(false);
          this.errors.set(fieldErrors(err));
          this.toast.error(errorMessage(err));
        },
      });
  }
}
