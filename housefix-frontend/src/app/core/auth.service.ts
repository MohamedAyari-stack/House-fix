import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { AuthResponse, RegisterResponse, Role, User } from './models';

const TOKEN_KEY = 'hf_token';
const USER_KEY = 'hf_user';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Session de l'utilisateur connecté (jeton Sanctum + profil), persistée dans localStorage. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(readStorage(TOKEN_KEY));
  readonly user = signal<User | null>(this.restoreUser());
  readonly isLoggedIn = computed(() => !!this.token() && !!this.user());
  readonly role = computed(() => this.user()?.role ?? null);

  private restoreUser(): User | null {
    const raw = readStorage(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.api.login(email, password).pipe(tap((res) => this.setSession(res)));
  }

  /** Crée le compte ; la session s'ouvre seulement après verifyEmail(). */
  register(data: object): Observable<RegisterResponse> {
    return this.api.register(data);
  }

  verifyEmail(email: string, code: string): Observable<AuthResponse> {
    return this.api.verifyEmail(email, code).pipe(tap((res) => this.setSession(res)));
  }

  /** Recharge le profil depuis le serveur (après modification, ou au démarrage). */
  refreshUser(): Observable<User> {
    return this.api.me().pipe(tap((user) => this.setUser(user)));
  }

  setUser(user: User): void {
    this.user.set(user);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      /* stockage indisponible : la session reste en mémoire */
    }
  }

  logout(): void {
    if (this.token()) {
      this.api.logout().subscribe({ error: () => undefined });
    }
    this.clearSession();
    this.router.navigate(['/login']);
  }

  /** Vide la session locale sans appeler l'API (jeton déjà invalide). */
  clearSession(): void {
    this.token.set(null);
    this.user.set(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      /* rien à faire */
    }
  }

  homeFor(role: Role | null): string {
    return role ? `/${role}` : '/login';
  }

  private setSession(res: AuthResponse): void {
    this.token.set(res.token);
    try {
      localStorage.setItem(TOKEN_KEY, res.token);
    } catch {
      /* stockage indisponible */
    }
    this.setUser(res.user);
  }
}
