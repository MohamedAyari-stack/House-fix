import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AppNotification } from '../core/models';
import { I18N } from '../i18n/pipes';

/** Cloche de notifications avec compteur, rafraîchie toutes les 30 secondes. */
@Component({
  standalone: true,
  selector: 'app-notification-bell',
  imports: [...I18N],
  template: `
    <div class="bell-wrap">
      <button type="button" class="btn btn-outline btn-icon bell" (click)="toggle()" [attr.aria-label]="'layout.notifications.title' | t">
        <i class="bi bi-bell"></i>
        @if (unread() > 0) {
          <span class="count">{{ unread() > 9 ? '9+' : unread() }}</span>
        }
      </button>
      @if (open()) {
        <div class="dropdown">
          <div class="row-between head">
            <strong>{{ 'layout.notifications.title' | t }}</strong>
            @if (unread() > 0) {
              <button type="button" class="btn btn-ghost btn-sm" (click)="markAll()">{{ 'layout.notifications.markAll' | t }}</button>
            }
          </div>
          @for (n of items(); track n.id) {
            <button type="button" class="item" [class.unread]="!n.lu" (click)="openNotification(n)">
              <strong>{{ n.titre }}</strong>
              <span>{{ n.message }}</span>
              <small class="muted">{{ n.created_at | appDate: 'datetime' }}</small>
            </button>
          } @empty {
            <p class="muted empty">{{ 'layout.notifications.empty' | t }}</p>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .bell-wrap {
      position: relative;
    }

    .bell {
      position: relative;
      background: var(--surface);
    }

    .count {
      position: absolute;
      top: -6px;
      inset-inline-end: -6px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      border-radius: 999px;
      background: var(--danger);
      color: #fff;
      font-size: 10px;
      display: grid;
      place-items: center;
    }

    .dropdown {
      position: absolute;
      inset-inline-end: 0;
      top: 46px;
      width: 340px;
      max-height: 420px;
      overflow-y: auto;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: var(--shadow-lg);
      z-index: 500;
      padding: 8px;
    }

    .head {
      padding: 6px 8px 10px;
    }

    .item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 100%;
      text-align: start;
      padding: 10px;
      border: none;
      border-radius: 10px;
      background: transparent;
      color: var(--text);
      font: inherit;
      cursor: pointer;
    }
    .item span {
      color: var(--text-muted);
      font-size: 13px;
    }
    .item:hover {
      background: var(--surface-2);
    }
    .item.unread {
      background: var(--primary-soft);
    }

    .empty {
      padding: 16px;
      text-align: center;
    }

    @media (max-width: 500px) {
      .dropdown {
        width: calc(100vw - 32px);
        inset-inline-end: -60px;
      }
    }
  `,
})
export class NotificationBell {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly items = signal<AppNotification[]>([]);
  protected readonly unread = signal(0);
  protected readonly open = signal(false);

  constructor() {
    this.load();
    const timer = setInterval(() => this.load(), 30000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected toggle(): void {
    this.open.update((v) => !v);
    if (this.open()) this.load();
  }

  protected openNotification(n: AppNotification): void {
    if (!n.lu) {
      this.api.markNotificationRead(n.id).subscribe(() => this.load());
    }
    this.open.set(false);
    if (n.lien) this.router.navigateByUrl(n.lien);
  }

  protected markAll(): void {
    this.api.markAllNotificationsRead().subscribe(() => this.load());
  }

  private load(): void {
    this.api.notifications().subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.unread.set(res.non_lues);
      },
      error: () => undefined,
    });
  }
}
