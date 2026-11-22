import { Component, inject } from '@angular/core';
import { ThemeService } from '../core/theme.service';
import { TranslatePipe } from '../i18n/pipes';

/** Interrupteur « Clair / Sombre » visible en haut à droite de chaque page. */
@Component({
  standalone: true,
  selector: 'app-theme-toggle',
  imports: [TranslatePipe],
  template: `
    <button type="button" class="toggle" (click)="theme.toggle()" [attr.aria-label]="'common.theme.toggle' | t">
      <span [class.active]="theme.theme() === 'light'">{{ 'common.theme.light' | t }}</span>
      <span class="track" [class.dark]="theme.theme() === 'dark'">
        <span class="knob">
          <i class="bi" [class.bi-sun-fill]="theme.theme() === 'light'" [class.bi-moon-stars-fill]="theme.theme() === 'dark'"></i>
        </span>
      </span>
      <span [class.active]="theme.theme() === 'dark'">{{ 'common.theme.dark' | t }}</span>
    </button>
  `,
  styles: `
    .toggle {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: var(--shadow);
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      color: var(--text-muted);
    }

    .active {
      color: var(--text);
      font-weight: 700;
    }

    .track {
      width: 46px;
      height: 24px;
      border-radius: 999px;
      background: #93c5fd;
      position: relative;
      transition: background 0.2s;
    }

    .track.dark {
      background: #3730a3;
    }

    .knob {
      position: absolute;
      top: 2px;
      inset-inline-start: 2px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #fbbf24;
      display: grid;
      place-items: center;
      font-size: 11px;
      color: #fff;
      transition: transform 0.2s, background 0.2s;
    }

    :host-context([dir=rtl]) .track.dark .knob {
      transform: translateX(-22px);
    }

    .track.dark .knob {
      transform: translateX(22px);
      background: #1e1b4b;
      color: #fde68a;
    }
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
}
