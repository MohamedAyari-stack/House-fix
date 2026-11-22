<?php

namespace App\Services;

use App\Models\CategorieService;
use App\Models\TauxTva;

/** VAT computations. All amounts are computed here, never in the frontend. */
class Tva
{
    /**
     * Montant TVA = HT × taux / 100 ; TTC = HT + TVA.
     *
     * @return array{montant_ht: float, taux_tva: float, montant_tva: float, montant_ttc: float}
     */
    public static function calculer(float $montantHt, float $taux): array
    {
        $ht = round($montantHt, 2);
        $tva = round($ht * $taux / 100, 2);

        return ['montant_ht' => $ht, 'taux_tva' => $taux, 'montant_tva' => $tva, 'montant_ttc' => round($ht + $tva, 2)];
    }

    /**
     * Same split from a TTC amount: HT = TTC / (1 + taux / 100), TVA = TTC - HT (so HT + TVA = TTC exactly).
     *
     * @return array{montant_ht: float, taux_tva: float, montant_tva: float, montant_ttc: float}
     */
    public static function depuisTtc(float $montantTtc, float $taux): array
    {
        $ttc = round($montantTtc, 2);
        $ht = round($ttc / (1 + $taux / 100), 2);

        return ['montant_ht' => $ht, 'taux_tva' => $taux, 'montant_tva' => round($ttc - $ht, 2), 'montant_ttc' => $ttc];
    }

    /** Rate of a service: its own rate, otherwise the default rate, otherwise 0. */
    public static function tauxPour(?CategorieService $categorie): float
    {
        return (float) ($categorie?->tauxTva?->taux ?? once(fn () => TauxTva::parDefaut())?->taux ?? 0);
    }
}
