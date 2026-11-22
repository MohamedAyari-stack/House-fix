<?php

namespace App\Http\Resources;

use App\Models\CategorieService;
use App\Services\Tva;
use Illuminate\Http\Request;

/** @mixin CategorieService */
class CategorieResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            // In the request's language (Accept-Language), French when no translation exists.
            'nom' => $this->localizedNom(),
            'description' => $this->localizedDescription(),
            // Every language, for the admin form.
            'nom_fr' => $this->nom,
            'nom_ar' => $this->nom_ar,
            'nom_en' => $this->nom_en,
            'description_fr' => $this->description,
            'description_ar' => $this->description_ar,
            'description_en' => $this->description_en,
            'icone' => $this->icone,
            // null = the default rate applies; taux_tva = the rate actually applied to invoices.
            'taux_tva_id' => $this->taux_tva_id,
            'taux_tva' => Tva::tauxPour($this->resource),
            'prestataires_count' => (int) ($this->prestataires_count ?? 0),
        ];
    }
}
