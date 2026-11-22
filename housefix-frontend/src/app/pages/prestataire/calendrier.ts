import { NgTemplateOutlet, formatDate } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { RendezVous } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage, isoDate, mapsUrl } from '../../core/utils';
import { StatusBadge } from '../../shared/status-badge';
import { currentLocale } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';

interface Day {
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
  events: RendezVous[];
}

const MAX_CHIPS = 3;

@Component({
  standalone: true,
  selector: 'app-calendrier',
  imports: [NgTemplateOutlet, StatusBadge, ...I18N],
  templateUrl: './calendrier.html',
  styleUrl: './calendrier.css',
})
export class Calendrier {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  /** Jours de la semaine (lundi → dimanche) dans la langue courante ; le 1er janvier 2024 est un lundi. */
  protected readonly weekdays = computed(() =>
    Array.from({ length: 7 }, (_, i) => formatDate(new Date(2024, 0, 1 + i), 'EEE', currentLocale())),
  );
  protected readonly maxChips = MAX_CHIPS;
  protected readonly todayKey = isoDate(new Date());

  /** Premier jour du mois affiché. */
  protected readonly month = signal(this.firstOfMonth(new Date()));
  protected readonly events = signal<RendezVous[]>([]);
  protected readonly loading = signal(false);
  protected readonly selected = signal<string | null>(this.todayKey);

  protected readonly title = computed(() =>
    formatDate(this.month(), 'MMMM y', currentLocale()),
  );

  private readonly range = computed(() => {
    const first = this.month();
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const end = new Date(last);
    end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7)));
    return { start, end };
  });

  private readonly byDay = computed(() => {
    const map = new Map<string, RendezVous[]>();
    for (const e of this.events()) {
      const key = e.date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => (a.heure ?? '99').localeCompare(b.heure ?? '99'));
    return map;
  });

  protected readonly weeks = computed(() => {
    const { start, end } = this.range();
    const m = this.month().getMonth();
    const days: Day[] = [];
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = isoDate(d);
      days.push({
        date: new Date(d),
        key,
        inMonth: d.getMonth() === m,
        isToday: key === this.todayKey,
        events: this.byDay().get(key) ?? [],
      });
    }
    const weeks: Day[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
    return weeks;
  });

  /** Vue liste (mobile) : jours du mois ayant au moins une intervention. */
  protected readonly listDays = computed(() =>
    this.weeks()
      .flat()
      .filter((d) => d.inMonth && d.events.length > 0),
  );

  protected readonly selectedDay = computed(() => {
    const key = this.selected();
    if (!key) return null;
    return { date: new Date(key + 'T00:00:00'), events: this.byDay().get(key) ?? [] };
  });

  constructor() {
    this.load();
  }

  protected prev(): void {
    this.shift(-1);
  }

  protected next(): void {
    this.shift(1);
  }

  protected goToday(): void {
    this.month.set(this.firstOfMonth(new Date()));
    this.selected.set(this.todayKey);
    this.load();
  }

  protected select(day: Day): void {
    this.selected.set(day.key);
  }

  protected maps(r: RendezVous): string {
    return mapsUrl(r.latitude, r.longitude, r.address);
  }

  private shift(delta: number): void {
    const m = this.month();
    this.month.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
    this.selected.set(null);
    this.load();
  }

  private load(): void {
    const { start, end } = this.range();
    this.loading.set(true);
    this.api.calendrier(isoDate(start), isoDate(end)).subscribe({
      next: (list) => {
        this.events.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  private firstOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }
}
