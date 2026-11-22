import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { MessageAttachment } from '../core/models';
import { downloadBlob } from '../core/utils';
import { currentLocale } from '../i18n/i18n';
import { I18N } from '../i18n/pipes';

/**
 * Pièce jointe d'un message. Le fichier est servi par une route protégée (jeton) : il est chargé en Blob,
 * affiché en miniature (photo, agrandie au clic) ou proposé en téléchargement (PDF).
 */
@Component({
  standalone: true,
  selector: 'app-message-attachment',
  imports: [...I18N],
  template: `
    @if (isImage()) {
      <button type="button" class="photo" (click)="open.set(true)" [attr.aria-label]="'pages.messages.openImage' | t" [disabled]="!src()">
        @if (src()) {
          <img [src]="src()" [alt]="attachment().name" loading="lazy" />
        } @else if (failed()) {
          <span class="placeholder"><i class="bi bi-image"></i></span>
        } @else {
          <span class="placeholder"><span class="spinner"></span></span>
        }
      </button>
      @if (open() && src()) {
        <div class="lightbox" role="dialog" aria-modal="true" [attr.aria-label]="attachment().name" (click)="open.set(false)" (keydown.escape)="open.set(false)" tabindex="-1">
          <img [src]="src()" [alt]="attachment().name" />
          <button type="button" class="btn btn-light btn-icon close" (click)="open.set(false)" [attr.aria-label]="'common.actions.close' | t">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      }
    } @else {
      <button type="button" class="file" (click)="download()" [attr.aria-label]="('pages.messages.download' | t) + ' ' + attachment().name">
        <span class="file-icon"><i class="bi bi-file-earmark-pdf-fill"></i></span>
        <span class="file-text">
          <strong>{{ attachment().name }}</strong>
          <small>{{ size() }}</small>
        </span>
        <i class="bi bi-download"></i>
      </button>
    }
  `,
  styles: `
    .photo {
      display: block;
      padding: 0;
      border: none;
      background: none;
      cursor: zoom-in;
      border-radius: 12px;
      overflow: hidden;
    }
    .photo img {
      display: block;
      max-width: min(260px, 100%);
      max-height: 260px;
      object-fit: cover;
      border-radius: 12px;
    }
    .placeholder {
      display: grid;
      place-items: center;
      width: 200px;
      height: 140px;
      border-radius: 12px;
      background: var(--surface-2);
      color: var(--text-muted);
      font-size: 24px;
    }
    .placeholder .spinner {
      margin: 0;
    }
    .file {
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: 280px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
      color: var(--text);
      cursor: pointer;
      font: inherit;
      text-align: start;
    }
    .file:hover {
      border-color: var(--primary);
    }
    .file-icon {
      color: var(--danger);
      font-size: 22px;
    }
    .file-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .file-text strong {
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .file-text small {
      color: var(--text-muted);
    }
    .lightbox {
      position: fixed;
      inset: 0;
      z-index: 2000;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(15, 23, 42, 0.85);
      cursor: zoom-out;
    }
    .lightbox img {
      max-width: 100%;
      max-height: 100%;
      border-radius: 12px;
    }
    .close {
      position: absolute;
      top: 16px;
      inset-inline-end: 16px;
      background: #fff;
    }
  `,
})
export class MessageAttachmentView implements OnInit {
  private readonly api = inject(ApiService);

  readonly attachment = input.required<MessageAttachment>();
  /** Aperçu local d'un fichier tout juste envoyé (évite de le retélécharger). */
  readonly localUrl = input<string | null>(null);

  protected readonly src = signal<string | null>(null);
  protected readonly failed = signal(false);
  protected readonly open = signal(false);
  private objectUrl: string | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.objectUrl && URL.revokeObjectURL(this.objectUrl));
  }

  ngOnInit(): void {
    if (!this.isImage()) return;
    if (this.localUrl()) {
      this.src.set(this.localUrl());
      return;
    }
    this.api.messageAttachment(this.attachment().url).subscribe({
      next: (blob) => {
        this.objectUrl = URL.createObjectURL(blob);
        this.src.set(this.objectUrl);
      },
      error: () => this.failed.set(true),
    });
  }

  protected isImage(): boolean {
    return this.attachment().mime.startsWith('image/');
  }

  /** Taille lisible dans la langue courante (« 120 ko », « 1.2 MB »…). */
  protected size(): string {
    const kb = this.attachment().size / 1024;
    const [value, unit] = kb < 1024 ? [Math.round(kb), 'kilobyte'] : [Math.round(kb / 102.4) / 10, 'megabyte'];
    return new Intl.NumberFormat(currentLocale(), { style: 'unit', unit, unitDisplay: 'short' }).format(value);
  }

  protected download(): void {
    this.api.messageAttachment(this.attachment().url).subscribe((blob) => downloadBlob(blob, this.attachment().name));
  }
}
