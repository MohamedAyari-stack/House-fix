<?php

namespace Tests\Feature;

use App\Models\CategorieService;
use App\Models\Facture;
use App\Models\RendezVous;
use App\Models\TauxTva;
use App\Models\User;
use App\Services\Tva;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TvaTest extends TestCase
{
    use RefreshDatabase;

    public function test_formulas(): void
    {
        $this->assertSame(['montant_ht' => 100.0, 'taux_tva' => 19.0, 'montant_tva' => 19.0, 'montant_ttc' => 119.0], Tva::calculer(100, 19));
        $this->assertSame(['montant_ht' => 33.33, 'taux_tva' => 7.0, 'montant_tva' => 2.33, 'montant_ttc' => 35.66], Tva::calculer(33.333, 7));
        $this->assertSame(0.0, Tva::calculer(80, 0)['montant_tva']);
    }

    public function test_rates_are_public_and_seeded_with_a_single_default(): void
    {
        $this->getJson('/api/taux-tva')->assertOk()
            ->assertJsonCount(4)
            ->assertJsonPath('0.taux', 19)
            ->assertJsonPath('0.par_defaut', true);
    }

    public function test_invoice_uses_the_service_rate_and_freezes_it(): void
    {
        $reduit = TauxTva::where('taux', 7)->first();
        $categorie = CategorieService::factory()->create(['taux_tva_id' => $reduit->id]);
        $prestataire = User::factory()->prestataire('valide', ['categorie_service_id' => $categorie->id])->create();
        $rdv = RendezVous::create([
            'client_id' => User::factory()->client()->create()->id, 'prestataire_id' => $prestataire->id,
            'categorie_service_id' => $categorie->id, 'date' => now()->toDateString(), 'heure' => '09:00',
            'address' => 'Sousse', 'description' => 'Test', 'status' => 'termine',
        ]);

        Sanctum::actingAs($prestataire);
        $id = $this->postJson("/api/rendez-vous/{$rdv->id}/facture", ['montant' => 200])->assertCreated()
            ->assertJsonPath('montant_ht', 200)
            ->assertJsonPath('taux_tva', 7)
            ->assertJsonPath('montant_tva', 14)
            ->assertJsonPath('montant_ttc', 214)
            ->json('id');

        // Changing the rate later never changes an issued invoice.
        $reduit->update(['taux' => 9]);
        $this->assertSame(214.0, Facture::find($id)->montant);
        $this->assertSame(7.0, Facture::find($id)->taux_tva);
    }

    public function test_only_admin_manages_rates_and_default_is_unique(): void
    {
        Sanctum::actingAs(User::factory()->client()->create());
        $this->postJson('/api/admin/taux-tva', ['libelle' => 'X', 'taux' => 10])->assertForbidden();

        Sanctum::actingAs(User::factory()->admin()->create());
        $this->postJson('/api/admin/taux-tva', ['libelle' => 'Trop', 'taux' => 150])->assertStatus(422);
        $id = $this->postJson('/api/admin/taux-tva', ['libelle' => 'Nouveau', 'taux' => 10, 'par_defaut' => true])
            ->assertCreated()->assertJsonPath('par_defaut', true)->json('id');
        $this->assertSame(1, TauxTva::where('par_defaut', true)->count());

        $this->deleteJson("/api/admin/taux-tva/{$id}")->assertStatus(409);
        $this->putJson("/api/admin/taux-tva/{$id}", ['libelle' => 'Nouveau', 'taux' => 10, 'par_defaut' => false])->assertStatus(422);

        // Deleting a rate sends its services back to the default rate.
        $ancien = TauxTva::where('taux', 13)->first();
        $categorie = CategorieService::factory()->create(['taux_tva_id' => $ancien->id]);
        $this->deleteJson("/api/admin/taux-tva/{$ancien->id}")->assertOk();
        $this->assertNull($categorie->fresh()->taux_tva_id);
        $this->assertSame(10.0, Tva::tauxPour($categorie->fresh()));
    }

    public function test_admin_dashboard_splits_revenue(): void
    {
        $this->seed();
        Facture::query()->update(['statut_paiement' => 'payee', 'montant_ht' => 100, 'taux_tva' => 19, 'montant_tva' => 19, 'montant' => 119]);

        Sanctum::actingAs(User::where('role', 'admin')->first());
        $n = Facture::count();
        $this->getJson('/api/admin/dashboard')->assertOk()
            ->assertJsonPath('chiffre_affaires_ht', 100 * $n)
            ->assertJsonPath('tva_collectee', 19 * $n)
            ->assertJsonPath('chiffre_affaires', 119 * $n);
    }
}
