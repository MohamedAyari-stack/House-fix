import { formatDate, formatNumber } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
import { Lang, currentLang, currentLocale, translate } from './i18n';

/**
 * {{ 'clé' | t }} — impur pour suivre le changement de langue sans recharger.
 * Le résultat est mis en cache tant que la clé, les paramètres et la langue ne changent pas.
 */
@Pipe({ name: 't', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private last?: { key: string; params?: Record<string, unknown>; lang: string; value: string };

  transform(key: string, params?: Record<string, unknown>): string {
    const lang = currentLang();
    const l = this.last;
    if (l && l.key === key && l.lang === lang && shallowEqual(l.params, params)) return l.value;
    const value = translate(key, params);
    this.last = { key, params: params ? { ...params } : undefined, lang, value };
    return value;
  }
}

/** Formats de date nommés, adaptés à chaque langue (le français contient « à » dans certains formats). */
const DATE_FORMATS: Record<string, Record<Lang, string>> = {
  date: { fr: 'dd/MM/yyyy', ar: 'dd/MM/yyyy', en: 'dd/MM/yyyy' },
  datetime: { fr: "dd/MM/yyyy 'à' HH:mm", ar: 'dd/MM/yyyy - HH:mm', en: 'dd/MM/yyyy, HH:mm' },
  full: { fr: 'EEEE d MMMM y', ar: 'EEEE d MMMM y', en: 'EEEE d MMMM y' },
  long: { fr: 'd MMMM y', ar: 'd MMMM y', en: 'd MMMM y' },
  longtime: { fr: "d MMMM y 'à' HH:mm", ar: 'd MMMM y - HH:mm', en: 'd MMMM y, HH:mm' },
  weekday: { fr: 'EEEE d MMMM', ar: 'EEEE d MMMM', en: 'EEEE d MMMM' },
  daymonth: { fr: 'dd/MM', ar: 'dd/MM', en: 'dd/MM' },
  time: { fr: 'HH:mm', ar: 'HH:mm', en: 'HH:mm' },
};

/**
 * {{ valeur | appDate: 'long' }} — date dans la langue courante.
 * Formats : date, datetime, full, long, longtime, weekday, daymonth, time.
 */
@Pipe({ name: 'appDate', standalone: true, pure: false })
export class AppDatePipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined, format: keyof typeof DATE_FORMATS = 'date'): string {
    if (value === null || value === undefined || value === '') return '';
    const pattern = DATE_FORMATS[format]?.[currentLang()] ?? format;
    try {
      return formatDate(value, pattern, currentLocale());
    } catch {
      return String(value);
    }
  }
}

/** {{ valeur | appNumber: '1.0-2' }} — séparateurs de la langue courante. */
@Pipe({ name: 'appNumber', standalone: true, pure: false })
export class AppNumberPipe implements PipeTransform {
  transform(value: number | string | null | undefined, digits?: string): string {
    if (value === null || value === undefined || value === '') return '';
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(n) ? String(value) : formatNumber(n, currentLocale(), digits);
  }
}

/** {{ user.gouvernorat | gouv }} — nom du gouvernorat dans la langue courante (la valeur stockée reste en français). */
@Pipe({ name: 'gouv', standalone: true, pure: false })
export class GouvernoratPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return value ? translate(`common.gouvernorats.${value}`) : '';
  }
}

function shallowEqual(a?: Record<string, unknown>, b?: Record<string, unknown>): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

/** À ajouter dans `imports` d'un composant qui affiche du texte, des dates ou des nombres. */
export const I18N = [TranslatePipe, AppDatePipe, AppNumberPipe, GouvernoratPipe] as const;
