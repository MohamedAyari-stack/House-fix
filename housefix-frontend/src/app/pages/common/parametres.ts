import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Categorie, GOUVERNORATS, User } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { precisePosition, errorMessage, fieldErrors } from '../../core/utils';
import { PhotoDropzone } from '../../shared/photo-dropzone';
import { LANGUAGES, Lang, currentLang, setLang, translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';

/** Statut de validation du prestataire ; libellé traduit : pages.parametres.validation.<statut>. */
const VALIDATION_LABELS = {
  en_attente: { key: 'pages.parametres.validation.en_attente', css: 'badge-warning', icon: 'bi-hourglass-split' },
  valide: { key: 'pages.parametres.validation.valide', css: 'badge-success', icon: 'bi-patch-check-fill' },
  refuse: { key: 'pages.parametres.validation.refuse', css: 'badge-danger', icon: 'bi-x-octagon' },
} as const;

@Component({
  standalone: true,
  selector: 'app-parametres',
  imports: [FormsModule, PhotoDropzone, ...I18N],
  templateUrl: './parametres.html',
  styleUrl: './parametres.css',
})
export class Parametres {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly gouvernorats = GOUVERNORATS;
  protected readonly lang = currentLang;
  /** Chaque langue est affichée dans sa propre langue (Français, العربية, English). */
  protected readonly langs = LANGUAGES;
  protected readonly user = this.auth.user;
  protected readonly isPrestataire = computed(() => this.auth.role() === 'prestataire');
  protected readonly validation = computed(() => {
    const status = this.user()?.prestataire?.validation_status;
    return status ? VALIDATION_LABELS[status] : null;
  });

  protected readonly categories = signal<Categorie[]>([]);
  protected readonly saving = signal<'profil' | 'pro' | null>(null);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly locating = signal(false);
  protected readonly coords = signal<{ lat: number; lng: number } | null>(null);
  protected readonly available = signal(false);
  protected readonly togglingAvailability = signal(false);

  protected readonly pwdSaving = signal(false);
  protected readonly pwdErrors = signal<Record<string, string>>({});
  protected readonly showPwd = signal(false);
  protected pwd = { current_password: '', password: '', password_confirmation: '' };

  protected form = {
    nom: '',
    telephone: '',
    gouvernorat: '',
    address: '',
  };

  protected pro = {
    categorie_service_id: null as number | null,
    specialite: '',
    description: '',
    experience_annees: null as number | null,
    certifications: '',
    tarif_horaire: null as number | null,
    disponibilites: '',
  };

  constructor() {
    const user = this.user();
    if (user) this.fill(user);
    if (this.isPrestataire()) {
      this.api.categories().subscribe({ next: (c) => this.categories.set(c), error: () => undefined });
    }
    // Recharge le profil à jour depuis le serveur.
    this.auth.refreshUser().subscribe({ next: (u) => this.fill(u), error: () => undefined });
  }

  /** Incrémenté à chaque remplissage asynchrone des formulaires : force le rafraîchissement (zoneless). */
  protected readonly rev = signal(0);

  private fill(user: User): void {
    this.rev.update((v) => v + 1);
    this.form = {
      nom: user.nom ?? '',
      telephone: user.telephone ?? '',
      gouvernorat: user.gouvernorat ?? '',
      address: user.address ?? '',
    };
    this.coords.set(user.latitude != null && user.longitude != null ? { lat: user.latitude, lng: user.longitude } : null);
    const p = user.prestataire;
    if (p) {
      this.pro = {
        categorie_service_id: p.categorie_service_id,
        specialite: p.specialite ?? '',
        description: p.description ?? '',
        experience_annees: p.experience_annees,
        certifications: p.certifications ?? '',
        tarif_horaire: p.tarif_horaire,
        disponibilites: p.disponibilites ?? '',
      };
      this.available.set(p.is_available);
    }
  }

  // --- Photo (glisser-déposer : composant PhotoDropzone) ---
  protected onPhotoUploaded(user: User): void {
    this.auth.setUser(user);
    this.toast.success(translate('pages.parametres.toasts.photo'));
  }


  // --- Géolocalisation ---
  /** Nouvelle adresse : les anciennes coordonnées ne lui correspondent plus ; le serveur la géolocalise à l'enregistrement. */
  protected onAddressChange(): void {
    this.coords.set(null);
  }

  protected async locate(): Promise<void> {
    this.locating.set(true);
    const pos = await precisePosition();
    this.locating.set(false);
    if (pos === 'imprecise') {
      this.toast.error(translate('client.shared.geoImprecise'));
    } else if (pos) {
      this.coords.set({ lat: pos.lat, lng: pos.lng });
      this.toast.info(translate('pages.parametres.toasts.located'));
    } else {
      this.toast.error(translate('pages.parametres.errors.location'));
    }
  }

  // --- Profil ---
  protected save(section: 'profil' | 'pro'): void {
    const e: Record<string, string> = {};
    if (!this.form.nom.trim()) e['nom'] = translate('pages.parametres.errors.nom');
    if (section === 'pro' && this.pro.tarif_horaire != null && this.pro.tarif_horaire < 0) {
      e['tarif_horaire'] = translate('pages.parametres.errors.tarif');
    }
    this.errors.set(e);
    if (Object.keys(e).length) {
      if (e['nom'] && section === 'pro') this.toast.error(e['nom']);
      return;
    }

    const c = this.coords();
    const payload: Record<string, unknown> = {
      nom: this.form.nom.trim(),
      telephone: this.form.telephone.trim() || null,
      gouvernorat: this.form.gouvernorat || null,
      address: this.form.address.trim() || null,
      latitude: c?.lat ?? null,
      longitude: c?.lng ?? null,
    };
    if (this.isPrestataire()) {
      Object.assign(payload, {
        categorie_service_id: this.pro.categorie_service_id,
        specialite: this.pro.specialite.trim() || null,
        description: this.pro.description.trim() || null,
        experience_annees: this.pro.experience_annees ?? null,
        certifications: this.pro.certifications.trim() || null,
        tarif_horaire: this.pro.tarif_horaire ?? null,
        disponibilites: this.pro.disponibilites.trim() || null,
      });
    }

    this.saving.set(section);
    this.api.updateProfile(payload).subscribe({
      next: (user) => {
        this.saving.set(null);
        this.auth.setUser(user);
        this.fill(user);
        this.toast.success(translate(section === 'pro' ? 'pages.parametres.toasts.pro' : 'pages.parametres.toasts.profil'));
      },
      error: (err) => {
        this.saving.set(null);
        this.errors.set(fieldErrors(err));
        this.toast.error(errorMessage(err));
      },
    });
  }

  // --- Disponibilité (prestataire) ---
  protected toggleAvailability(value: boolean): void {
    this.available.set(value);
    this.togglingAvailability.set(true);
    this.api.setAvailability(value).subscribe({
      next: (user) => {
        this.togglingAvailability.set(false);
        this.auth.setUser(user);
        this.toast.success(translate(value ? 'pages.parametres.toasts.available' : 'pages.parametres.toasts.unavailable'));
      },
      error: (err) => {
        this.togglingAvailability.set(false);
        this.available.set(!value);
        this.toast.error(errorMessage(err));
      },
    });
  }

  // --- Langue ---
  protected chooseLang(lang: Lang): void {
    if (lang !== this.lang()) setLang(lang);
  }

  // --- Sécurité ---
  protected changePassword(): void {
    const e: Record<string, string> = {};
    if (!this.pwd.current_password) e['current_password'] = translate('pages.parametres.errors.currentPassword');
    if (this.pwd.password.length < 8) e['password'] = translate('pages.parametres.errors.passwordLength');
    if (this.pwd.password !== this.pwd.password_confirmation) {
      e['password_confirmation'] = translate('pages.parametres.errors.passwordMismatch');
    }
    this.pwdErrors.set(e);
    if (Object.keys(e).length) return;

    this.pwdSaving.set(true);
    this.api.changePassword(this.pwd).subscribe({
      next: (res) => {
        this.pwdSaving.set(false);
        this.pwd = { current_password: '', password: '', password_confirmation: '' };
        this.toast.success(res?.message || translate('pages.parametres.toasts.password'));
      },
      error: (err) => {
        this.pwdSaving.set(false);
        this.pwdErrors.set(fieldErrors(err));
        this.toast.error(errorMessage(err));
      },
    });
  }
}
