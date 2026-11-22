<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TauxTva;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** VAT rates: readable by everyone (the invoice form shows them), managed by the admin. */
class TauxTvaController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(TauxTva::withCount('categories')->orderByDesc('taux')->get()->map(fn (TauxTva $t) => $this->present($t)));
    }

    public function store(Request $request): JsonResponse
    {
        $taux = DB::transaction(fn () => $this->save(new TauxTva, $this->validated($request)));

        return response()->json($this->present($taux->loadCount('categories')), 201);
    }

    public function update(Request $request, TauxTva $tauxTva): JsonResponse
    {
        $data = $this->validated($request);
        if ($tauxTva->par_defaut && ! $data['par_defaut']) {
            return response()->json(['message' => __('Choisissez un autre taux par défaut avant de retirer celui-ci.')], 422);
        }
        // Issued invoices keep their own copy of the rate: changing it only affects future invoices.
        DB::transaction(fn () => $this->save($tauxTva, $data));

        return response()->json($this->present($tauxTva->loadCount('categories')));
    }

    public function destroy(TauxTva $tauxTva): JsonResponse
    {
        if ($tauxTva->par_defaut) {
            return response()->json(['message' => __('Le taux par défaut ne peut pas être supprimé.')], 409);
        }
        // Its services fall back to the default rate (foreign key: null on delete).
        $tauxTva->delete();

        return response()->json(['message' => __('Taux de TVA supprimé.')]);
    }

    private function save(TauxTva $taux, array $data): TauxTva
    {
        if ($data['par_defaut']) {
            TauxTva::where('par_defaut', true)->whereKeyNot($taux->getKey())->update(['par_defaut' => false]);
        }
        $taux->fill($data)->save();

        return $taux;
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'libelle' => ['required', 'string', 'max:100'],
            'taux' => ['required', 'numeric', 'min:0', 'max:100'],
            'par_defaut' => ['sometimes', 'boolean'],
        ], [
            'taux.max' => __('Le taux doit être compris entre 0 et 100 %.'),
            'taux.min' => __('Le taux doit être compris entre 0 et 100 %.'),
        ]);

        return $data + ['par_defaut' => false];
    }

    private function present(TauxTva $t): array
    {
        return [
            'id' => $t->id,
            'libelle' => $t->libelle,
            'taux' => (float) $t->taux,
            'par_defaut' => $t->par_defaut,
            'categories_count' => (int) ($t->categories_count ?? 0),
        ];
    }
}
