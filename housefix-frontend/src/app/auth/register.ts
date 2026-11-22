import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Categorie, GOUVERNORATS } from '../core/models';
import { ToastService } from '../core/toast.service';
import { errorMessage, fieldErrors } from '../core/utils';
import { translate } from '../i18n/i18n';
import { I18N } from '../i18n/pipes';
import { LEGAL_VERSION } from '../pages/legal/content/types';
import { LangSwitch } from '../shared/lang-switch';
import { ThemeToggle } from '../shared/theme-toggle';

@Component({
  standalone: true,
  selector: 'app-register',
  imports: [FormsModule, RouterLink, ThemeToggle, LangSwitch, ...I18N],
  templateUrl: './register.html',
  styleUrl: './auth-frame.css',
})
export class Register {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly gouvernorats = GOUVERNORATS;
  protected readonly categories = signal<Categorie[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly showPassword = signal(false);

  protected form = {
    nom: '',
    email: '',
    gouvernorat: '',
    telephone: '',
    role: '' as '' | 'client' | 'prestataire',
    categorie_service_id: null as number | null,
    password: '',
    password_confirmation: '',
    /** Case « J'accepte les conditions… » ; envoyée avec la version des documents acceptés. */
    accepte_conditions: false,
  };

  constructor() {
    this.api.categories().subscribe({ next: (c) => this.categories.set(c), error: () => undefined });
    // Les boutons de la page d'accueil (« Trouver un prestataire », « Devenir prestataire ») présélectionnent le rôle.
    const role = inject(ActivatedRoute).snapshot.queryParamMap.get('role');
    if (role === 'client' || role === 'prestataire') this.form.role = role;
  }

  protected submit(): void {
    const local: Record<string, string> = {};
    if (!this.form.nom.trim()) local['nom'] = translate('auth.register.errors.name');
    if (!this.form.email.trim()) local['email'] = translate('auth.register.errors.email');
    if (!this.form.gouvernorat) local['gouvernorat'] = translate('auth.register.errors.gouvernorat');
    if (!this.form.role) local['role'] = translate('auth.register.errors.role');
    if (this.form.role === 'prestataire' && !this.form.categorie_service_id) {
      local['categorie_service_id'] = translate('auth.register.errors.job');
    }
    if (this.form.password.length < 8) local['password'] = translate('auth.common.errors.passwordMin');
    if (this.form.password !== this.form.password_confirmation) {
      local['password_confirmation'] = translate('auth.register.errors.mismatch');
    }
    if (!this.form.accepte_conditions) local['accepte_conditions'] = translate('legal.consent.required');
    this.errors.set(local);
    if (Object.keys(local).length) return;

    this.loading.set(true);
    this.error.set(null);
    const payload = {
      ...this.form,
      categorie_service_id: this.form.role === 'prestataire' ? this.form.categorie_service_id : null,
      terms_version: LEGAL_VERSION,
    };
    this.auth.register(payload).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.toast.success(translate('auth.register.success'));
        this.router.navigate(['/verify-email'], { queryParams: { email: res.email, sent: res.email_sent ? 1 : 0 } });
      },
      error: (err) => {
        this.loading.set(false);
        this.errors.set(fieldErrors(err));
        this.error.set(errorMessage(err));
      },
    });
  }
}
