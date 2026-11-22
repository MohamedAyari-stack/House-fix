import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiService } from '../core/api.service';
import { ToastService } from '../core/toast.service';
import { errorMessage, fieldErrors } from '../core/utils';
import { translate } from '../i18n/i18n';
import { I18N } from '../i18n/pipes';
import { LangSwitch } from '../shared/lang-switch';
import { ThemeToggle } from '../shared/theme-toggle';

type Step = 'email' | 'code' | 'password';

/** Mot de passe oublié en 3 étapes : email → code à 6 chiffres reçu par email → nouveau mot de passe. */
@Component({
  standalone: true,
  selector: 'app-forgot-password',
  imports: [FormsModule, RouterLink, ThemeToggle, LangSwitch, ...I18N],
  templateUrl: './forgot-password.html',
  styleUrl: './auth-frame.css',
})
export class ForgotPassword {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly step = signal<Step>('email');
  protected email = '';
  protected code = '';
  protected password = '';
  protected confirmation = '';
  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly info = signal<string | null>(null);

  /** Étape 1 (et « Renvoyer le code ») : envoie un code à l'adresse saisie. */
  protected sendCode(): void {
    if (!this.email.trim()) {
      this.error.set(translate('auth.forgot.errors.emailRequired'));
      return;
    }
    this.run(this.api.forgotPassword(this.email.trim()), (res) => {
      this.code = '';
      this.info.set(res.message);
      this.step.set('code');
    });
  }

  /** Étape 2 : vérifie le code avant de demander le nouveau mot de passe. */
  protected verifyCode(): void {
    this.code = this.code.replace(/\D/g, '');
    if (this.code.length !== 6) {
      this.error.set(translate('auth.common.errors.codeSixDigits'));
      return;
    }
    this.run(this.api.verifyResetCode(this.email.trim(), this.code), () => {
      this.info.set(null);
      this.step.set('password');
    });
  }

  /** Étape 3 : enregistre le nouveau mot de passe, puis retour à la connexion. */
  protected resetPassword(): void {
    if (this.password.length < 8) {
      this.error.set(translate('auth.common.errors.passwordMin'));
      return;
    }
    if (this.password !== this.confirmation) {
      this.error.set(translate('auth.forgot.errors.mismatch'));
      return;
    }
    const payload = { email: this.email.trim(), code: this.code, password: this.password, password_confirmation: this.confirmation };
    this.run(this.api.resetPassword(payload), (res) => {
      this.toast.success(res.message);
      this.router.navigateByUrl('/login');
    });
  }

  protected changeEmail(): void {
    this.error.set(null);
    this.info.set(null);
    this.step.set('email');
  }

  private run(request: Observable<{ message: string }>, done: (res: { message: string }) => void): void {
    this.loading.set(true);
    this.error.set(null);
    request.subscribe({
      next: (res) => {
        this.loading.set(false);
        done(res);
      },
      error: (err) => {
        this.loading.set(false);
        const message = errorMessage(err, translate('auth.forgot.errors.generic'));
        this.info.set(null);
        this.error.set(message);
        // Code refusé à la dernière étape (expiré ou annulé) : retour à la saisie du code.
        // On se fie au champ en erreur, pas au texte du message qui dépend de la langue.
        if (this.step() === 'password' && fieldErrors(err)['code']) this.step.set('code');
      },
    });
  }
}
