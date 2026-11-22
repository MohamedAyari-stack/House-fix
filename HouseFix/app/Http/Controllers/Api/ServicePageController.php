<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CategorieService;
use App\Models\Evaluation;
use App\Models\RendezVous;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Public service pages (/services and /services/{slug}), also meant for search engines.
 * Only public data: no email, phone or address; reviewers are shown as "First name + initial".
 */
class ServicePageController extends Controller
{
    private const MAX_PRESTATAIRES = 12;

    private const MAX_AVIS = 6;

    /** Every service with its number of providers, starting rate and average rating. */
    public function index(): JsonResponse
    {
        $services = CategorieService::orderBy('nom')->get()->map(function (CategorieService $c) {
            $profiles = $this->prestataires($c)->get()->pluck('prestataireProfile');
            $tarifs = $profiles->pluck('tarif_horaire')->filter(fn ($t) => $t > 0);

            return [
                ...$this->summary($c),
                'description' => $c->localizedDescription(),
                'prestataires' => $profiles->count(),
                'tarif_min' => $tarifs->isEmpty() ? null : (float) $tarifs->min(),
                'note_moyenne' => $this->averageRating($profiles),
            ];
        });

        return response()->json($services);
    }

    /** One service, optionally narrowed to a governorate ("Plombier à Sousse"). */
    public function show(Request $request, string $slug): JsonResponse
    {
        $request->validate(['gouvernorat' => ['nullable', Rule::in(User::GOUVERNORATS)]]);
        $categorie = CategorieService::where('slug', $slug)->first();
        abort_if(! $categorie, 404, __('Ce service n\'existe pas.'));
        $gouvernorat = $request->query('gouvernorat');

        $all = $this->prestataires($categorie)->get();
        $here = $gouvernorat ? $all->where('gouvernorat', $gouvernorat)->values() : $all;
        $profiles = $here->pluck('prestataireProfile');
        $tarifs = $profiles->pluck('tarif_horaire')->filter(fn ($t) => $t > 0)->sort()->values();

        $avis = Evaluation::with('client')
            ->whereIn('prestataire_id', $here->pluck('id'))
            ->where('note', '>=', 4)
            ->whereNotNull('commentaire')
            ->where('commentaire', '!=', '')
            ->latest()
            ->take(self::MAX_AVIS)
            ->get()
            ->map(fn (Evaluation $e) => [
                'note' => $e->note,
                'commentaire' => $e->commentaire,
                'auteur' => User::publicName($e->client?->nom),
                'gouvernorat' => $e->client?->gouvernorat,
                'date' => $e->created_at?->toDateString(),
            ]);

        return response()->json([
            'service' => [
                ...$this->summary($categorie),
                'description' => $categorie->localizedDescription(),
            ],
            'gouvernorat' => $gouvernorat,
            'stats' => [
                'prestataires' => $here->count(),
                'disponibles' => $profiles->where('is_available', true)->count(),
                'note_moyenne' => $this->averageRating($profiles),
                'avis' => (int) $profiles->sum('nb_avis'),
                'interventions' => RendezVous::where('categorie_service_id', $categorie->id)
                    ->whereIn('status', ['termine', 'facture'])
                    ->when($gouvernorat, fn (Builder $q) => $q->whereHas('prestataire', fn (Builder $p) => $p->where('gouvernorat', $gouvernorat)))
                    ->count(),
                'tarif_min' => $tarifs->isEmpty() ? null : (float) $tarifs->first(),
                'tarif_median' => $tarifs->isEmpty() ? null : (float) $tarifs->median(),
                'tarif_max' => $tarifs->isEmpty() ? null : (float) $tarifs->last(),
            ],
            // Every governorate where the service exists (links "Plombier à Sousse"), even when filtered.
            'gouvernorats' => $all->countBy('gouvernorat')->sortDesc()->map(fn ($n, $g) => ['nom' => $g, 'prestataires' => $n])->values(),
            'prestataires' => $here
                ->sortByDesc(fn (User $u) => [(float) $u->prestataireProfile->note_moyenne, (int) $u->prestataireProfile->nb_avis])
                ->take(self::MAX_PRESTATAIRES)
                ->values()
                ->map(fn (User $u) => [
                    'id' => $u->id,
                    'nom' => $u->nom,
                    'photo_url' => $u->photoUrl(),
                    'gouvernorat' => $u->gouvernorat,
                    'specialite' => $u->prestataireProfile->specialite,
                    'experience_annees' => (int) $u->prestataireProfile->experience_annees,
                    'tarif_horaire' => (float) $u->prestataireProfile->tarif_horaire,
                    'note_moyenne' => (float) $u->prestataireProfile->note_moyenne,
                    'nb_avis' => (int) $u->prestataireProfile->nb_avis,
                    'disponible' => (bool) $u->prestataireProfile->is_available,
                ]),
            'avis' => $avis,
            'autres_services' => CategorieService::whereKeyNot($categorie->id)->orderBy('nom')->get()->map(fn ($c) => $this->summary($c)),
        ]);
    }

    /** Validated, non-blocked providers of a service, with their profile. */
    private function prestataires(CategorieService $categorie): Builder
    {
        return User::where('role', User::ROLE_PRESTATAIRE)
            ->where('is_blocked', false)
            ->whereHas('prestataireProfile', fn (Builder $p) => $p
                ->where('validation_status', 'valide')
                ->where('categorie_service_id', $categorie->id))
            ->with('prestataireProfile');
    }

    private function summary(CategorieService $c): array
    {
        return ['id' => $c->id, 'slug' => $c->slug, 'nom' => $c->localizedNom(), 'icone' => $c->icone];
    }

    /** Average rating weighted by the number of reviews (a 5/5 with 1 review weighs less than 4.6 with 40). */
    private function averageRating($profiles): ?float
    {
        $reviews = $profiles->sum('nb_avis');

        return $reviews ? round($profiles->sum(fn ($p) => $p->note_moyenne * $p->nb_avis) / $reviews, 1) : null;
    }
}
