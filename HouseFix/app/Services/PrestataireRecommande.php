<?php

namespace App\Services;

use App\Models\RendezVous;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * "Prestataire recommandé" badge: all three conditions at once, computed on every request
 * so it follows any change of position, appointments or rating.
 *   - distance from the client ≤ 8 km (Haversine, GPS coordinates of both accounts);
 *   - at least 10 accepted appointments (accepte, termine, facture — not refused or cancelled);
 *   - average rating of exactly 5/5 (with at least one review).
 */
class PrestataireRecommande
{
    public const DISTANCE_MAX_KM = 8;

    public const MIN_RDV_ACCEPTES = 10;

    public const NOTE_REQUISE = 5.0;

    /** Statuses of an appointment the prestataire has accepted and that was not cancelled. */
    public const STATUTS_ACCEPTES = ['accepte', 'termine', 'facture'];

    public static function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadiusKm = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return $earthRadiusKm * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    public static function estRecommande(?float $distanceKm, int $rdvAcceptes, float $noteMoyenne, int $nbAvis): bool
    {
        return $distanceKm !== null
            && $distanceKm <= self::DISTANCE_MAX_KM
            && $rdvAcceptes >= self::MIN_RDV_ACCEPTES
            && $nbAvis > 0
            && round($noteMoyenne, 2) === self::NOTE_REQUISE;
    }

    /**
     * Sets rdv_acceptes and is_recommended on each prestataire (distance_km must already be set,
     * null when either position is unknown — then the prestataire cannot be recommended).
     */
    public static function appliquer(Collection $prestataires): Collection
    {
        $counts = RendezVous::whereIn('prestataire_id', $prestataires->pluck('id'))
            ->whereIn('status', self::STATUTS_ACCEPTES)
            ->selectRaw('prestataire_id, count(*) as total')
            ->groupBy('prestataire_id')
            ->pluck('total', 'prestataire_id');

        return $prestataires->each(function (User $u) use ($counts) {
            $profile = $u->prestataireProfile;
            $u->rdv_acceptes = (int) ($counts[$u->id] ?? 0);
            $u->is_recommended = self::estRecommande(
                $u->distance_exact ?? $u->distance_km,
                $u->rdv_acceptes,
                (float) ($profile?->note_moyenne ?? 0),
                (int) ($profile?->nb_avis ?? 0),
            );
        });
    }

    /** Distance between a viewer and a prestataire, null when a position is missing. */
    public static function distance(?float $lat, ?float $lng, User $prestataire): ?float
    {
        return ($lat !== null && $lng !== null && $prestataire->latitude !== null && $prestataire->longitude !== null)
            ? round(self::haversine($lat, $lng, (float) $prestataire->latitude, (float) $prestataire->longitude), 1)
            : null;
    }
}
