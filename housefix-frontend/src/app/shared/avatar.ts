import { Component, computed, input } from '@angular/core';
import { initials } from '../core/utils';

/** Photo de profil, ou initiales sur fond dégradé si aucune photo. */
@Component({
  standalone: true,
  selector: 'app-avatar',
  template: `
    @if (photoUrl()) {
      <img class="avatar" [class.avatar-lg]="size() === 'lg'" [src]="photoUrl()" [alt]="nom()" />
    } @else {
      <span class="avatar" [class.avatar-lg]="size() === 'lg'">{{ letters() }}</span>
    }
  `,
})
export class Avatar {
  readonly nom = input<string | null | undefined>('');
  readonly photoUrl = input<string | null | undefined>(null);
  readonly size = input<'md' | 'lg'>('md');
  protected readonly letters = computed(() => initials(this.nom()));
}
