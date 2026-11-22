import { formatNumber } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { Component, DestroyRef, HostListener, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { ApiService } from '../core/api.service';
import { User } from '../core/models';
import { errorMessage } from '../core/utils';
import { currentLocale, translate } from '../i18n/i18n';
import { I18N } from '../i18n/pipes';
import { Avatar } from './avatar';

/** Formats et taille acceptés, identiques à la validation Laravel (ProfileController::photo). */
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Photo de profil : glisser-déposer une image, ou cliquer / appuyer sur Entrée pour choisir un fichier.
 * Vérifie le format et la taille avant l'envoi, affiche un aperçu immédiat et la progression.
 */
@Component({
  standalone: true,
  selector: 'app-photo-dropzone',
  imports: [Avatar, ...I18N],
  template: `
    <div
      class="zone"
      role="button"
      tabindex="0"
      [class.dragging]="dragging()"
      [class.busy]="progress() !== null"
      [attr.aria-label]="'common.photo.zoneLabel' | t"
      [attr.aria-describedby]="'photo-hint photo-status'"
      [attr.aria-disabled]="progress() !== null"
      (click)="browse()"
      (keydown.enter)="browse()"
      (keydown.space)="$event.preventDefault(); browse()"
      (dragenter)="onDragEnter($event)"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
    >
      <div class="photo">
        @if (preview()) {
          <img class="avatar avatar-lg" [src]="preview()" [alt]="'common.photo.preview' | t" />
        } @else {
          <app-avatar [nom]="nom()" [photoUrl]="photoUrl()" size="lg" />
        }
        <span class="badge-cam" aria-hidden="true"><i class="bi bi-camera-fill"></i></span>
      </div>

      <div class="text">
        @if (dragging()) {
          <strong class="drop-now"><i class="bi bi-cloud-arrow-up"></i> {{ 'common.photo.dropNow' | t }}</strong>
        } @else {
          <strong>{{ 'common.photo.drop' | t }}</strong>
          <span class="muted">{{ 'common.photo.or' | t }} <span class="link">{{ 'common.photo.browse' | t }}</span></span>
        }
        <span class="hint" id="photo-hint">{{ 'common.photo.hint' | t }}</span>

        <div id="photo-status" aria-live="polite">
          @if (progress() !== null) {
            <div class="progress" role="progressbar" [attr.aria-valuenow]="progress()" aria-valuemin="0" aria-valuemax="100">
              <span [style.width.%]="progress()"></span>
            </div>
            <span class="status">{{ 'common.photo.uploading' | t: { percent: progress() } }}</span>
          } @else if (done()) {
            <span class="status ok"><i class="bi bi-check-circle-fill"></i> {{ 'common.photo.done' | t }}</span>
          }
          @if (error()) {
            <span class="status error" role="alert"><i class="bi bi-exclamation-circle"></i> {{ error() }}</span>
          }
        </div>
      </div>
    </div>
    <input #file type="file" accept="image/jpeg,image/png,image/webp" (change)="onPick($event)" hidden />
  `,
  styles: `
    .zone {
      display: flex;
      align-items: center;
      gap: 18px;
      padding: 16px;
      border: 2px dashed var(--border);
      border-radius: var(--radius);
      background: var(--surface-2);
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .zone:hover,
    .zone:focus-visible {
      border-color: var(--primary);
      outline: none;
    }
    .zone:focus-visible {
      box-shadow: 0 0 0 3px var(--primary-soft);
    }
    .zone.dragging {
      border-color: var(--primary);
      background: var(--primary-soft);
    }
    .zone.busy {
      cursor: progress;
    }
    .photo {
      position: relative;
      flex: none;
    }
    .badge-cam {
      position: absolute;
      inset-inline-end: -4px;
      bottom: -4px;
      width: 28px;
      height: 28px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      border: 2px solid var(--surface);
      background: var(--primary);
      color: #fff;
      font-size: 13px;
    }
    .text {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
      flex: 1;
    }
    .drop-now {
      color: var(--primary);
    }
    .link {
      color: var(--primary);
      font-weight: 600;
      text-decoration: underline;
    }
    .hint {
      font-size: 12px;
      color: var(--text-muted);
    }
    .progress {
      height: 6px;
      margin-top: 6px;
      border-radius: 999px;
      background: var(--border);
      overflow: hidden;
    }
    .progress span {
      display: block;
      height: 100%;
      background: var(--primary);
      transition: width 0.15s linear;
    }
    .status {
      display: block;
      margin-top: 4px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .status.ok {
      color: var(--success);
    }
    .status.error {
      color: var(--danger);
    }
    @media (prefers-reduced-motion: reduce) {
      .zone,
      .progress span {
        transition: none;
      }
    }
    @media (max-width: 480px) {
      .zone {
        flex-direction: column;
        text-align: center;
      }
    }
  `,
})
export class PhotoDropzone {
  private readonly api = inject(ApiService);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('file');

  readonly nom = input<string | null | undefined>('');
  readonly photoUrl = input<string | null | undefined>(null);
  /** Profil renvoyé par l'API après l'envoi (nouvelle photo_url). */
  readonly uploaded = output<User>();

  protected readonly dragging = signal(false);
  protected readonly preview = signal<string | null>(null);
  protected readonly progress = signal<number | null>(null);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);
  /** dragenter/dragleave se déclenchent aussi sur les éléments enfants : on compte les entrées. */
  private depth = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.setPreview(null));
  }

  protected browse(): void {
    if (this.progress() === null) this.fileInput().nativeElement.click();
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.upload(file);
  }

  protected onDragEnter(event: DragEvent): void {
    if (!this.hasFiles(event)) return;
    event.preventDefault();
    this.depth++;
    this.dragging.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    if (!this.hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  protected onDragLeave(event: DragEvent): void {
    if (!this.hasFiles(event)) return;
    this.depth = Math.max(0, this.depth - 1);
    if (this.depth === 0) this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.depth = 0;
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && this.progress() === null) this.upload(file);
  }

  /** Une image lâchée à côté de la zone ne doit pas remplacer la page par l'image. */
  @HostListener('document:dragover', ['$event'])
  @HostListener('document:drop', ['$event'])
  protected blockPageDrop(event: DragEvent): void {
    if (this.hasFiles(event)) event.preventDefault();
  }

  private upload(file: File): void {
    this.error.set(null);
    this.done.set(false);
    if (!TYPES.includes(file.type)) {
      this.error.set(translate('common.photo.errors.type'));
      return;
    }
    if (file.size > MAX_BYTES) {
      const size = formatNumber(file.size / 1024 / 1024, currentLocale(), '1.1-1');
      this.error.set(translate('common.photo.errors.size', { size }));
      return;
    }

    this.setPreview(URL.createObjectURL(file));
    this.progress.set(0);
    this.api.uploadPhotoWithProgress(file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progress.set(Math.round((event.loaded / event.total) * 100));
        } else if (event.type === HttpEventType.Response && event.body) {
          this.progress.set(null);
          this.done.set(true);
          this.uploaded.emit(event.body);
        }
      },
      error: (err) => {
        this.progress.set(null);
        this.setPreview(null);
        this.error.set(errorMessage(err));
      },
    });
  }

  private hasFiles(event: DragEvent): boolean {
    return !!event.dataTransfer?.types?.includes('Files');
  }

  /** Remplace l'aperçu local en libérant l'ancienne URL temporaire. */
  private setPreview(url: string | null): void {
    const old = this.preview();
    if (old) URL.revokeObjectURL(old);
    this.preview.set(url);
  }
}
