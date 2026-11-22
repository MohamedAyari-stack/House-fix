<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/**
 * A prestataire User plus the search-computed distance_km and score
 * (set as plain attributes on the model by PrestataireController).
 */
class PrestataireCardResource extends UserResource
{
    public function toArray(Request $request): array
    {
        return parent::toArray($request) + [
            'distance_km' => $this->resource->distance_km,
            'score' => $this->resource->score,
            // Distance ≤ 8 km, ≥ 10 accepted appointments and 5/5 (App\Services\PrestataireRecommande).
            'is_recommended' => (bool) ($this->resource->is_recommended ?? false),
            'rdv_acceptes' => (int) ($this->resource->rdv_acceptes ?? 0),
            // Set by the AI service on /prestataires/recommandations; "local" = fallback formula.
            'raisons' => $this->resource->raisons ?? [],
            'source' => $this->resource->source ?? 'local',
            'modele' => $this->resource->modele ?? null,
        ];
    }
}
