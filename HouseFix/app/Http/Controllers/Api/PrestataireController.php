<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PrestataireCardResource;
use App\Http\Resources\UserResource;
use App\Models\CategorieService;
use App\Models\User;
use App\Services\AiRecommender;
use App\Services\PrestataireRecommande;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Collection;

class PrestataireController extends Controller
{
    private const DISTANCE_MAX_KM = 50;

    private const DEFAULT_NOTE = 3;

    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'categorie_id' => ['nullable', 'integer'],
            'min_note' => ['nullable', 'numeric', 'between:0,5'],
            'max_tarif' => ['nullable', 'numeric', 'min:0'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
            'sort' => ['nullable', 'in:recommande,note,prix,distance'],
        ]);

        $query = $this->baseQuery();

        if ($q = trim((string) $request->query('q', ''))) {
            $like = '%'.$q.'%';
            $query->where(fn (Builder $w) => $w
                ->where('nom', 'like', $like)
                ->orWhereHas('prestataireProfile', fn (Builder $p) => $p
                    ->where('specialite', 'like', $like)
                    ->orWhere('description', 'like', $like)
                    ->orWhereHas('categorie', fn (Builder $c) => $c->where('nom', 'like', $like)->orWhere('nom_ar', 'like', $like)->orWhere('nom_en', 'like', $like))));
        }

        if ($request->filled('categorie_id')) {
            $query->whereHas('prestataireProfile', fn (Builder $p) => $p->where('categorie_service_id', $request->integer('categorie_id')));
        }
        if ($request->filled('gouvernorat')) {
            $query->where('gouvernorat', $request->query('gouvernorat'));
        }
        if ($request->filled('min_note')) {
            $query->whereHas('prestataireProfile', fn (Builder $p) => $p->where('note_moyenne', '>=', (float) $request->query('min_note')));
        }
        if ($request->filled('max_tarif')) {
            $query->whereHas('prestataireProfile', fn (Builder $p) => $p->where('tarif_horaire', '<=', (float) $request->query('max_tarif')));
        }
        if ($request->boolean('disponible')) {
            $query->whereHas('prestataireProfile', fn (Builder $p) => $p->where('is_available', true));
        }

        $results = $this->rank($query->get(), $request);

        $results = match ($request->query('sort', 'recommande')) {
            'note' => $results->sortBy([
                fn ($a, $b) => $b->prestataireProfile->note_moyenne <=> $a->prestataireProfile->note_moyenne,
                fn ($a, $b) => $b->prestataireProfile->nb_avis <=> $a->prestataireProfile->nb_avis,
            ]),
            'prix' => $results->sortBy(fn (User $u) => $u->prestataireProfile->tarif_horaire),
            'distance' => $results->sortBy(fn (User $u) => $u->sort_distance),
            default => $results->sortByDesc('score'),
        };

        return PrestataireCardResource::collection(self::recommandesDabord($results));
    }

    /**
     * Ranked by the AI service (ai-recommendation-service) with the reasons of each recommendation;
     * falls back to the local formula when the service is unavailable.
     */
    public function recommandations(Request $request, AiRecommender $ai): AnonymousResourceCollection
    {
        $request->validate([
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
            'categorie_id' => ['nullable', 'integer'],
            'besoin' => ['nullable', 'string', 'max:300'],
        ]);

        $query = $this->baseQuery();

        if ($request->filled('categorie_id')) {
            $query->whereHas('prestataireProfile', fn (Builder $p) => $p->where('categorie_service_id', $request->integer('categorie_id')));
        }

        // The local ranking also sets distance_km and is_recommended. Only prestataires meeting the three
        // conditions (≤ 8 km, ≥ 10 accepted appointments, 5/5) are recommended; the list may be empty.
        $prestataires = $this->rank($query->get(), $request)->filter(fn (User $u) => $u->is_recommended)->values();
        if ($prestataires->isEmpty()) {
            return PrestataireCardResource::collection(collect());
        }

        // Invalid UTF-8 (badly encoded client) would make the JSON for the AI service fail: replace bad bytes.
        $besoin = $request->filled('besoin') ? mb_scrub((string) $request->query('besoin'), 'UTF-8') : null;

        $result = $ai->recommend(
            $request->user(),
            $prestataires,
            $besoin,
            $request->filled('categorie_id') ? CategorieService::find($request->integer('categorie_id'))?->nom : null,
            $request->filled('lat') ? (float) $request->query('lat') : null,
            $request->filled('lng') ? (float) $request->query('lng') : null,
        );

        if ($result === null) {
            return PrestataireCardResource::collection($prestataires->sortByDesc('score')->take(6)->values());
        }

        $byId = $prestataires->keyBy('id');
        $ranked = $result['items']
            ->filter(fn (array $item) => $byId->has($item['id']))
            ->map(function (array $item) use ($byId, $result) {
                $u = $byId[$item['id']];
                $u->score = round($item['score'], 3);
                $u->distance_km = $item['distance_km'] ?? $u->distance_km;
                $u->raisons = $item['raisons'];
                $u->source = 'ia';
                $u->modele = $result['model'];

                return $u;
            })->values();

        return PrestataireCardResource::collection($ranked);
    }

    public function show(Request $request, int $id): UserResource
    {
        $user = User::where('role', User::ROLE_PRESTATAIRE)
            ->with(['prestataireProfile.categorie', 'evaluationsRecues' => fn ($q) => $q->with('client', 'prestataire')->latest()])
            ->findOrFail($id);

        // Only admins may see prestataires that are not publicly listed.
        $public = $user->prestataireProfile?->validation_status === 'valide' && ! $user->is_blocked;
        abort_unless($public || $request->user()->isAdmin(), 404, __('Prestataire introuvable.'));

        // Badge relative to the viewer's position (?lat&lng, otherwise the address of their account).
        $request->validate(['lat' => ['nullable', 'numeric', 'between:-90,90'], 'lng' => ['nullable', 'numeric', 'between:-180,180']]);
        [$lat, $lng] = $this->position($request);
        $user->distance_exact = PrestataireRecommande::distance($lat, $lng, $user);
        $user->distance_km = $user->distance_exact;
        PrestataireRecommande::appliquer(collect([$user]));

        return new UserResource($user);
    }

    /** Validated, non-blocked prestataires. */
    private function baseQuery(): Builder
    {
        return User::query()
            ->where('role', User::ROLE_PRESTATAIRE)
            ->where('is_blocked', false)
            ->whereHas('prestataireProfile', fn (Builder $p) => $p->where('validation_status', 'valide'))
            ->with('prestataireProfile.categorie');
    }

    /**
     * Sets distance_km, score and sort_distance on each prestataire.
     * score = 0.5·(note/5) + 0.3·(1 − min(distance,50)/50) + 0.2·(1 − tarif/tarifMax)
     */
    private function rank(Collection $prestataires, Request $request): Collection
    {
        $client = $request->user();
        [$lat, $lng] = $this->position($request);
        $tarifMax = (float) $prestataires->max(fn (User $u) => $u->prestataireProfile->tarif_horaire);

        $prestataires->each(function (User $u) use ($lat, $lng, $tarifMax, $client) {
            $profile = $u->prestataireProfile;

            $exact = ($lat !== null && $lng !== null && $u->latitude !== null && $u->longitude !== null)
                ? PrestataireRecommande::haversine($lat, $lng, $u->latitude, $u->longitude)
                : null;
            $distanceKm = $exact === null ? null : round($exact, 1);

            // Unknown position: same gouvernorat = 0 km, otherwise 50 km.
            $distance = $distanceKm
                ?? (($client?->gouvernorat && $client->gouvernorat === $u->gouvernorat) ? 0 : self::DISTANCE_MAX_KM);

            $note = $profile->nb_avis > 0 ? $profile->note_moyenne : self::DEFAULT_NOTE;
            $tarifTerm = $tarifMax > 0 ? 1 - $profile->tarif_horaire / $tarifMax : 1;

            $score = 0.5 * ($note / 5)
                + 0.3 * (1 - min($distance, self::DISTANCE_MAX_KM) / self::DISTANCE_MAX_KM)
                + 0.2 * $tarifTerm;

            $u->distance_km = $distanceKm;
            $u->distance_exact = $exact;
            $u->sort_distance = $distance;
            $u->score = round(max(0, min(1, $score)), 3);
        });
        PrestataireRecommande::appliquer($prestataires);

        return $prestataires;
    }

    /** Position of the viewer: ?lat&lng (GPS of the browser), otherwise the address saved on their account. */
    private function position(Request $request): array
    {
        $user = $request->user();

        return [
            $request->filled('lat') ? (float) $request->query('lat') : ($user?->latitude !== null ? (float) $user->latitude : null),
            $request->filled('lng') ? (float) $request->query('lng') : ($user?->longitude !== null ? (float) $user->longitude : null),
        ];
    }

    /** Recommended prestataires come first; the chosen order is kept within each group (stable sort). */
    private static function recommandesDabord(Collection $prestataires): Collection
    {
        return $prestataires->values()->sortByDesc(fn (User $u) => (int) $u->is_recommended)->values();
    }
}
