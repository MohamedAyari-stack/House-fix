import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { currentLang } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';
import { LangSwitch } from '../../shared/lang-switch';
import { ThemeToggle } from '../../shared/theme-toggle';
import { LEGAL, LEGAL_VERSION, LegalBlock } from './content';

export type LegalDocKind = 'privacy' | 'terms';

/** Politique de confidentialité ou conditions d'utilisation (route data `doc`), dans la langue courante. */
@Component({
  standalone: true,
  selector: 'app-legal-page',
  imports: [RouterLink, LangSwitch, ThemeToggle, ...I18N],
  templateUrl: './legal-page.html',
  styleUrl: './legal-page.css',
})
export class LegalPage {
  /** Fourni par la route (withComponentInputBinding). */
  readonly doc = input<LegalDocKind>('privacy');

  protected readonly content = computed(() => LEGAL[currentLang()][this.doc()]);
  protected readonly other = computed<{ path: string; label: string }>(() =>
    this.doc() === 'privacy' ? { path: '/conditions', label: 'legal.termsLink' } : { path: '/confidentialite', label: 'legal.privacyLink' },
  );
  protected readonly updated = LEGAL_VERSION;

  protected isList(block: LegalBlock): block is string[] {
    return Array.isArray(block);
  }

  /** Défilement vers une section sans changer de route (le lien reste un vrai lien #ancre). */
  protected goTo(event: Event, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
  }

  protected print(): void {
    window.print();
  }
}
