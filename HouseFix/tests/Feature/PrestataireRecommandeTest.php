<?php

namespace Tests\Feature;

use App\Models\CategorieService;
use App\Models\RendezVous;
use App\Models\User;
use App\Services\PrestataireRecommande;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PrestataireRecommandeTest extends TestCase
{
    use RefreshDatabase;

    private CategorieService $categorie;

    private User $client;

    protected function setUp(): void
    {
        parent::setUp();
        $this->categorie = CategorieService::factory()->create();
        // Client in the centre of Tunis.
        $this->client = User::factory()->client()->create(['latitude' => 36.8065, 'longitude' => 10.1815]);
    }

    /** A validated prestataire at ~$km north of the client, with $rdv accepted appointments and the given rating. */
    private function prestataire(float $km, int $rdv, float $note, int $nbAvis = 3, string $nom = 'Presta'): User
    {
        $p = User::factory()->prestataire('valide', [
            'categorie_service_id' => $this->categorie->id, 'note_moyenne' => $note, 'nb_avis' => $nbAvis,
        ])->create(['nom' => $nom, 'latitude' => 36.8065 + $km / 111.2, 'longitude' => 10.1815]);

        for ($i = 0; $i < $rdv; $i++) {
            RendezVous::create([
                'client_id' => $this->client->id, 'prestataire_id' => $p->id, 'categorie_service_id' => $this->categorie->id,
                'date' => now()->subDays($i + 1)->toDateString(), 'address' => 'Tunis', 'description' => 'Test',
                'status' => ['accepte', 'termine', 'facture'][$i % 3],
            ]);
        }

        return $p;
    }

    public function test_the_three_conditions_must_all_hold(): void
    {
        $this->assertTrue(PrestataireRecommande::estRecommande(8.0, 10, 5.0, 1));
        $this->assertFalse(PrestataireRecommande::estRecommande(8.01, 10, 5.0, 1));   // too far
        $this->assertFalse(PrestataireRecommande::estRecommande(2.0, 9, 5.0, 1));     // not enough appointments
        $this->assertFalse(PrestataireRecommande::estRecommande(2.0, 50, 4.9, 20));   // not 5/5
        $this->assertFalse(PrestataireRecommande::estRecommande(2.0, 50, 5.0, 0));    // no review at all
        $this->assertFalse(PrestataireRecommande::estRecommande(null, 50, 5.0, 20));  // unknown position
    }

    public function test_haversine_distance(): void
    {
        // Tunis -> Sousse: about 116 km in a straight line.
        $this->assertEqualsWithDelta(116, PrestataireRecommande::haversine(36.8065, 10.1815, 35.8256, 10.6084), 3);
    }

    public function test_search_flags_and_lists_recommended_prestataires_first(): void
    {
        $this->prestataire(15, 12, 5.0, nom: 'Trop Loin');
        $this->prestataire(3, 9, 5.0, nom: 'Pas Assez');
        $this->prestataire(2, 12, 4.8, nom: 'Note Basse');
        $this->prestataire(5, 10, 5.0, nom: 'Recommande');

        Sanctum::actingAs($this->client);
        $res = $this->getJson('/api/prestataires?sort=prix')->assertOk();

        $this->assertSame('Recommande', $res->json('0.nom'));
        $this->assertTrue($res->json('0.is_recommended'));
        $this->assertSame(10, $res->json('0.rdv_acceptes'));
        $this->assertSame(['Recommande'], collect($res->json())->where('is_recommended', true)->pluck('nom')->all());
    }

    public function test_refused_or_cancelled_appointments_do_not_count(): void
    {
        $p = $this->prestataire(1, 9, 5.0);
        foreach (['refuse', 'annule_par_client', 'en_attente'] as $status) {
            RendezVous::create([
                'client_id' => $this->client->id, 'prestataire_id' => $p->id, 'categorie_service_id' => $this->categorie->id,
                'date' => now()->toDateString(), 'address' => 'Tunis', 'description' => 'Test', 'status' => $status,
            ]);
        }

        Sanctum::actingAs($this->client);
        $this->getJson("/api/prestataires/{$p->id}")->assertOk()
            ->assertJsonPath('rdv_acceptes', 9)
            ->assertJsonPath('is_recommended', false);

        // One more accepted appointment: the badge appears without any manual update.
        RendezVous::create([
            'client_id' => $this->client->id, 'prestataire_id' => $p->id, 'categorie_service_id' => $this->categorie->id,
            'date' => now()->toDateString(), 'address' => 'Tunis', 'description' => 'Test', 'status' => 'accepte',
        ]);
        $this->getJson("/api/prestataires/{$p->id}")->assertOk()->assertJsonPath('is_recommended', true);
    }

    public function test_badge_depends_on_the_viewer_position(): void
    {
        $p = $this->prestataire(4, 10, 5.0);
        Sanctum::actingAs($this->client);

        $this->getJson("/api/prestataires/{$p->id}")->assertJsonPath('is_recommended', true);
        // Seen from Sousse (GPS of the browser): far away, no badge.
        $this->getJson("/api/prestataires/{$p->id}?lat=35.8256&lng=10.6084")->assertJsonPath('is_recommended', false);

        // A client without any saved position never sees the badge.
        Sanctum::actingAs(User::factory()->client()->create(['latitude' => null, 'longitude' => null]));
        $this->getJson("/api/prestataires/{$p->id}")->assertJsonPath('is_recommended', false);
    }

    public function test_recommendations_endpoint_only_returns_recommended_prestataires(): void
    {
        $this->prestataire(1, 0, 0, 0, 'Proche Nouveau');
        $this->prestataire(2, 9, 5.0, nom: 'Presque');

        Sanctum::actingAs($this->client);
        // Nobody meets the three conditions: nothing is recommended.
        $this->getJson('/api/prestataires/recommandations')->assertOk()->assertJsonCount(0);

        $this->prestataire(6, 11, 5.0, nom: 'Recommande');
        $this->getJson('/api/prestataires/recommandations')->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.nom', 'Recommande')
            ->assertJsonPath('0.is_recommended', true);
    }
}
