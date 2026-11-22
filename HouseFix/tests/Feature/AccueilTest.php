<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccueilTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Seeded inside each test transaction, like SeededDataTest, so other test classes stay empty.
        $this->seed();
    }

    public function test_landing_data_is_public_and_has_no_private_fields(): void
    {
        $response = $this->getJson('/api/accueil')
            ->assertOk()
            ->assertJsonStructure([
                'stats' => ['prestataires', 'interventions', 'note_moyenne', 'avis', 'gouvernorats'],
                'categories' => [['id', 'nom', 'icone', 'prestataires_count']],
                'top_prestataires' => [['id', 'nom', 'photo_url', 'gouvernorat', 'categorie', 'tarif_horaire', 'note_moyenne', 'nb_avis']],
                'avis',
            ]);

        $this->assertLessThanOrEqual(4, count($response->json('top_prestataires')));
        $this->assertLessThanOrEqual(3, count($response->json('avis')));

        $json = $response->getContent();
        $this->assertStringNotContainsString('@housefix.tn', $json, 'no email on a public page');
        $this->assertStringNotContainsString('+216', $json, 'no phone number on a public page');
    }

    public function test_reviewers_are_shown_with_first_name_and_initial_only(): void
    {
        foreach ($this->getJson('/api/accueil')->json('avis') as $avis) {
            $this->assertMatchesRegularExpression('/^\S+( [A-ZÀ-Ý]\.)?$/u', $avis['auteur']);
            $this->assertGreaterThanOrEqual(4, $avis['note']);
        }
    }

    public function test_top_prestataires_are_sorted_by_rating(): void
    {
        $notes = array_column($this->getJson('/api/accueil')->json('top_prestataires'), 'note_moyenne');

        $sorted = $notes;
        rsort($sorted);
        $this->assertSame($sorted, $notes);
    }
}
