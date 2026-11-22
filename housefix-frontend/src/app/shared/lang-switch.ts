import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { LANGUAGES, Lang, currentLang, setLang } from '../i18n/i18n';
import { TranslatePipe } from '../i18n/pipes';

/** Sélecteur de langue (français, arabe, anglais) à côté du thème : change toute l'application instantanément. */
@Component({
  standalone: true,
  selector: 'app-lang-switch',
  imports: [TranslatePipe],
  template: `
    <button
      type="button"
      class="lang"
      (click)="open.set(!open())"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="'common.lang.switch' | t"
      [title]="'common.lang.switch' | t"
    >
      <i class="bi bi-translate"></i>
      <span>{{ current().label }}</span>
      <i class="bi bi-chevron-down caret"></i>
    </button>
    @if (open()) {
      <ul class="menu" role="menu">
        @for (l of languages; track l.code) {
          <li role="none">
            <button
              type="button"
              role="menuitemradio"
              [attr.aria-checked]="l.code === lang()"
              [attr.lang]="l.code"
              [class.active]="l.code === lang()"
              (click)="choose(l.code)"
            >
              {{ l.label }}
              @if (l.code === lang()) {
                <i class="bi bi-check2"></i>
              }
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-block;
    }
    .lang {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: var(--shadow);
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      color: var(--text);
    }
    .lang:hover {
      border-color: var(--primary);
      color: var(--primary);
    }
    .lang:focus-visible,
    .menu button:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }
    .caret {
      font-size: 10px;
    }
    .menu {
      position: absolute;
      top: calc(100% + 6px);
      inset-inline-end: 0;
      z-index: 1000;
      min-width: 150px;
      margin: 0;
      padding: 6px;
      list-style: none;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: var(--shadow-lg);
    }
    .menu button {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      padding: 9px 10px;
      border: none;
      border-radius: 8px;
      background: none;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      color: var(--text);
      text-align: start;
    }
    .menu button:hover {
      background: var(--surface-2);
    }
    .menu button.active {
      color: var(--primary);
      font-weight: 700;
    }
  `,
})
export class LangSwitch {
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly languages = LANGUAGES;
  protected readonly lang = currentLang;
  protected readonly open = signal(false);
  protected current = () => LANGUAGES.find((l) => l.code === this.lang()) ?? LANGUAGES[0];

  protected choose(code: Lang): void {
    setLang(code);
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected closeOutside(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void {
    this.open.set(false);
  }
}
