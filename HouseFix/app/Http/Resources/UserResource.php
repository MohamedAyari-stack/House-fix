<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;

/** @mixin User */
class UserResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nom' => $this->nom,
            'email' => $this->email,
            'telephone' => $this->telephone,
            'gouvernorat' => $this->gouvernorat,
            'locale' => $this->preferredLocale(),
            'role' => $this->role,
            'statut' => $this->statut,
            'is_verified' => (bool) $this->is_verified,
            'is_blocked' => (bool) $this->is_blocked,
            'blocked_until' => self::iso($this->blocked_until),
            'block_motif' => $this->block_motif,
            'photo_url' => $this->photoUrl(),
            'address' => $this->address,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'created_at' => self::iso($this->created_at),
            'prestataire' => $this->isPrestataire() && $this->prestataireProfile
                ? new PrestataireProfileResource($this->prestataireProfile)
                : null,
            // Only present on GET /prestataires/{id}
            'is_recommended' => $this->when(isset($this->resource->is_recommended), fn () => (bool) $this->resource->is_recommended),
            'rdv_acceptes' => $this->when(isset($this->resource->rdv_acceptes), fn () => (int) $this->resource->rdv_acceptes),
            'distance_km' => $this->when(isset($this->resource->is_recommended), fn () => $this->resource->distance_km),
            'evaluations' => EvaluationResource::collection($this->whenLoaded('evaluationsRecues')),
        ];
    }
}
