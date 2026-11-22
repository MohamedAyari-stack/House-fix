<?php

namespace App\Http\Resources;

use App\Models\Litige;
use Illuminate\Http\Request;

/** @mixin Litige */
class LitigeResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        $rdv = $this->rendezVous;

        return [
            'id' => $this->id,
            'rendez_vous_id' => $this->rendez_vous_id,
            'declarant_id' => $this->declarant_id,
            'cible_id' => $this->cible_id,
            'sujet' => $this->sujet,
            'description' => $this->description,
            'statut' => $this->statut,
            'reponse_admin' => $this->reponse_admin,
            'traite_par' => $this->traite_par,
            'traite_le' => self::iso($this->traite_le),
            'created_at' => self::iso($this->created_at),
            'declarant' => self::miniUser($this->declarant, ['id', 'nom', 'role']),
            'cible' => self::miniUser($this->cible, ['id', 'nom', 'role']),
            'rendez_vous' => $rdv ? [
                'id' => $rdv->id,
                'date' => self::ymd($rdv->date),
                'categorie' => $rdv->categorie?->summary(),
            ] : null,
        ];
    }
}
