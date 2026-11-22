<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\RendezVous;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LitigeTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_opens_litige_and_admin_resolves_it(): void
    {
        $admin = User::factory()->admin()->create();
        $rdv = RendezVous::factory()->status('termine')->create();

        Sanctum::actingAs($rdv->client);
        $litigeId = $this->postJson('/api/litiges', [
            'rendez_vous_id' => $rdv->id, 'sujet' => 'Retard', 'description' => 'Le prestataire est arrivé avec 2h de retard.',
        ])->assertCreated()
            ->assertJsonPath('statut', 'ouvert')
            ->assertJsonPath('declarant.id', $rdv->client_id)
            ->assertJsonPath('cible.id', $rdv->prestataire_id)
            ->assertJsonPath('cible.role', 'prestataire')
            ->assertJsonPath('rendez_vous.id', $rdv->id)
            ->json('id');

        // The cible sees it too; an unrelated user does not.
        Sanctum::actingAs($rdv->prestataire);
        $this->getJson('/api/litiges')->assertOk()->assertJsonCount(1);
        Sanctum::actingAs(User::factory()->client()->create());
        $this->getJson('/api/litiges')->assertOk()->assertJsonCount(0);
        $this->postJson('/api/litiges', ['rendez_vous_id' => $rdv->id, 'sujet' => 'X', 'description' => 'Y'])->assertForbidden();

        Sanctum::actingAs($rdv->client);
        $this->patchJson("/api/admin/litiges/{$litigeId}", ['statut' => 'resolu'])->assertForbidden();

        Sanctum::actingAs($admin);
        $this->getJson('/api/admin/dashboard')->assertJsonPath('litiges_ouverts', 1);
        $this->patchJson("/api/admin/litiges/{$litigeId}", ['statut' => 'resolu', 'reponse_admin' => 'Geste commercial accordé.'])
            ->assertOk()
            ->assertJsonPath('statut', 'resolu')
            ->assertJsonPath('reponse_admin', 'Geste commercial accordé.')
            ->assertJsonPath('traite_par', $admin->id);

        $this->assertNotNull($this->getJson('/api/litiges')->json('0.traite_le'));

        // Both parties are notified of the resolution.
        foreach ([$rdv->client_id, $rdv->prestataire_id] as $userId) {
            $this->assertTrue(AppNotification::where('user_id', $userId)->where('titre', 'Mise à jour d\'un litige')->exists());
        }
    }
}
