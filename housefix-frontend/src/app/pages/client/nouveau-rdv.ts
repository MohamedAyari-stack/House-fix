import { formatNumber } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Categorie, PrestataireCard } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage, fieldErrors, isoDate, precisePosition } from '../../core/utils';
import { Avatar } from '../../shared/avatar';
import { StarRating } from '../../shared/star-rating';
import { currentLocale, translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';

@Component({
  standalone: true,
  selector: 'app-nouveau-rdv',
  imports: [...I18N, FormsModule, RouterLink, Avatar, StarRating],
  templateUrl: './nouveau-rdv.html',
  styleUrl: './nouveau-rdv.css',
})
export class NouveauRdv {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly today = isoDate(new Date());
  protected readonly categories = signal<Categorie[]>([]);
  protected readonly prestataires = signal<PrestataireCard[]>([]);
  protected readonly loadingPrestataires = signal(false);
  protected readonly categorieId = signal<number | null>(null);
  protected readonly prestataireId = signal<number | null>(null);
  protected readonly coords = signal<{ lat: number; lng: number } | null>(null);
  protected readonly locating = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errors = signal<Record<string, string>>({});

  protected form = { date: '', heure: '', address: '', description: '' };

  protected readonly selected = computed(() => this.prestataires().find((p) => p.id === this.prestataireId()) ?? null);

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const presetCategorie = Number(params.get('categorie')) || null;
    const presetPrestataire = Number(params.get('prestataire')) || null;

    const user = this.auth.user();
    this.form.address = user?.address ?? '';
    if (user?.latitude != null && user?.longitude != null) {
      this.coords.set({ lat: user.latitude, lng: user.longitude });
    }

    this.api.categories().subscribe({
      next: (c) => this.categories.set(c),
      error: (err) => this.toast.error(errorMessage(err)),
    });

    if (presetCategorie) {
      this.categorieId.set(presetCategorie);
      this.prestataireId.set(presetPrestataire);
      this.loadPrestataires(presetPrestataire);
    }
  }

  protected onCategorie(id: number | null): void {
    this.categorieId.set(id);
    this.prestataireId.set(null);
    this.prestataires.set([]);
    if (id) this.loadPrestataires(null);
  }

  private loadPrestataires(keep: number | null): void {
    const categorie_id = this.categorieId();
    if (!categorie_id) return;
    const c = this.coords();
    this.loadingPrestataires.set(true);
    this.api.searchPrestataires({ categorie_id, sort: 'recommande', lat: c?.lat, lng: c?.lng }).subscribe({
      next: (list) => {
        if (this.categorieId() !== categorie_id) return;
        this.prestataires.set(list);
        this.loadingPrestataires.set(false);
        if (keep && !list.some((p) => p.id === keep)) {
          this.toast.info(translate('client.nouveauRdv.toasts.unavailable'));
          this.prestataireId.set(null);
        }
      },
      error: (err) => {
        this.loadingPrestataires.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected optionLabel(p: PrestataireCard): string {
    const locale = currentLocale();
    const parts = [`★${formatNumber(p.prestataire?.note_moyenne ?? 0, locale, '1.1-1')}`];
    if (p.prestataire?.tarif_horaire != null) parts.push(`${formatNumber(p.prestataire.tarif_horaire, locale, '1.0-2')} ${translate('common.units.perHour')}`);
    if (p.distance_km != null) parts.push(`${formatNumber(p.distance_km, locale, '1.1-1')} ${translate('common.units.km')}`);
    return `${p.nom} — ${parts.join(' · ')}`;
  }

  protected async locate(): Promise<void> {
    this.locating.set(true);
    const pos = await precisePosition();
    this.locating.set(false);
    if (!pos) {
      this.toast.error(translate('client.shared.geoError'));
      return;
    }
    if (pos === 'imprecise') {
      this.toast.error(translate('client.shared.geoImprecise'));
      return;
    }
    this.coords.set({ lat: pos.lat, lng: pos.lng });
    if (!this.form.address.trim()) {
      this.form.address = translate('client.nouveauRdv.gpsAddress', { lat: pos.lat.toFixed(5), lng: pos.lng.toFixed(5) });
    }
    this.toast.success(translate('client.nouveauRdv.toasts.positionSaved'));
    // Les distances des prestataires sont recalculées avec la nouvelle position.
    if (this.categorieId()) this.loadPrestataires(this.prestataireId());
  }

  protected submit(): void {
    const e: Record<string, string> = {};
    if (!this.categorieId()) e['categorie_service_id'] = translate('client.nouveauRdv.errors.categorie');
    if (!this.prestataireId()) e['prestataire_id'] = translate('client.nouveauRdv.errors.prestataire');
    if (!this.form.date) e['date'] = translate('client.nouveauRdv.errors.date');
    else if (this.form.date < this.today) e['date'] = translate('client.nouveauRdv.errors.datePast');
    if (!this.form.address.trim()) e['address'] = translate('client.nouveauRdv.errors.address');
    if (!this.form.description.trim()) e['description'] = translate('client.nouveauRdv.errors.description');
    this.errors.set(e);
    this.error.set(null);
    if (Object.keys(e).length) return;

    const c = this.coords();
    this.saving.set(true);
    this.api
      .createRendezVous({
        prestataire_id: this.prestataireId(),
        categorie_service_id: this.categorieId(),
        date: this.form.date,
        heure: this.form.heure || null,
        address: this.form.address.trim(),
        latitude: c?.lat ?? null,
        longitude: c?.lng ?? null,
        description: this.form.description.trim(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success(translate('client.nouveauRdv.toasts.sent'));
          this.router.navigate(['/client/rendez-vous']);
        },
        error: (err) => {
          this.saving.set(false);
          this.errors.set(fieldErrors(err));
          this.error.set(errorMessage(err));
        },
      });
  }
}
