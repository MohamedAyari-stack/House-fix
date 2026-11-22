import { Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';

@Component({
  standalone: true,
  selector: 'app-toasts',
  template: `
    <div class="toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class]="'toast ' + t.type" (click)="toast.dismiss(t.id)">
          <i
            class="bi"
            [class.bi-check-circle-fill]="t.type === 'success'"
            [class.bi-exclamation-octagon-fill]="t.type === 'error'"
            [class.bi-info-circle-fill]="t.type === 'info'"
          ></i>
          <span>{{ t.text }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      inset-inline-end: 20px;
      bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 2000;
      max-width: min(380px, 100vw - 40px);
    }

    .toast {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      padding: 12px 14px;
      border-radius: 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-lg);
      cursor: pointer;
      animation: slide 0.2s ease-out;
    }

    .success i {
      color: var(--success);
    }

    .error i {
      color: var(--danger);
    }

    .info i {
      color: var(--primary);
    }

    @keyframes slide {
      from {
        transform: translateY(10px);
        opacity: 0;
      }
    }
  `,
})
export class Toasts {
  protected readonly toast = inject(ToastService);
}
