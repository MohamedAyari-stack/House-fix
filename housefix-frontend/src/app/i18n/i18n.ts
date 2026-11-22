import { computed, signal } from '@angular/core';
import { AR } from './ar/index';
import { EN } from './en/index';
import { FR } from './fr/index';

/**
 * Traduction de l'interface (français / arabe / anglais), changeable sans recharger la page.
 *
 * - Les textes sont dans i18n/fr/*.ts (source) et i18n/ar/*.ts et i18n/en/*.ts (typés sur le français :
 *   une clé manquante est une erreur de compilation).
 * - Dans un template : {{ 'auth.login.title' | t }} ou {{ 'x.y' | t: { nom: user.nom } }}.
 * - En TypeScript (même hors composant) : translate('common.errors.network').
 * - Les paramètres s'écrivent {nom} dans les textes.
 */
export type Lang = 'fr' | 'ar' | 'en';

/** Langues proposées, dans l'ordre d'affichage du sélecteur (nom écrit dans sa propre langue). */
export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
];

const STORAGE_KEY = 'hf_lang';
const DICTIONARIES: Record<Lang, unknown> = { fr: FR, ar: AR, en: EN };

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'fr' || saved === 'ar' || saved === 'en') return saved;
  } catch {
    /* stockage indisponible */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language?.toLowerCase() ?? '' : '';
  if (nav.startsWith('ar')) return 'ar';
  if (nav.startsWith('en')) return 'en';
  return 'fr';
}

/** Langue courante, partagée par toute l'application. */
export const currentLang = signal<Lang>(initialLang());

/** Locale Angular (dates, nombres) : arabe tunisien (chiffres latins), anglais britannique (jour/mois/année). */
const LOCALES: Record<Lang, string> = { fr: 'fr-FR', ar: 'ar-TN', en: 'en-GB' };
export const currentLocale = computed(() => LOCALES[currentLang()]);

export function setLang(lang: Lang): void {
  currentLang.set(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* stockage indisponible */
  }
  applyToDocument(lang);
}

/** <html lang dir> : le navigateur inverse la mise en page en arabe (droite à gauche). */
export function applyToDocument(lang: Lang = currentLang()): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Texte traduit ; repli sur le français, puis sur la clé elle-même (visible pendant le développement). */
export function translate(key: string, params?: Record<string, unknown>): string {
  const text = lookup(DICTIONARIES[currentLang()], key) ?? lookup(FR, key) ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (params[name] ?? match) as string);
}
