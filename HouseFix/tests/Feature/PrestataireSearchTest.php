<?php

namespace Tests\Feature;

use App\Models\CategorieService;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PrestataireSearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_search_returns_only_validated_non_blocked_prestataires(): void
    {
        $categorie = CategorieService::factory()->create(['nom' => 'Plomberie']);
        $geo = ['gouvernorat' => 'Tunis', 'latitude' => 36.8065, 'longitude' => 10.1815];

        $valide = User::factory()->prestataire('valide', ['categorie_service_id' => $categorie->id])->create($geo + ['nom' => 'Plombier Validé']);
        User::factory()->prestataire('en_attente', ['categorie_service_id' => $categorie->id])->create($geo);
        User::factory()->prestataire('refuse', ['categorie_service_id' => $categorie->id])->create($geo);
        User::factory()->prestataire('valide', ['categorie_service_id' => $categorie->id])->blocked()->create($geo);

        Sanctum::actingAs(User::factory()->client()->create(['gouvernorat' => 'Tunis']));

        $response = $this->getJson('/api/prestataires?lat=36.80&lng=10.18')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $valide->id)
            ->assertJsonPath('0.prestataire.validation_status', 'valide')
            ->assertJsonStructure([['id', 'nom', 'prestataire', 'distance_km', 'score']]);

        $this->assertLessThan(2, $response->json('0.distance_km'));
        $this->assertGreaterThan(0, $response->json('0.score'));
        $this->assertLessThanOrEqual(1, $response->json('0.score'));

        $this->getJson("/api/prestataires?categorie_id={$categorie->id}&q=plomb&sort=prix")->assertOk()->assertJsonCount(1);
        $this->getJson('/api/prestataires?min_note=4')->assertOk()->assertJsonCount(0);
        // No review and no appointment: listed in the search, but not recommended.
        $this->getJson('/api/prestataires/recommandations')->assertOk()->assertJsonCount(0);

        $this->getJson("/api/prestataires/{$valide->id}")
            ->assertOk()
            ->assertJsonPath('id', $valide->id)
            ->assertJsonPath('evaluations', []);
    }
}
