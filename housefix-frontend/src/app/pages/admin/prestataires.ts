import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { User } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage } from '../../core/utils';
import { translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';
import { Avatar } from '../../shared/avatar';
import { StarRating } from '../../shared/star-rating';
import { BlockUserModal } from './block-user-modal';
import { RefusModal } from './refus-modal';

type Filter = 'tous' | 'en_attente' | 'valide' | 'refuse';

@Component({
  standalone: true,
  selector: 'app-admin-prestataires',
  imports: [...I18N, FormsModule, NgTemplateOutlet, Avatar, StarRating, BlockUserModal, RefusModal],
  templateUrl: './prestataires.html',
  styleUrl: './prestataires.css',
})
export class AdminPrestataires {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  protected readonly filters: Filter[] = ['tous', 'en_attente', 'valide', 'refuse'];
  protected readonly validationClasses: Record<string, string> = { en_attente: 'badge-warning', valide: 'badge-success', refuse: 'badge-danger' };

  protected readonly items = signal<User[]>([]);
  protected readonly loading = signal(true);
  protected readonly filter = signal<Filter>('tous');
  protected readonly search = signal('');
  protected readonly busy = signal<number | null>(null);
  protected readonly blocking = signal<User | null>(null);
  protected readonly refusing = signal<User | null>(null);

  protected readonly counts = computed(() => {
    const c: Record<Filter, number> = { tous: 0, en_attente: 0, valide: 0, refuse: 0 };
    for (const u of this.items()) {
      c.tous++;
      const s = u.prestataire?.validation_status;
      if (s) c[s]++;
    }
    return c;
  });

  protected readonly filtered = computed(() => {
    const f = this.filter();
    const q = this.search().trim().toLowerCase();
    return this.items().filter((u) => {
      if (f !== 'tous' && u.prestataire?.validation_status !== f) return false;
      if (!q) return true;
      return [u.nom, u.email, u.telephone, u.gouvernorat, u.prestataire?.categorie?.nom, u.prestataire?.specialite]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  });

  constructor() {
    this.api.adminPrestataires().subscribe({
      next: (list) => {
        this.items.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected valider(u: User): void {
    this.busy.set(u.id);
    this.api.validerPrestataire(u.id).subscribe({
      next: (updated) => {
        this.replace(updated);
        this.toast.success(translate('admin.prestataires.validated', { nom: u.nom }));
      },
      error: (err) => this.fail(err),
    });
  }

  protected refuser(u: User, motif: string | null): void {
    this.busy.set(u.id);
    this.api.refuserPrestataire(u.id, motif).subscribe({
      next: (updated) => {
        this.replace(updated);
        this.refusing.set(null);
        this.toast.success(translate('admin.shared.refused', { nom: u.nom }));
      },
      error: (err) => this.fail(err),
    });
  }

  protected debloquer(u: User): void {
    if (!window.confirm(translate('admin.shared.confirmUnblock', { nom: u.nom }))) return;
    this.busy.set(u.id);
    this.api.debloquerUser(u.id).subscribe({
      next: (updated) => {
        this.replace(updated);
        this.toast.success(translate('admin.shared.unblocked', { nom: u.nom }));
      },
      error: (err) => this.fail(err),
    });
  }

  protected onBlocked(updated: User): void {
    this.replace(updated);
    this.blocking.set(null);
  }

  private replace(updated: User): void {
    this.busy.set(null);
    this.items.update((list) =>
      list.map((u) => (u.id === updated.id ? { ...u, ...updated, prestataire: updated.prestataire ?? u.prestataire } : u)),
    );
  }

  private fail(err: unknown): void {
    this.busy.set(null);
    this.toast.error(errorMessage(err));
  }
}
