<?php

namespace App\Http\Resources;

use App\Models\RendezVous;
use Illuminate\Http\Request;

/** @mixin RendezVous */
class RendezVousResource extends BaseResource
{
    /** False when embedded inside a Facture (avoids facture → rendez_vous → facture recursion). */
    protected bool $withFacture = true;

    public function withoutFacture(): static
    {
        $this->withFacture = false;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $contact = ['id', 'nom', 'telephone', 'photo_url'];

        $data = [
            'id' => $this->id,
            'client_id' => $this->client_id,
            'prestataire_id' => $this->prestataire_id,
            'categorie_service_id' => $this->categorie_service_id,
            'date' => self::ymd($this->date),
            'heure' => self::hhmm($this->heure),
            'description' => $this->description,
            'address' => $this->address,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'status' => $this->status,
            'motif_refus' => $this->motif_refus,
            'created_at' => self::iso($this->created_at),
            'client' => self::miniUser($this->client, $contact),
            'prestataire' => self::miniUser($this->prestataire, $contact),
            'categorie' => $this->categorie?->summary(),
        ];

        if ($this->withFacture) {
            $data['facture'] = $this->facture ? (new FactureResource($this->facture))->withoutRendezVous() : null;
        }

        $data['evaluation'] = $this->evaluation ? new EvaluationResource($this->evaluation) : null;

        return $data;
    }
}
