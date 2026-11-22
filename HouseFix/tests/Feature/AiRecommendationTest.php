<?php

namespace Tests\Feature;

use App\Models\CategorieService;
use App\Models\Evaluation;
use App\Models\RendezVous;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AiRecommendationTest extends TestCase
{
    use RefreshDatabase;

    private User $client;

    private User $a;

    private User $b;

    protected function setUp(): void
    {
        parent::setUp();
        $plomberie = CategorieService::factory()->create(['nom' => 'Plomberie', 'nom_ar' => 'سباكة', 'nom_en' => 'Plumbing']);
        // Only recommended prestataires are returned (≤ 8 km, ≥ 10 accepted appointments, 5/5): both qualify.
        // Same rate and rating: only the distance separates them (a at ~1 km, b at ~5 km) in the local ranking.
        $this->a = User::factory()->prestataire('valide', ['categorie_service_id' => $plomberie->id, 'note_moyenne' => 5, 'nb_avis' => 30, 'tarif_horaire' => 40])
            ->create(['gouvernorat' => 'Tunis', 'latitude' => 36.8065 + 1 / 111.2, 'longitude' => 10.1815]);
        $this->b = User::factory()->prestataire('valide', ['categorie_service_id' => $plomberie->id, 'note_moyenne' => 5, 'nb_avis' => 2, 'tarif_horaire' => 40])
            ->create(['gouvernorat' => 'Tunis', 'latitude' => 36.8065 + 5 / 111.2, 'longitude' => 10.1815]);
        $this->client = User::factory()->client()->create(['gouvernorat' => 'Tunis', 'latitude' => 36.8065, 'longitude' => 10.1815]);
        // Ten accepted appointments each, with another client (the tested client's history stays empty).
        $autre = User::factory()->client()->create();
        foreach ([$this->a, $this->b] as $p) {
            for ($i = 0; $i < 10; $i++) {
                RendezVous::create([
                    'client_id' => $autre->id, 'prestataire_id' => $p->id, 'categorie_service_id' => $plomberie->id,
                    'date' => now()->subDays($i + 1)->toDateString(), 'address' => 'Tunis', 'description' => 'Historique', 'status' => 'termine',
                ]);
            }
        }
        Sanctum::actingAs($this->client);
    }

    private function url(string $path): string
    {
        return rtrim(config('services.ai_reco.url'), '/').$path;
    }

    public function test_the_ai_order_and_reasons_are_returned(): void
    {
        // The service prefers b (e.g. because of the need text) and explains why.
        Http::fake([$this->url('/recommend') => Http::response([
            'model' => 'expert',
            'recommendations' => [
                ['id' => $this->b->id, 'score' => 0.91, 'distance_km' => 2.4, 'raisons' => ['Correspond à votre besoin', 'À 2,4 km de chez vous'], 'features' => []],
                ['id' => $this->a->id, 'score' => 0.62, 'distance_km' => null, 'raisons' => ['Très bien noté : 4,9/5 (30 avis)'], 'features' => []],
            ],
        ])]);

        $this->getJson('/api/prestataires/recommandations?besoin='.urlencode('fuite sous l\'évier'))
            ->assertOk()
            ->assertJsonPath('0.id', $this->b->id)
            ->assertJsonPath('0.source', 'ia')
            ->assertJsonPath('0.score', 0.91)
            ->assertJsonPath('0.distance_km', 2.4)
            ->assertJsonPath('0.raisons.0', 'Correspond à votre besoin')
            ->assertJsonPath('1.id', $this->a->id);

        Http::assertSent(fn (Request $r) => $r['besoin'] === "fuite sous l'évier"
            && count($r['candidates']) === 2
            && isset($r['candidates'][0]['stats']['termines'])
            && $r['client']['gouvernorat'] === 'Tunis'
            && $r['langue'] === 'fr');
    }

    public function test_reasons_are_requested_in_the_app_language_with_french_categories(): void
    {
        Http::fake([$this->url('/recommend') => Http::response(['model' => 'expert', 'recommendations' => []])]);

        $this->getJson('/api/prestataires/recommandations', ['Accept-Language' => 'ar'])->assertOk();

        // The categories stay in French for the service's text matching; only the reasons change language.
        Http::assertSent(fn (Request $r) => $r['langue'] === 'ar'
            && $r['candidates'][0]['categorie'] === 'Plomberie');
    }

    public function test_a_badly_encoded_need_still_reaches_the_service(): void
    {
        Http::fake([$this->url('/recommend') => Http::response(['model' => 'expert', 'recommendations' => []])]);

        // "porte bloquée" sent in Latin-1 instead of UTF-8.
        $this->getJson('/api/prestataires/recommandations?besoin=porte%20bloqu%E9e')->assertOk();

        Http::assertSent(fn (Request $r) => mb_check_encoding($r['besoin'], 'UTF-8') && str_starts_with($r['besoin'], 'porte bloqu'));
    }

    public function test_the_clients_history_is_sent_to_the_service(): void
    {
        $rdv = RendezVous::factory()->status('termine')->create(['client_id' => $this->client->id, 'prestataire_id' => $this->a->id]);
        Evaluation::create(['rendez_vous_id' => $rdv->id, 'client_id' => $this->client->id, 'prestataire_id' => $this->a->id, 'note' => 5]);
        Http::fake([$this->url('/recommend') => Http::response(['model' => 'expert', 'recommendations' => []])]);

        $this->getJson('/api/prestataires/recommandations')->assertOk();

        Http::assertSent(fn (Request $r) => $r['client']['historique'] === [
            ['prestataire_id' => $this->a->id, 'categorie' => $rdv->categorie->nom, 'note' => 5],
        ]);
    }

    public function test_the_local_formula_is_used_when_the_service_is_down(): void
    {
        Http::fake([$this->url('/*') => Http::response('Service Unavailable', 503)]);

        $this->getJson('/api/prestataires/recommandations')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.id', $this->a->id) // best rated first with the local formula
            ->assertJsonPath('0.source', 'local')
            ->assertJsonPath('0.raisons', []);
    }

    public function test_reco_train_sends_labelled_history(): void
    {
        RendezVous::where('description', 'Historique')->delete(); // only the appointments below
        RendezVous::factory()->status('termine')->create(['prestataire_id' => $this->a->id]);
        RendezVous::factory()->status('refuse')->create(['prestataire_id' => $this->b->id]);
        RendezVous::factory()->status('en_attente')->create(['prestataire_id' => $this->b->id]); // not finished: ignored
        Http::fake([$this->url('/train') => Http::response([
            'model' => 'expert', 'trained' => false, 'samples' => 2,
            'message' => 'Historique insuffisant', 'weights' => ['qualite' => 2.5], 'accuracy' => null,
        ])]);

        $this->artisan('reco:train')->expectsOutputToContain('Historique insuffisant')->assertSuccessful();

        Http::assertSent(function (Request $r) {
            $labels = collect($r['samples'])->mapWithKeys(fn ($s) => [$s['candidate']['id'] => $s['label']]);

            return count($r['samples']) === 2 && $labels[$this->a->id] === 1 && $labels[$this->b->id] === 0;
        });
    }
}
