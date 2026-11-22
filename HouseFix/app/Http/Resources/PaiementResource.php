<?php

namespace App\Http\Resources;

use App\Models\Paiement;
use Illuminate\Http\Request;

/** @mixin Paiement */
class PaiementResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'facture_id' => $this->facture_id,
            'montant' => (float) $this->montant,
            'mode' => $this->mode,
            'statut' => $this->statut,
            'reference' => $this->reference,
            'created_at' => self::iso($this->created_at),
        ];
    }
}
