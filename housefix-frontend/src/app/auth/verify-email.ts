import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/utils';
import { translate } from '../i18n/i18n';
import { I18N } from '../i18n/pipes';
import { LangSwitch } from '../shared/lang-switch';
import { ThemeToggle } from '../shared/theme-toggle';

/**
 * Vérification de l'adresse email avec le code à 6 chiffres reçu après l'inscription
 * (ou après une tentative de connexion sur un compte non vérifié). Ouvre la session si le code est bon.
 */
@Component({
  standalone: true,
  selector: 'app-verify-email',
  imports: [FormsModule, RouterLink, ThemeToggle, LangSwitch, ...I18N],
  templateUrl: './verify-email.html',
  styleUrl: './auth-frame.css',
})
export class VerifyEmail {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  protected readonly email = this.query.get('email') ?? '';

  protected code = '';
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(
    this.query.get('sent') === '0' ? translate('auth.verify.notSent') : null,
  );
  protected readonly info = signal<string | null>(
    this.query.get('sent') === '0' ? null : translate('auth.verify.codeSent', { email: this.email }),
  );

  protected verify(): void {
    this.code = this.code.replace(/\D/g, '');
    if (this.code.length !== 6) {
      this.showError(translate('auth.common.errors.codeSixDigits'));
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.auth.verifyEmail(this.email, this.code).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.toast.success(translate('auth.verify.welcome', { nom: res.user.nom }));
        this.router.navigateByUrl(this.auth.homeFor(res.user.role));
      },
      error: (err) => {
        this.loading.set(false);
        this.showError(errorMessage(err, translate('auth.verify.errors.wrongCode')));
      },
    });
  }

  protected resend(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.resendVerification(this.email).subscribe({
      next: () => {
        this.loading.set(false);
        this.code = '';
        this.info.set(translate('auth.verify.resent', { email: this.email }));
      },
      error: (err) => {
        this.loading.set(false);
        this.showError(errorMessage(err, translate('auth.verify.errors.resendFailed')));
      },
    });
  }

  private showError(message: string): void {
    this.info.set(null);
    this.error.set(message);
  }
}
