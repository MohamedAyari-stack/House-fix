import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Accueil as AccueilData } from '../../core/models';
import { I18N } from '../../i18n/pipes';
import { LangSwitch } from '../../shared/lang-switch';
import { Avatar } from '../../shared/avatar';
import { StarRating } from '../../shared/star-rating';
import { ThemeToggle } from '../../shared/theme-toggle';

/** Page d'accueil publique : présentation, services, fonctionnement, meilleurs prestataires et avis. */
import { VideoGuides } from '../../shared/video-guides';
@Component({
  standalone: true,
  selector: 'app-accueil',
  imports: [RouterLink, VideoGuides, Avatar, StarRating, ThemeToggle, LangSwitch, ...I18N],
  templateUrl: './accueil.html',
  styleUrl: './accueil.css',
})
export class Accueil {
  private readonly api = inject(ApiService);

  protected readonly data = signal<AccueilData | null>(null);
  protected readonly loading = signal(true);
  protected readonly menuOpen = signal(false);
  protected readonly year = new Date().getFullYear();

  /** Emplacements affichés en squelette pendant le chargement. */
  protected readonly placeholders = [1, 2, 3, 4];

  /** Clés de traduction : le texte est traduit dans le gabarit. */
  protected readonly steps = [
    { icon: 'bi-search', key: 'accueil.how.steps.find' },
    { icon: 'bi-calendar-check', key: 'accueil.how.steps.book', guide: 'reserver' as const },
    { icon: 'bi-shield-check', key: 'accueil.how.steps.pay', guide: 'payer' as const },
  ];

  protected readonly guarantees = [
    { icon: 'bi-patch-check', key: 'accueil.guarantees.verified' },
    { icon: 'bi-receipt', key: 'accueil.guarantees.invoices' },
    { icon: 'bi-chat-dots', key: 'accueil.guarantees.messaging' },
    { icon: 'bi-life-preserver', key: 'accueil.guarantees.disputes' },
  ];

  constructor() {
    this.api.accueil().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      // Sans API, la page reste lisible : seules les sections dynamiques disparaissent.
      error: () => this.loading.set(false),
    });
  }
}
