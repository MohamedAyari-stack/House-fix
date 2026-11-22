import { HttpErrorResponse } from '@angular/common/http';
import { translate } from '../i18n/i18n';

/**
 * Extrait un message lisible d'une erreur HTTP Laravel (validation 422 comprise).
 * Les messages du serveur arrivent déjà dans la langue de l'interface (en-tête Accept-Language).
 * `fallback` : texte déjà traduit, sinon le message générique.
 */
export function errorMessage(err: unknown, fallback?: string): string {
  fallback ??= translate('common.errors.generic');
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return translate('common.errors.network');
    if (err.status === 429) return translate('common.errors.tooMany');
    const body = err.error;
    if (body?.errors) {
      const first = Object.values(body.errors as Record<string, string[]>)[0];
      if (first?.length) return first[0];
    }
    if (body?.message) return body.message;
  }
  return fallback;
}

/** Erreurs de validation par champ (422), pour l'affichage sous les inputs. */
export function fieldErrors(err: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (err instanceof HttpErrorResponse && err.status === 422 && err.error?.errors) {
    for (const [field, messages] of Object.entries(err.error.errors as Record<string, string[]>)) {
      result[field] = messages[0];
    }
  }
  return result;
}

/** Lien Google Maps vers des coordonnées, ou vers une adresse texte à défaut. */
export function mapsUrl(lat: number | null, lng: number | null, address?: string | null): string {
  if (lat && lng) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address ?? '')}`;
}

/** Date locale au format YYYY-MM-DD (sans décalage UTC). */
export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Initiales d'un nom pour les avatars sans photo. */
export function initials(nom: string | null | undefined): string {
  return (nom ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/** Télécharge un Blob (ex. facture PDF) sous un nom de fichier donné. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Au-delà de cette marge d'erreur (en mètres), la position du navigateur n'est pas fiable : sur un ordinateur
 * sans GPS, elle est estimée par l'adresse IP ou le Wi-Fi et peut être fausse de plusieurs kilomètres.
 */
export const PRECISION_MAX_M = 1000;

/** Position du navigateur avec sa marge d'erreur (accuracy, en mètres), ou null si refusée / indisponible. */
export function currentPosition(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

/** Position du navigateur seulement si elle est assez précise pour calculer des distances. */
export async function precisePosition(): Promise<{ lat: number; lng: number; accuracy: number } | 'imprecise' | null> {
  const pos = await currentPosition();
  if (!pos) return null;
  return pos.accuracy <= PRECISION_MAX_M ? pos : 'imprecise';
}
