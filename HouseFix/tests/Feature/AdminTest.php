<?php

namespace Tests\Feature;

use App\Models\CategorieService;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_non_admin_gets_403_on_admin_routes(): void
    {
        foreach ([User::factory()->client()->create(), User::factory()->prestataire()->create()] as $user) {
            Sanctum::actingAs($user);

            $this->getJson('/api/admin/dashboard')->assertForbidden()->assertJsonStructure(['message']);
            $this->getJson('/api/admin/users')->assertForbidden();
            $this->postJson('/api/admin/categories', ['nom' => 'Test'])->assertForbidden();
        }
    }

    public function test_admin_dashboard_shape(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->getJson('/api/admin/dashboard')
            ->assertOk()
            ->assertJsonStructure([
                'clients_inscrits', 'prestataires_actifs', 'prestataires_en_attente', 'total_rdv',
                'moyenne_evaluations', 'nb_avis', 'litiges_ouverts', 'chiffre_affaires',
                'statuts' => [['status', 'count']], 'rdv_par_mois' => [['label', 'total']],
            ])
            ->assertJsonCount(6, 'statuts');
    }

    public function test_admin_validates_prestataire(): void
    {
        $pending = User::factory()->prestataire('en_attente')->create();
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->getJson('/api/admin/validations')->assertOk()->assertJsonCount(1);

        $this->postJson("/api/admin/prestataires/{$pending->id}/valider")
            ->assertOk()
            ->assertJsonPath('is_verified', true)
            ->assertJsonPath('prestataire.validation_status', 'valide');
    }

    public function test_admin_blocks_user_and_revokes_tokens(): void
    {
        $client = User::factory()->client()->create();
        $client->createToken('t');
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->postJson("/api/admin/users/{$client->id}/bloquer", ['type' => 'temporaire'])
            ->assertStatus(422)->assertJsonValidationErrors('jusqu_au');

        $this->postJson("/api/admin/users/{$client->id}/bloquer", [
            'type' => 'temporaire', 'jusqu_au' => now()->addDays(7)->toDateString(), 'motif' => 'Comportement abusif',
        ])->assertOk()
            ->assertJsonPath('is_blocked', true)
            ->assertJsonPath('statut', 'suspendu')
            ->assertJsonPath('block_motif', 'Comportement abusif');

        $this->assertCount(0, $client->tokens()->get());

        $this->postJson("/api/admin/users/{$client->id}/debloquer")
            ->assertOk()->assertJsonPath('is_blocked', false)->assertJsonPath('statut', 'actif');

        $this->deleteJson("/api/admin/users/{$admin->id}")->assertForbidden();
        $this->deleteJson("/api/admin/users/{$client->id}")->assertOk();
        $this->assertNull($client->fresh());
    }

    public function test_category_crud_and_conflict_on_delete(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());

        $id = $this->postJson('/api/admin/categories', ['nom' => 'Vitrerie', 'icone' => 'bi-window'])
            ->assertCreated()
            ->assertJson(['nom' => 'Vitrerie', 'icone' => 'bi-window', 'prestataires_count' => 0])
            ->json('id');

        $this->putJson("/api/admin/categories/{$id}", ['nom' => 'Vitrerie & miroirs'])
            ->assertOk()->assertJsonPath('nom', 'Vitrerie & miroirs');

        $used = CategorieService::factory()->create();
        User::factory()->prestataire('valide', ['categorie_service_id' => $used->id])->create();

        $this->deleteJson("/api/admin/categories/{$used->id}")->assertStatus(409);
        $this->deleteJson("/api/admin/categories/{$id}")->assertOk();

        $this->getJson('/api/categories')->assertOk()->assertJsonCount(1)->assertJsonPath('0.prestataires_count', 1);
    }
}
