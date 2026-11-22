import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ClientDashboard, PrestataireCard } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage, precisePosition } from '../../core/utils';
import { Avatar } from '../../shared/avatar';
import { StarRating } from '../../shared/star-rating';
import { StatusBadge } from '../../shared/status-badge';
import { I18N } from '../../i18n/pipes';

import { RecoBadge } from '../../shared/reco-badge';
@Component({
  standalone: true,
  selector: 'app-client-dashboard',
  imports: [RecoBadge, ...I18N, FormsModule, RouterLink, Avatar, StarRating, StatusBadge],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class ClientDashboardPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly firstName = computed(() => this.auth.user()?.nom ?? '');
  protected readonly stats = signal<ClientDashboard | null>(null);
  protected readonly loading = signal(true);
  protected readonly reco = signal<PrestataireCard[]>([]);
  protected readonly recoLoading = signal(true);
  /** Position utilisée pour les distances : GPS précis du navigateur, sinon adresse du compte, sinon gouvernorat. */
  protected readonly located = signal(false);
  protected readonly positionBasis = computed(() =>
    this.located() ? 'gps' : this.auth.user()?.latitude != null && this.auth.user()?.longitude != null ? 'address' : 'gouvernorat',
  );

  protected readonly quickLinks = [
    { icon: 'bi-calendar-plus', title: 'client.dashboard.quick.bookTitle', text: 'client.dashboard.quick.bookText', link: '/client/rendez-vous/nouveau', tone: 'primary' },
    { icon: 'bi-list-check', title: 'client.dashboard.quick.trackTitle', text: 'client.dashboard.quick.trackText', link: '/client/rendez-vous', tone: 'success' },
    { icon: 'bi-chat-dots', title: 'client.dashboard.quick.messagesTitle', text: 'client.dashboard.quick.messagesText', link: '/client/messages', tone: 'violet' },
  ];

  constructor() {
    this.api.clientDashboard().subscribe({
      next: (d) => {
        this.stats.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(errorMessage(err));
      },
    });

    // Recommandations : chargement immédiat sans position, puis affinage si la géolocalisation répond.
    this.loadReco();
    // Une position imprécise (estimée par IP / Wi-Fi) fausserait les distances : l'adresse du compte est alors utilisée.
    precisePosition().then((pos) => {
      if (pos && pos !== 'imprecise') {
        this.located.set(true);
        this.loadReco(pos.lat, pos.lng);
      }
    });
  }

  private recoSeq = 0;
  private position: { lat?: number; lng?: number } = {};

  /** Besoin décrit librement (« fuite sous l'évier ») : le service IA l'associe au bon métier. */
  protected besoin = '';
  protected readonly besoinActif = signal('');

  protected rechercherBesoin(): void {
    this.besoinActif.set(this.besoin.trim());
    this.recoLoading.set(true);
    this.loadReco(this.position.lat, this.position.lng);
  }

  protected effacerBesoin(): void {
    this.besoin = '';
    this.rechercherBesoin();
  }

  private loadReco(lat?: number, lng?: number): void {
    this.position = { lat, lng };
    // Ignore une réponse arrivée après une requête plus récente (avec position ou besoin).
    const seq = ++this.recoSeq;
    this.api.recommandations({ lat, lng, besoin: this.besoinActif() || null }).subscribe({
      next: (list) => {
        if (seq !== this.recoSeq) return;
        this.reco.set(list);
        this.recoLoading.set(false);
      },
      error: () => this.recoLoading.set(false),
    });
  }
}
