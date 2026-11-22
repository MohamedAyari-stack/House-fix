import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Categorie, GOUVERNORATS, PrestataireCard, PrestataireSearch } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage, precisePosition } from '../../core/utils';
import { Avatar } from '../../shared/avatar';
import { StarRating } from '../../shared/star-rating';
import { translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';

type Sort = NonNullable<PrestataireSearch['sort']>;

import { RecoBadge } from '../../shared/reco-badge';
@Component({
  standalone: true,
  selector: 'app-client-prestataires',
  imports: [RecoBadge, ...I18N, FormsModule, RouterLink, Avatar, StarRating],
  templateUrl: './prestataires.html',
  styleUrl: './prestataires.css',
})
export class ClientPrestataires {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  protected readonly gouvernorats = GOUVERNORATS;
  protected readonly notes = [0, 1, 2, 3, 4];
  /** Clés de tri ; le libellé est traduit dans le template (client.prestataires.sorts.*). */
  protected readonly sorts: Sort[] = ['recommande', 'note', 'prix', 'distance'];

  protected readonly categories = signal<Categorie[]>([]);
  protected readonly results = signal<PrestataireCard[]>([]);
  protected readonly loading = signal(true);
  protected readonly locating = signal(false);
  protected readonly coords = signal<{ lat: number; lng: number } | null>(null);

  // Filtres
  protected readonly q = signal('');
  protected readonly categorieId = signal<number | null>(null);
  protected readonly gouvernorat = signal('');
  protected readonly minNote = signal(0);
  protected readonly maxTarif = signal<number | null>(null);
  protected readonly disponible = signal(false);
  protected readonly sort = signal<Sort>('recommande');

  /** Les 3 meilleurs scores de recommandation reçoivent le badge « Recommandé ». */
  protected readonly topIds = computed(() => {
    const top = [...this.results()].sort((a, b) => b.score - a.score).slice(0, 3);
    return new Set(top.filter((p) => p.score > 0).map((p) => p.id));
  });

  protected readonly hasFilters = computed(
    () => !!(this.q() || this.categorieId() || this.gouvernorat() || this.minNote() || this.maxTarif() || this.disponible()),
  );

  private debounce: ReturnType<typeof setTimeout> | undefined;
  private request: Subscription | undefined;

  constructor() {
    this.api.categories().subscribe({ next: (c) => this.categories.set(c), error: () => undefined });
    this.load();
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.debounce);
      this.request?.unsubscribe();
    });
  }

  protected load(): void {
    const c = this.coords();
    const filters: PrestataireSearch = {
      q: this.q().trim(),
      categorie_id: this.categorieId(),
      gouvernorat: this.gouvernorat(),
      min_note: this.minNote() || null,
      max_tarif: this.maxTarif() || null,
      disponible: this.disponible() || undefined,
      lat: c?.lat,
      lng: c?.lng,
      sort: this.sort(),
    };
    this.loading.set(true);
    this.request?.unsubscribe();
    this.request = this.api.searchPrestataires(filters).subscribe({
      next: (list) => {
        this.results.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  /** Champs saisis au clavier : recherche relancée après une courte pause. */
  protected onSearch(value: string): void {
    this.q.set(value);
    this.debouncedLoad();
  }

  protected onTarif(value: number | null): void {
    this.maxTarif.set(typeof value === 'number' && value > 0 ? value : null);
    this.debouncedLoad();
  }

  private debouncedLoad(): void {
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.load(), 350);
  }

  /** Met à jour un filtre puis relance la recherche. */
  protected apply<T>(target: { set: (v: T) => void }, value: T): void {
    clearTimeout(this.debounce);
    target.set(value);
    this.load();
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
    this.coords.set(pos);
    this.toast.success(translate('client.prestataires.positionUsed'));
    this.load();
  }

  protected reset(): void {
    this.q.set('');
    this.categorieId.set(null);
    this.gouvernorat.set('');
    this.minNote.set(0);
    this.maxTarif.set(null);
    this.disponible.set(false);
    this.load();
  }
}
