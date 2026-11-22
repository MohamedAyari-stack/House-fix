<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategorieResource;
use App\Models\CategorieService;
use App\Models\Evaluation;
use App\Models\RendezVous;
use App\Models\User;
use Illuminate\Http\JsonResponse;

/**
 * Public landing page data. Only non-sensitive fields: no email, phone or address,
 * and reviewers are shown as "First name + initial".
 */
class AccueilController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $prestataires = User::query()
            ->where('role', User::ROLE_PRESTATAIRE)
            ->where('is_blocked', false)
            ->whereHas('prestataireProfile', fn ($p) => $p->where('validation_status', 'valide'));

        $top = (clone $prestataires)
            ->with('prestataireProfile.categorie')
            ->get()
            ->sortByDesc(fn (User $u) => [$u->prestataireProfile->note_moyenne, $u->prestataireProfile->nb_avis])
            ->take(4)
            ->values()
            ->map(fn (User $u) => [
                'id' => $u->id,
                'nom' => $u->nom,
                'photo_url' => $u->photoUrl(),
                'gouvernorat' => $u->gouvernorat,
                'categorie' => $u->prestataireProfile->categorie?->localizedNom(),
                'specialite' => $u->prestataireProfile->specialite,
                'experience_annees' => (int) $u->prestataireProfile->experience_annees,
                'tarif_horaire' => (float) $u->prestataireProfile->tarif_horaire,
                'note_moyenne' => (float) $u->prestataireProfile->note_moyenne,
                'nb_avis' => (int) $u->prestataireProfile->nb_avis,
            ]);

        $avis = Evaluation::with(['client', 'prestataire.prestataireProfile.categorie'])
            ->where('note', '>=', 4)
            ->whereNotNull('commentaire')
            ->where('commentaire', '!=', '')
            ->latest()
            ->take(3)
            ->get()
            ->map(fn (Evaluation $e) => [
                'note' => $e->note,
                'commentaire' => $e->commentaire,
                'auteur' => User::publicName($e->client?->nom),
                'gouvernorat' => $e->client?->gouvernorat,
                'categorie' => $e->prestataire?->prestataireProfile?->categorie?->localizedNom(),
            ]);

        $categories = CategorieService::withCount(['prestataires' => fn ($q) => $q->where('validation_status', 'valide')])
            ->orderByDesc('prestataires_count')
            ->orderBy('nom')
            ->get();

        return response()->json([
            'stats' => [
                'prestataires' => (clone $prestataires)->count(),
                'interventions' => RendezVous::whereIn('status', ['termine', 'facture'])->count(),
                'note_moyenne' => round((float) Evaluation::avg('note'), 1),
                'avis' => Evaluation::count(),
                'gouvernorats' => (clone $prestataires)->distinct()->count('gouvernorat'),
            ],
            'categories' => CategorieResource::collection($categories),
            'top_prestataires' => $top,
            'avis' => $avis,
        ]);
    }

}
