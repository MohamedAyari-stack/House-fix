import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/utils';
import { translate } from '../i18n/i18n';
import { I18N } from '../i18n/pipes';
import { LangSwitch } from '../shared/lang-switch';
import { ThemeToggle } from '../shared/theme-toggle';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [FormsModule, RouterLink, ThemeToggle, LangSwitch, ...I18N],
  templateUrl: './login.html',
  styleUrl: './auth-frame.css',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected email = '';
  protected password = '';
  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly demoAccounts = [
    { label: 'common.roles.client', email: 'client@housefix.tn' },
    { label: 'common.roles.prestataire', email: 'prestataire@housefix.tn' },
    { label: 'common.roles.admin', email: 'admin@housefix.tn' },
  ];

  protected fillDemo(email: string): void {
    this.email = email;
    this.password = 'password';
  }

  protected submit(): void {
    if (!this.email || !this.password) {
      this.error.set(translate('auth.login.errors.required'));
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.email.trim(), this.password).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.toast.success(translate('auth.login.welcome', { nom: res.user.nom }));
        this.router.navigateByUrl(this.auth.homeFor(res.user.role));
      },
      error: (err) => {
        this.loading.set(false);
        // Bon mot de passe mais email jamais vérifié : l'API vient d'envoyer un code.
        if (err?.error?.email_not_verified) {
          this.toast.info(err.error.message);
          this.router.navigate(['/verify-email'], { queryParams: { email: err.error.email } });
          return;
        }
        this.error.set(errorMessage(err, translate('auth.login.errors.failed')));
      },
    });
  }
}
