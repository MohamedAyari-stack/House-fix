<?php

namespace App\Services;

use App\Models\PrestataireProfile;
use App\Models\RendezVous;
use App\Models\User;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Client of the Python AI recommendation service (ai-recommendation-service/).
 * Laravel sends the candidates and the client's context; the service ranks them and
 * explains each recommendation. Any failure returns null so the caller can fall back
 * to the local formula: the app never depends on the service being up.
 */
class AiRecommender
{
    /** Rendez-vous statuses that count as a finished job. */
    private const DONE = ['termine', 'facture'];

    /**
     * @param  Collection<int, User>  $prestataires  validated prestataires with prestataireProfile.categorie loaded
     * @return array{model: string, items: Collection<int, array{id: int, score: float, distance_km: ?float, raisons: list<string>}>}|null
     */
    public function recommend(?User $client, Collection $prestataires, ?string $besoin, ?string $categorie, ?float $lat, ?float $lng, int $topK = 6): ?array
    {
        if ($prestataires->isEmpty()) {
            return null;
        }

        $stats = $this->stats($prestataires->pluck('id'));

        try {
            $response = $this->http()->post('/recommend', [
                'client' => $this->clientContext($client, $lat, $lng),
                'besoin' => $besoin,
                'categorie' => $categorie,
                'candidates' => $prestataires->map(fn (User $u) => $this->candidate($u, $stats[$u->id] ?? null))->values()->all(),
                'top_k' => $topK,
                // Language of the "raisons" returned (categories stay in French for the text matching).
                'langue' => app()->getLocale(),
            ])->throw()->json();
        } catch (Throwable $e) {
            report($e);

            return null;
        }

        return [
            'model' => $response['model'] ?? 'expert',
            'items' => collect($response['recommendations'] ?? []),
        ];
    }

    /**
     * Sends the history of finished rendez-vous to /train. A job is a success (1) when it was carried
     * through without a bad rating, a failure (0) when it was refused or rated 2/5 or less.
     *
     * @return array<string, mixed>|null the service's answer, or null when it is unreachable
     */
    public function train(): ?array
    {
        $rdvs = RendezVous::with(['client', 'prestataire.prestataireProfile.categorie', 'evaluation', 'categorie'])
            ->whereIn('status', [...self::DONE, 'refuse'])
            ->get();

        $stats = $this->stats($rdvs->pluck('prestataire_id')->unique());
        $tarifs = $this->medianRateByCategory();

        $samples = $rdvs->filter(fn (RendezVous $r) => $r->prestataire?->prestataireProfile)
            ->map(function (RendezVous $r) use ($stats, $tarifs) {
                $note = $r->evaluation?->note;
                $success = in_array($r->status, self::DONE, true) && ($note === null || $note >= 3);

                return [
                    'client' => [
                        'gouvernorat' => $r->client?->gouvernorat,
                        'latitude' => $r->latitude ?? $r->client?->latitude,
                        'longitude' => $r->longitude ?? $r->client?->longitude,
                    ],
                    'besoin' => $r->description,
                    'categorie' => $r->categorie?->nom,
                    'candidate' => $this->candidate($r->prestataire, $stats[$r->prestataire_id] ?? null),
                    'tarif_reference' => $tarifs[$r->prestataire->prestataireProfile->categorie_service_id] ?? null,
                    'label' => (int) $success,
                ];
            })->values()->all();

        try {
            return $this->http()->timeout(30)->post('/train', ['samples' => $samples])->throw()->json();
        } catch (Throwable $e) {
            report($e);

            return null;
        }
    }

    /** Health and model information of the service, or null when it is down. */
    public function status(): ?array
    {
        try {
            return $this->http()->get('/health')->throw()->json();
        } catch (Throwable) {
            return null;
        }
    }

    private function http(): PendingRequest
    {
        return Http::baseUrl(config('services.ai_reco.url'))
            ->timeout(config('services.ai_reco.timeout'))
            ->acceptJson()
            ->withHeaders(array_filter(['X-Api-Key' => config('services.ai_reco.key')]));
    }

    private function candidate(User $u, ?array $stats): array
    {
        $p = $u->prestataireProfile;

        return [
            'id' => $u->id,
            'categorie' => $p->categorie?->nom,
            'specialite' => $p->specialite,
            'description' => $p->description,
            'certifications' => $p->certifications,
            'gouvernorat' => $u->gouvernorat,
            'latitude' => $u->latitude,
            'longitude' => $u->longitude,
            'note_moyenne' => (float) $p->note_moyenne,
            'nb_avis' => (int) $p->nb_avis,
            'tarif_horaire' => (float) $p->tarif_horaire,
            'experience_annees' => (int) $p->experience_annees,
            'is_available' => (bool) $p->is_available,
            'stats' => $stats ?? ['termines' => 0, 'refuses' => 0, 'acceptes' => 0],
        ];
    }

    private function clientContext(?User $client, ?float $lat, ?float $lng): array
    {
        $historique = $client
            ? RendezVous::with(['categorie', 'evaluation'])
                ->where('client_id', $client->id)
                ->whereIn('status', self::DONE)
                ->get()
                ->map(fn (RendezVous $r) => [
                    'prestataire_id' => $r->prestataire_id,
                    'categorie' => $r->categorie?->nom,
                    'note' => $r->evaluation?->note,
                ])->values()->all()
            : [];

        return [
            'gouvernorat' => $client?->gouvernorat,
            'latitude' => $lat ?? $client?->latitude,
            'longitude' => $lng ?? $client?->longitude,
            'historique' => $historique,
        ];
    }

    /** @return array<int, array{termines: int, refuses: int, acceptes: int}> keyed by prestataire id */
    private function stats(Collection $prestataireIds): array
    {
        $rows = RendezVous::query()
            ->select('prestataire_id', 'status', DB::raw('count(*) as total'))
            ->whereIn('prestataire_id', $prestataireIds)
            ->groupBy('prestataire_id', 'status')
            ->get();

        $stats = [];
        foreach ($rows as $row) {
            $s = &$stats[$row->prestataire_id];
            $s ??= ['termines' => 0, 'refuses' => 0, 'acceptes' => 0];
            match (true) {
                in_array($row->status, self::DONE, true) => $s['termines'] += $row->total,
                $row->status === 'refuse' => $s['refuses'] += $row->total,
                $row->status === 'accepte' => $s['acceptes'] += $row->total,
                default => null,
            };
            unset($s);
        }

        return $stats;
    }

    /** @return array<int, float> median hourly rate of validated prestataires, keyed by category id */
    private function medianRateByCategory(): array
    {
        return PrestataireProfile::where('validation_status', 'valide')
            ->where('tarif_horaire', '>', 0)
            ->get(['categorie_service_id', 'tarif_horaire'])
            ->groupBy('categorie_service_id')
            ->map(fn (Collection $g) => (float) $g->median('tarif_horaire'))
            ->all();
    }
}
