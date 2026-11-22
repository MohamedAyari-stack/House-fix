<?php

namespace Tests\Feature;

use App\Models\CategorieService;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ServicePageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_slugs_are_built_from_the_french_name_and_stay_unique(): void
    {
        $this->assertSame('electricite', CategorieService::where('nom', 'Électricité')->value('slug'));

        // Different name, same slug once accents are removed.
        $copy = CategorieService::create(['nom' => 'Electricité', 'icone' => 'bi-plug']);
        $this->assertSame('electricite-2', $copy->slug);

        $copy->update(['nom' => 'Électronique']);
        $this->assertSame('electronique', $copy->fresh()->slug);
    }

    public function test_the_services_index_is_public(): void
    {
        $this->getJson('/api/services')
            ->assertOk()
            ->assertJsonStructure([['id', 'slug', 'nom', 'icone', 'description', 'prestataires', 'tarif_min', 'note_moyenne']])
            ->assertJsonFragment(['slug' => 'plomberie', 'nom' => 'Plomberie']);
    }

    public function test_a_service_page_shows_stats_providers_and_reviews_without_private_data(): void
    {
        $response = $this->getJson('/api/services/plomberie')
            ->assertOk()
            ->assertJsonPath('service.slug', 'plomberie')
            ->assertJsonStructure([
                'service' => ['id', 'slug', 'nom', 'icone', 'description'],
                'stats' => ['prestataires', 'disponibles', 'note_moyenne', 'avis', 'interventions', 'tarif_min', 'tarif_median', 'tarif_max'],
                'gouvernorats' => [['nom', 'prestataires']],
                'prestataires' => [['id', 'nom', 'photo_url', 'gouvernorat', 'tarif_horaire', 'note_moyenne', 'nb_avis', 'disponible']],
                'avis',
                'autres_services' => [['slug', 'nom', 'icone']],
            ]);

        $json = $response->getContent();
        $this->assertStringNotContainsString('@housefix.tn', $json, 'no email on a public page');
        $this->assertStringNotContainsString('+216', $json, 'no phone number on a public page');
        foreach ($response->json('avis') as $avis) {
            $this->assertMatchesRegularExpression('/^\S+( \S\.)?$/u', $avis['auteur'], 'reviewers shown as "First name + initial"');
        }
        $this->assertNotContains('plomberie', array_column($response->json('autres_services'), 'slug'));
    }

    public function test_the_governorate_filter_narrows_the_providers(): void
    {
        $tunis = $this->getJson('/api/services/plomberie?gouvernorat=Tunis')->assertOk();
        $this->assertSame('Tunis', $tunis->json('gouvernorat'));
        foreach ($tunis->json('prestataires') as $p) {
            $this->assertSame('Tunis', $p['gouvernorat']);
        }

        $empty = $this->getJson('/api/services/plomberie?gouvernorat=Tozeur')->assertOk();
        $this->assertSame(0, $empty->json('stats.prestataires'));
        $this->assertNotEmpty($empty->json('gouvernorats'), 'other governorates stay listed for navigation');
    }

    public function test_blocked_and_unvalidated_providers_are_not_listed(): void
    {
        $plomberie = CategorieService::where('slug', 'plomberie')->first();
        User::factory()->prestataire('en_attente', ['categorie_service_id' => $plomberie->id])->create(['nom' => 'En Attente']);
        User::factory()->prestataire('valide', ['categorie_service_id' => $plomberie->id])->blocked()->create(['nom' => 'Compte Bloque']);

        $names = array_column($this->getJson('/api/services/plomberie')->json('prestataires'), 'nom');
        $this->assertNotContains('En Attente', $names);
        $this->assertNotContains('Compte Bloque', $names);
    }

    public function test_names_follow_the_language_and_bad_requests_are_refused(): void
    {
        $this->getJson('/api/services/plomberie', ['Accept-Language' => 'ar'])->assertJsonPath('service.nom', 'سباكة');
        $this->getJson('/api/services/plomberie', ['Accept-Language' => 'en'])->assertJsonPath('service.nom', 'Plumbing');
        $this->getJson('/api/services/inconnu')->assertNotFound();
        $this->getJson('/api/services/plomberie?gouvernorat=Paris')->assertUnprocessable();
    }
}
