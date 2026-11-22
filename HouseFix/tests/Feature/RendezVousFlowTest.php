<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\CategorieService;
use App\Models\Facture;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RendezVousFlowTest extends TestCase
{
    use RefreshDatabase;

    private User $client;

    private User $prestataire;

    private CategorieService $categorie;

    protected function setUp(): void
    {
        parent::setUp();

        $this->categorie = CategorieService::factory()->create(['nom' => 'Plomberie']);
        $this->client = User::factory()->client()->create();
        $this->prestataire = User::factory()->prestataire('valide', ['categorie_service_id' => $this->categorie->id])->create();
    }

    private function createRdv(): int
    {
        Sanctum::actingAs($this->client);

        $response = $this->postJson('/api/rendez-vous', [
            'prestataire_id' => $this->prestataire->id,
            'categorie_service_id' => $this->categorie->id,
            'date' => now()->addDays(2)->toDateString(),
            'address' => '12 rue de Marseille, Tunis',
            'description' => 'Fuite sous l\'évier',
        ]);

        $response->assertCreated()
            ->assertJsonPath('status', 'en_attente')
            ->assertJsonPath('heure', null)
            ->assertJsonPath('client.id', $this->client->id)
            ->assertJsonPath('prestataire.id', $this->prestataire->id)
            ->assertJsonPath('categorie.nom', 'Plomberie')
            ->assertJsonPath('facture', null)
            ->assertJsonPath('evaluation', null);

        return $response->json('id');
    }

    /** Runs the RDV through accept → terminate → invoice and returns the facture id. */
    private function invoicedRdv(int $montant = 120): array
    {
        $rdvId = $this->createRdv();

        Sanctum::actingAs($this->prestataire);
        $this->postJson("/api/rendez-vous/{$rdvId}/accepter", ['heure' => '09:00'])
            ->assertOk()->assertJsonPath('status', 'accepte')->assertJsonPath('heure', '09:00');
        $this->postJson("/api/rendez-vous/{$rdvId}/terminer")->assertOk()->assertJsonPath('status', 'termine');

        $factureId = $this->postJson("/api/rendez-vous/{$rdvId}/facture", ['montant' => $montant, 'details' => 'Remplacement siphon'])
            ->assertCreated()
            ->assertJsonPath('numero', 'FAC-'.now()->year.'-0001')
            // The prestataire enters the HT amount; the default rate (19 %) is applied server-side.
            ->assertJsonPath('montant_ht', $montant) // JSON encodes 120.0 as 120
            ->assertJsonPath('taux_tva', 19)
            ->assertJsonPath('montant_tva', round($montant * 0.19, 2))
            ->assertJsonPath('montant', round($montant * 1.19, 2))
            ->assertJsonPath('montant_ttc', round($montant * 1.19, 2))
            ->assertJsonPath('statut_paiement', 'non_payee')
            ->assertJsonPath('rendez_vous.status', 'facture')
            ->assertJsonMissingPath('rendez_vous.facture')
            ->json('id');

        return [$rdvId, $factureId];
    }

    public function test_full_flow_with_online_payment_and_evaluation(): void
    {
        [$rdvId, $factureId] = $this->invoicedRdv();

        // Each transition notifies the other party (création → prestataire; 3 transitions → client).
        $this->assertSame(1, AppNotification::where('user_id', $this->prestataire->id)->count());
        $this->assertSame(3, AppNotification::where('user_id', $this->client->id)->count());

        Sanctum::actingAs($this->client);
        $this->postJson("/api/factures/{$factureId}/payer", [
            'mode' => 'en_ligne', 'card_number' => '4242 4242 4242 4242', 'card_name' => 'M AYARI',
            'expiry' => '12/28', 'cvv' => '123',
        ])->assertOk()
            ->assertJsonPath('statut_paiement', 'payee')
            ->assertJsonPath('mode_paiement', 'en_ligne')
            ->assertJsonPath('paiements.0.statut', 'valide');

        $this->postJson("/api/factures/{$factureId}/payer", [
            'mode' => 'en_ligne', 'card_number' => '4242424242424242', 'expiry' => '12/28', 'cvv' => '123',
        ])->assertStatus(409)->assertJson(['message' => 'Facture déjà payée']);

        $this->postJson('/api/evaluations', ['rendez_vous_id' => $rdvId, 'note' => 5, 'commentaire' => 'Très bon travail'])
            ->assertCreated()
            ->assertJsonPath('note', 5)
            ->assertJsonPath('client.id', $this->client->id);

        $this->postJson('/api/evaluations', ['rendez_vous_id' => $rdvId, 'note' => 4])->assertStatus(409);

        $profile = $this->prestataire->prestataireProfile()->first();
        $this->assertSame(5.0, $profile->note_moyenne);
        $this->assertSame(1, $profile->nb_avis);

        $this->getJson("/api/rendez-vous/{$rdvId}")
            ->assertOk()
            ->assertJsonPath('facture.statut_paiement', 'payee')
            ->assertJsonPath('evaluation.note', 5);

        $this->get("/api/factures/{$factureId}/pdf")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_refused_card_returns_402_and_records_refused_payment(): void
    {
        [, $factureId] = $this->invoicedRdv();

        Sanctum::actingAs($this->client);
        $this->postJson("/api/factures/{$factureId}/payer", [
            'mode' => 'en_ligne', 'card_number' => '4111111111110000', 'expiry' => '12/28', 'cvv' => '123',
        ])->assertStatus(402)->assertJsonStructure(['message']);

        $facture = Facture::with('paiements')->find($factureId);
        $this->assertSame('non_payee', $facture->statut_paiement);
        $this->assertSame('refuse', $facture->paiements->first()->statut);

        $this->postJson("/api/factures/{$factureId}/payer", ['mode' => 'en_ligne', 'card_number' => '123', 'expiry' => '13/28', 'cvv' => '1'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['card_number', 'expiry', 'cvv']);
    }

    public function test_cash_payment_is_confirmed_by_prestataire(): void
    {
        [, $factureId] = $this->invoicedRdv(80);

        Sanctum::actingAs($this->client);
        $this->postJson("/api/factures/{$factureId}/payer", ['mode' => 'especes'])
            ->assertOk()
            ->assertJsonPath('statut_paiement', 'en_attente')
            ->assertJsonPath('paiements.0.statut', 'en_attente');

        Sanctum::actingAs($this->prestataire);
        $this->postJson("/api/factures/{$factureId}/confirmer-especes")
            ->assertOk()
            ->assertJsonPath('statut_paiement', 'payee')
            ->assertJsonPath('paiements.0.statut', 'valide');

        $this->getJson('/api/prestataire/revenus')
            ->assertOk()
            ->assertJsonPath('total', 95.2) // TTC: 80 HT + 19 %
            ->assertJsonPath('mois_courant', 95.2)
            ->assertJsonCount(6, 'mensuel');
    }

    public function test_prestataire_records_cash_without_client_declaration(): void
    {
        [, $factureId] = $this->invoicedRdv(60);

        Sanctum::actingAs($this->client);
        $this->postJson("/api/factures/{$factureId}/encaisser-especes")->assertForbidden();

        Sanctum::actingAs($this->prestataire);
        $this->postJson("/api/factures/{$factureId}/encaisser-especes")
            ->assertOk()
            ->assertJsonPath('statut_paiement', 'payee')
            ->assertJsonPath('mode_paiement', 'especes')
            ->assertJsonCount(1, 'paiements')
            ->assertJsonPath('paiements.0.statut', 'valide');
        $this->postJson("/api/factures/{$factureId}/encaisser-especes")->assertStatus(409);

        $this->assertTrue(AppNotification::where('user_id', $this->client->id)->where('titre', 'Paiement en espèces enregistré')->exists());
    }

    public function test_recording_cash_validates_the_pending_declaration(): void
    {
        [, $factureId] = $this->invoicedRdv();

        Sanctum::actingAs($this->client);
        $this->postJson("/api/factures/{$factureId}/payer", ['mode' => 'especes'])->assertOk();

        Sanctum::actingAs($this->prestataire);
        $this->postJson("/api/factures/{$factureId}/encaisser-especes")
            ->assertOk()
            ->assertJsonPath('statut_paiement', 'payee')
            ->assertJsonCount(1, 'paiements');
    }

    public function test_prestataire_rejects_undelivered_cash_and_client_can_pay_again(): void
    {
        [, $factureId] = $this->invoicedRdv();

        Sanctum::actingAs($this->client);
        $this->postJson("/api/factures/{$factureId}/payer", ['mode' => 'especes'])->assertOk();

        Sanctum::actingAs($this->prestataire);
        $this->postJson("/api/factures/{$factureId}/refuser-especes")
            ->assertOk()
            ->assertJsonPath('statut_paiement', 'non_payee')
            ->assertJsonPath('mode_paiement', null)
            ->assertJsonPath('paiements.0.statut', 'refuse');
        $this->postJson("/api/factures/{$factureId}/refuser-especes")->assertStatus(409);

        $this->assertTrue(AppNotification::where('user_id', $this->client->id)->where('titre', 'Paiement en espèces non reçu')->exists());

        Sanctum::actingAs($this->client);
        $this->postJson("/api/factures/{$factureId}/payer", ['mode' => 'especes'])
            ->assertOk()
            ->assertJsonPath('statut_paiement', 'en_attente')
            ->assertJsonCount(2, 'paiements');
    }

    public function test_client_cancels_cash_declaration(): void
    {
        [, $factureId] = $this->invoicedRdv();

        Sanctum::actingAs($this->client);
        $this->postJson("/api/factures/{$factureId}/annuler-especes")->assertStatus(409);
        $this->postJson("/api/factures/{$factureId}/payer", ['mode' => 'especes'])->assertOk();

        Sanctum::actingAs($this->prestataire);
        $this->postJson("/api/factures/{$factureId}/annuler-especes")->assertForbidden();

        Sanctum::actingAs($this->client);
        $this->postJson("/api/factures/{$factureId}/annuler-especes")
            ->assertOk()
            ->assertJsonPath('statut_paiement', 'non_payee')
            ->assertJsonPath('paiements.0.statut', 'annule');

        $this->assertTrue(AppNotification::where('user_id', $this->prestataire->id)->where('titre', 'Déclaration en espèces annulée')->exists());
    }

    public function test_forbidden_transition_returns_409(): void
    {
        $rdvId = $this->createRdv();

        Sanctum::actingAs($this->prestataire);
        $this->postJson("/api/rendez-vous/{$rdvId}/terminer")->assertStatus(409)->assertJsonStructure(['message']);

        Sanctum::actingAs($this->client);
        $this->postJson("/api/rendez-vous/{$rdvId}/annuler")->assertOk()->assertJsonPath('status', 'annule_par_client');
        $this->postJson("/api/rendez-vous/{$rdvId}/annuler")->assertStatus(409);
    }

    public function test_unavailable_prestataire_returns_422(): void
    {
        $this->prestataire->prestataireProfile()->update(['is_available' => false]);
        Sanctum::actingAs($this->client);

        $this->postJson('/api/rendez-vous', [
            'prestataire_id' => $this->prestataire->id,
            'categorie_service_id' => $this->categorie->id,
            'date' => now()->toDateString(),
            'address' => 'Tunis',
            'description' => 'Test',
        ])->assertStatus(422)->assertExactJson(['message' => 'Prestataire indisponible']);
    }

    public function test_client_cannot_see_another_clients_rendez_vous(): void
    {
        $rdvId = $this->createRdv();
        $other = User::factory()->client()->create();

        Sanctum::actingAs($other);
        $this->getJson("/api/rendez-vous/{$rdvId}")->assertForbidden();
        $this->getJson('/api/rendez-vous')->assertOk()->assertJsonCount(0);

        Sanctum::actingAs($this->prestataire);
        $this->getJson('/api/rendez-vous?status=en_attente')->assertOk()->assertJsonCount(1);

        Sanctum::actingAs(User::factory()->admin()->create());
        $this->getJson("/api/rendez-vous/{$rdvId}")->assertOk();
    }

    public function test_other_prestataire_cannot_accept(): void
    {
        $rdvId = $this->createRdv();

        Sanctum::actingAs(User::factory()->prestataire()->create());
        $this->postJson("/api/rendez-vous/{$rdvId}/accepter")->assertForbidden();

        Sanctum::actingAs($this->client);
        $this->postJson("/api/rendez-vous/{$rdvId}/accepter")->assertForbidden();
    }
}
