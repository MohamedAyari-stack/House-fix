import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme.service';
import { applyToDocument } from './i18n/i18n';
import { Toasts } from './shared/toasts';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [RouterOutlet, Toasts],
  template: `
    <router-outlet />
    <app-toasts />
  `,
})
export class App {
  // Instancié dès le démarrage pour appliquer le thème mémorisé.
  private readonly theme = inject(ThemeService);

  constructor() {
    // <html lang dir> selon la langue mémorisée (arabe : droite à gauche).
    applyToDocument();
  }
}
