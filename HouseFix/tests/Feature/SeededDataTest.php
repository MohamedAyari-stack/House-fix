<?php

namespace Tests\Feature;

use App\Models\CategorieService;
use App\Models\User;
use Database\Seeders\CategorieServiceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Smoke tests over the demo data used for the PFE screenshots. */
class SeededDataTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_accounts_and_dashboards(): void
    {
        // Explicit: the $seed property only applies when RefreshDatabase actually migrates.
        $this->seed();

        $token = $this->postJson('/api/auth/login', ['email' => 'client@housefix.tn', 'password' => 'password'])
            ->assertOk()->json('token');

        $this->withToken($token)->getJson('/api/rendez-vous')->assertOk()->assertJsonCount(8);
        $this->withToken($token)->getJson('/api/client/dashboard')->assertOk()
            ->assertJsonPath('factures_impayees', 1)
            ->assertJsonPath('prochain_rdv.prestataire.nom', 'Mohamed Ayari2');
        $this->withToken($token)->getJson('/api/conversations')->assertOk()
            ->assertJsonCount(1)->assertJsonPath('0.unread_count', 1)->assertJsonPath('0.other_user.role', 'prestataire');
        $this->withToken($token)->getJson('/api/notifications')->assertOk()->assertJsonPath('non_lues', 2);
        $this->withToken($token)->getJson('/api/categories')->assertOk()->assertJsonCount(count(CategorieServiceSeeder::CATALOGUE));

        Sanctum::actingAs(User::where('email', 'prestataire@housefix.tn')->first());
        $revenus = $this->getJson('/api/prestataire/revenus')->assertOk()->json();
        $this->assertSame(250, (int) $revenus['total']);
        $this->getJson('/api/prestataire/dashboard')->assertOk()
            ->assertJsonPath('note_moyenne', 5)
            ->assertJsonPath('demandes_en_attente', 1);

        $this->postJson('/api/auth/login', ['email' => 'admin@housefix.tn', 'password' => 'password'])->assertOk()
            ->assertJsonPath('user.role', 'admin');
        $this->postJson('/api/auth/login', ['email' => 'nouveau@housefix.tn', 'password' => 'password'])->assertOk()
            ->assertJsonPath('user.prestataire.validation_status', 'en_attente');
    }

    public function test_category_seeder_only_adds_missing_services(): void
    {
        CategorieService::create(['nom' => 'Plomberie', 'description' => 'Modifiée par l\'admin', 'icone' => 'bi-droplet']);

        $this->seed(CategorieServiceSeeder::class);
        $this->seed(CategorieServiceSeeder::class);

        $this->assertSame(count(CategorieServiceSeeder::CATALOGUE), CategorieService::count());
        $this->assertSame('Modifiée par l\'admin', CategorieService::where('nom', 'Plomberie')->value('description'));
        $this->assertSame(
            ['aluminium-vitrerie', 'chauffage-gaz', 'electromenager', 'energie-solaire', 'etancheite', 'ferronnerie', 'maconnerie-carrelage', 'pompes-baches-a-eau'],
            CategorieService::whereIn('icone', ['bi-umbrella', 'bi-bricks', 'bi-plug', 'bi-window', 'bi-grid-3x3', 'bi-water', 'bi-fire', 'bi-sun'])->orderBy('slug')->pluck('slug')->all(),
        );
        // Every seeded service is translated (the pre-existing Plomberie is left untouched).
        $this->assertSame(0, CategorieService::where('nom', '!=', 'Plomberie')
            ->where(fn ($q) => $q->whereNull('nom_ar')->orWhereNull('nom_en'))->count());
    }
}
