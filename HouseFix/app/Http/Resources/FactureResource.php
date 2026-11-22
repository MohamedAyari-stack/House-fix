<?php

namespace App\Http\Resources;

use App\Models\Facture;
use Illuminate\Http\Request;

/** @mixin Facture */
class FactureResource extends BaseResource
{
    /** False when embedded inside a RendezVous. */
    protected bool $withRendezVous = true;

    public function withoutRendezVous(): static
    {
        $this->withRendezVous = false;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $data = [
            'id' => $this->id,
            'numero' => $this->numero,
            'rendez_vous_id' => $this->rendez_vous_id,
            'client_id' => $this->client_id,
            'prestataire_id' => $this->prestataire_id,
            // montant = TTC, the amount to pay.
            'montant' => (float) $this->montant,
            'montant_ht' => (float) ($this->montant_ht ?? $this->montant),
            'taux_tva' => (float) $this->taux_tva,
            'montant_tva' => (float) $this->montant_tva,
            'montant_ttc' => (float) $this->montant,
            'details' => $this->details,
            'date' => self::ymd($this->date),
            'statut_paiement' => $this->statut_paiement,
            'mode_paiement' => $this->mode_paiement,
            'paid_at' => self::iso($this->paid_at),
        ];

        if ($this->withRendezVous) {
            $data['rendez_vous'] = $this->rendezVous ? (new RendezVousResource($this->rendezVous))->withoutFacture() : null;
        }

        $data['paiements'] = PaiementResource::collection($this->paiements);

        return $data;
    }
}
