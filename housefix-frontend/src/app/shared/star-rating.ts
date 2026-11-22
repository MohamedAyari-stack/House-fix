import { Component, computed, input, model } from '@angular/core';

/**
 * Étoiles de notation. En lecture seule par défaut ; avec [editable]="true",
 * le composant est cliquable et lié en two-way via [(value)].
 */
@Component({
  standalone: true,
  selector: 'app-star-rating',
  template: `
    <span class="stars" [class.editable]="editable()" [attr.aria-label]="value() + '/5'">
      @for (i of stars; track i) {
        <i
          class="bi"
          [class]="'bi ' + iconFor(i)"
          (click)="select(i)"
          [attr.role]="editable() ? 'button' : null"
        ></i>
      }
      @if (showValue()) {
        <span class="value">{{ rounded() }}</span>
      }
    </span>
  `,
  styles: `
    .stars {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      color: #f59e0b;
    }

    .editable i {
      cursor: pointer;
      font-size: 1.6rem;
    }

    .value {
      margin-inline-start: 6px;
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 600;
    }
  `,
})
export class StarRating {
  readonly value = model(0);
  readonly editable = input(false);
  readonly showValue = input(false);
  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly rounded = computed(() => (Math.round(this.value() * 10) / 10).toFixed(1));

  protected iconFor(i: number): string {
    const v = this.value();
    if (v >= i) return 'bi-star-fill';
    if (v >= i - 0.5) return 'bi-star-half';
    return 'bi-star';
  }

  protected select(i: number): void {
    if (this.editable()) this.value.set(i);
  }
}
