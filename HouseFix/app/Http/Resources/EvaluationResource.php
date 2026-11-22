<?php

namespace App\Http\Resources;

use App\Models\Evaluation;
use Illuminate\Http\Request;

/** @mixin Evaluation */
class EvaluationResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'rendez_vous_id' => $this->rendez_vous_id,
            'client_id' => $this->client_id,
            'prestataire_id' => $this->prestataire_id,
            'note' => (int) $this->note,
            'commentaire' => $this->commentaire,
            'reponse' => $this->reponse,
            'created_at' => self::iso($this->created_at),
            'client' => self::miniUser($this->client),
            'prestataire' => self::miniUser($this->prestataire),
        ];
    }
}
