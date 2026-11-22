import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Role, User, roleLabel } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage } from '../../core/utils';
import { translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';
import { Avatar } from '../../shared/avatar';
import { BlockUserModal } from './block-user-modal';

type RoleTab = '' | Role;

@Component({
  standalone: true,
  selector: 'app-utilisateurs',
  imports: [...I18N, NgTemplateOutlet, FormsModule, Avatar, BlockUserModal],
  templateUrl: './utilisateurs.html',
  styleUrl: './utilisateurs.css',
})
export class Utilisateurs {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  /** Onglets de rôle ; libellés : admin.utilisateurs.tabs.* */
  protected readonly roleTabs: { key: RoleTab; label: string }[] = [
    { key: '', label: 'all' },
    { key: 'client', label: 'client' },
    { key: 'prestataire', label: 'prestataire' },
    { key: 'admin', label: 'admin' },
  ];
  protected readonly roleLabel = roleLabel;
  protected readonly roleClasses: Record<Role, string> = { client: 'badge-primary', prestataire: 'badge-violet', admin: 'badge-info' };

  protected readonly meId = this.auth.user()?.id ?? null;
  protected readonly items = signal<User[]>([]);
  protected readonly loading = signal(true);
  protected readonly role = signal<RoleTab>('');
  protected readonly query = signal('');
  protected readonly busy = signal<number | null>(null);
  protected readonly blocking = signal<User | null>(null);

  private debounce: ReturnType<typeof setTimeout> | undefined;
  private request: Subscription | undefined;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.query.set(params.get('q') ?? '');
      this.load();
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.debounce);
      this.request?.unsubscribe();
    });
  }

  protected setRole(role: RoleTab): void {
    this.role.set(role);
    this.load();
  }

  protected onSearch(value: string): void {
    this.query.set(value);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.load(), 350);
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

  protected supprimer(u: User): void {
    if (!window.confirm(translate('admin.utilisateurs.confirmDelete', { nom: u.nom }))) return;
    this.busy.set(u.id);
    this.api.deleteUser(u.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.items.update((list) => list.filter((x) => x.id !== u.id));
        this.toast.success(translate('admin.utilisateurs.deleted', { nom: u.nom }));
      },
      error: (err) => this.fail(err),
    });
  }

  protected onBlocked(updated: User): void {
    this.replace(updated);
    this.blocking.set(null);
  }

  private load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.request = this.api.adminUsers({ role: this.role(), q: this.query().trim() }).subscribe({
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

  private replace(updated: User): void {
    this.busy.set(null);
    this.items.update((list) => list.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
  }

  private fail(err: unknown): void {
    this.busy.set(null);
    this.toast.error(errorMessage(err));
  }
}
