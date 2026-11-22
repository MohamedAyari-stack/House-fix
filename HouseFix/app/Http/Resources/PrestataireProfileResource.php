<?php

namespace App\Http\Resources;

use App\Models\PrestataireProfile;
use Illuminate\Http\Request;

/** @mixin PrestataireProfile */
class PrestataireProfileResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'categorie_service_id' => $this->categorie_service_id,
            'categorie' => $this->categorie?->summary(),
            'specialite' => $this->specialite,
            'description' => $this->description,
            'experience_annees' => (int) $this->experience_annees,
            'certifications' => $this->certifications,
            'tarif_horaire' => (float) $this->tarif_horaire,
            'is_available' => (bool) $this->is_available,
            'disponibilites' => $this->disponibilites,
            'note_moyenne' => (float) $this->note_moyenne,
            'nb_avis' => (int) $this->nb_avis,
            'validation_status' => $this->validation_status,
        ];
    }
}
