import { Location } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { PrestataireDetail } from '../../core/models';
import { errorMessage } from '../../core/utils';
import { Avatar } from '../../shared/avatar';
import { StarRating } from '../../shared/star-rating';
import { translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';

import { RecoBadge } from '../../shared/reco-badge';
@Component({
  standalone: true,
  selector: 'app-prestataire-detail',
  imports: [RecoBadge, ...I18N, RouterLink, Avatar, StarRating],
  templateUrl: './prestataire-detail.html',
  styleUrl: './prestataire-detail.css',
})
export class PrestataireDetailPage {
  private readonly api = inject(ApiService);
  protected readonly location = inject(Location);

  readonly id = input.required<string>();

  protected readonly loading = signal(true);
  protected readonly presta = signal<PrestataireDetail | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = Number(this.id());
      this.loading.set(true);
      this.api.prestataire(id).subscribe({
        next: (p) => {
          this.presta.set(p);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(errorMessage(err, translate('client.prestataireDetail.notFound')));
          this.loading.set(false);
        },
      });
    });
  }
}
