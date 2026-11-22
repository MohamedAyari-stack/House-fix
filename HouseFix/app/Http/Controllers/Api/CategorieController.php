<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategorieResource;
use App\Models\CategorieService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class CategorieController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $categories = CategorieService::with('tauxTva')->withCount(['prestataires' => fn ($q) => $q->where('validation_status', 'valide')])
            ->orderBy('nom')
            ->get()
            // Alphabetical in the language they are displayed in.
            ->sortBy(fn (CategorieService $c) => $c->localizedNom())
            ->values();

        return CategorieResource::collection($categories);
    }

    public function store(Request $request): JsonResponse
    {
        $categorie = CategorieService::create($this->validated($request));
        $categorie->prestataires_count = 0;

        return (new CategorieResource($categorie))->response()->setStatusCode(201);
    }

    public function update(Request $request, CategorieService $categorie): CategorieResource
    {
        $categorie->update($this->validated($request, $categorie));
        $categorie->loadCount(['prestataires' => fn ($q) => $q->where('validation_status', 'valide')]);

        return new CategorieResource($categorie);
    }

    public function destroy(CategorieService $categorie): JsonResponse
    {
        if ($categorie->prestataires()->exists()) {
            return response()->json([
                'message' => __('Impossible de supprimer cette catégorie : des prestataires y sont rattachés.'),
            ], 409);
        }

        $categorie->delete();

        return response()->json(['message' => __('Catégorie supprimée.')]);
    }

    private function validated(Request $request, ?CategorieService $categorie = null): array
    {
        return $request->validate([
            'nom' => ['required', 'string', 'max:100', Rule::unique('categories_services', 'nom')->ignore($categorie?->id)],
            'nom_ar' => ['nullable', 'string', 'max:100', Rule::unique('categories_services', 'nom_ar')->ignore($categorie?->id)],
            'nom_en' => ['nullable', 'string', 'max:100', Rule::unique('categories_services', 'nom_en')->ignore($categorie?->id)],
            'description' => ['nullable', 'string', 'max:1000'],
            'description_ar' => ['nullable', 'string', 'max:1000'],
            'description_en' => ['nullable', 'string', 'max:1000'],
            'icone' => ['nullable', 'string', 'max:100'],
            'taux_tva_id' => ['nullable', 'integer', 'exists:taux_tva,id'],
        ], [
            'nom.unique' => __('Une catégorie porte déjà ce nom.'),
            'nom_ar.unique' => __('Une catégorie porte déjà ce nom.'),
            'nom_en.unique' => __('Une catégorie porte déjà ce nom.'),
        ]);
    }
}
