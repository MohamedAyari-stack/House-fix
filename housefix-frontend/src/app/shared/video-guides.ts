import { Component, ElementRef, HostListener, signal, viewChild } from '@angular/core';
import { I18N } from '../i18n/pipes';

/** Démonstrations filmées sur l'app (public/videos), aussi utilisées dans la FAQ des pages de services. */
export interface VideoGuide {
  key: 'reserver' | 'payer' | 'verifie' | 'prix';
  icon: string;
  seconds: number;
  /** Version du fichier, pour contourner le cache après un nouveau tournage. */
  v?: number;
}

export const VIDEO_GUIDES: VideoGuide[] = [
  { key: 'reserver', icon: 'bi-calendar-plus', seconds: 36 },
  { key: 'payer', icon: 'bi-credit-card', seconds: 34 },
  { key: 'verifie', icon: 'bi-patch-check', seconds: 20, v: 2 },
  { key: 'prix', icon: 'bi-cash-coin', seconds: 20 },
];

export const guideSrc = (g: VideoGuide, ext: 'mp4' | 'jpg') => `/videos/faq-${g.key}.${ext}${g.v ? '?v=' + g.v : ''}`;

/** Grille de guides vidéo + lecteur en surimpression. `open(key)` peut être appelé depuis la page parente. */
@Component({
  standalone: true,
  selector: 'app-video-guides',
  imports: [...I18N],
  template: `
    <div class="guides">
      @for (g of guides; track g.key) {
        <button type="button" class="guide" (click)="open(g.key)">
          <span class="thumb">
            <img [src]="src(g, 'jpg')" alt="" loading="lazy" />
            <span class="play" aria-hidden="true"><i class="bi bi-play-fill"></i></span>
            <span class="dur">{{ 'accueil.guides.duration' | t: { s: g.seconds } }}</span>
          </span>
          <span class="label">
            <i class="bi" [class]="'bi ' + g.icon" aria-hidden="true"></i>
            {{ 'accueil.guides.items.' + g.key | t }}
          </span>
        </button>
      }
    </div>

    @if (current(); as g) {
      <div class="player-backdrop" (click)="close()">
        <div class="player" role="dialog" aria-modal="true" [attr.aria-label]="'accueil.guides.items.' + g.key | t" (click)="$event.stopPropagation()">
          <div class="player-head">
            <strong><i class="bi" [class]="'bi ' + g.icon"></i> {{ 'accueil.guides.items.' + g.key | t }}</strong>
            <button #closeBtn type="button" class="btn btn-ghost btn-icon" (click)="close()" [attr.aria-label]="'accueil.guides.close' | t">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <video controls autoplay playsinline [poster]="src(g, 'jpg')">
            <source [src]="src(g, 'mp4')" type="video/mp4" />
          </video>
          <p class="note">{{ 'accueil.guides.note' | t }}</p>
        </div>
      </div>
    }
  `,
  styles: `
    .guides {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
    }
    @media (max-width: 960px) {
      .guides { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 480px) {
      .guides { grid-template-columns: 1fr; }
    }

    .guide {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--text);
      font: inherit;
      text-align: start;
      cursor: pointer;
      transition: border-color 0.15s, transform 0.15s;
    }
    .guide:hover,
    .guide:focus-visible {
      border-color: var(--primary);
      transform: translateY(-2px);
    }

    .thumb {
      position: relative;
      display: block;
      aspect-ratio: 16 / 9;
      border-radius: var(--radius-sm);
      overflow: hidden;
      background: #0f172a;
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .play {
      position: absolute;
      inset: 0;
      margin: auto;
      width: 46px;
      height: 46px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: rgba(37, 99, 235, 0.92);
      color: #fff;
      font-size: 1.5rem;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
    }
    .dur {
      position: absolute;
      inset-inline-end: 8px;
      bottom: 8px;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.85);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
    }
    .label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 4px 4px;
      font-weight: 600;
      font-size: 14px;
    }
    .label i { color: var(--primary); }

    .player-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1100;
      display: grid;
      place-items: center;
      padding: 16px;
      background: rgba(2, 6, 23, 0.8);
    }
    .player {
      width: min(960px, 100%);
      padding: 14px;
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow: var(--shadow-lg);
    }
    .player-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
    }
    .player-head i { color: var(--primary); }
    .player video {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      border-radius: var(--radius-sm);
      background: #0f172a;
    }
    .note {
      margin: 8px 0 0;
      font-size: 12px;
      color: var(--text-muted);
    }
  `,
})
export class VideoGuides {
  protected readonly guides = VIDEO_GUIDES;
  protected readonly src = guideSrc;
  protected readonly current = signal<VideoGuide | null>(null);
  private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');
  private returnFocus: HTMLElement | null = null;

  open(key: VideoGuide['key']): void {
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.current.set(this.guides.find((g) => g.key === key) ?? null);
    setTimeout(() => this.closeBtn()?.nativeElement.focus());
  }

  @HostListener('document:keydown.escape')
  close(): void {
    if (!this.current()) return;
    this.current.set(null);
    this.returnFocus?.focus();
  }
}
