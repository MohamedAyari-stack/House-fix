<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GeocodingTest extends TestCase
{
    use RefreshDatabase;

    private User $client;

    protected function setUp(): void
    {
        parent::setUp();
        // Old demo coordinates that no longer match the address.
        $this->client = User::factory()->client()->create(['gouvernorat' => 'Sousse', 'address' => 'Ancienne adresse', 'latitude' => 36.8, 'longitude' => 10.18]);
        Sanctum::actingAs($this->client);
    }

    private function fakeNominatim(array $results): void
    {
        Http::fake(['nominatim.openstreetmap.org/*' => Http::response($results)]);
    }

    public function test_a_new_address_without_coordinates_is_geocoded(): void
    {
        $this->fakeNominatim([['lat' => '35.8256123', 'lon' => '10.6084456', 'display_name' => 'Sousse']]);

        $this->putJson('/api/profile', ['address' => '18 avenue Léopold Senghor', 'latitude' => null, 'longitude' => null])
            ->assertOk()
            ->assertJsonPath('latitude', 35.8256123)
            ->assertJsonPath('longitude', 10.6084456);

        Http::assertSent(fn (Request $r) => $r['q'] === '18 avenue Léopold Senghor, Sousse'
            && $r['countrycodes'] === 'tn' && $r->hasHeader('User-Agent'));
    }

    public function test_gps_coordinates_sent_with_the_address_are_kept(): void
    {
        Http::fake();

        $this->putJson('/api/profile', ['address' => 'Chez moi', 'latitude' => 36.1, 'longitude' => 10.2])
            ->assertOk()->assertJsonPath('latitude', 36.1)->assertJsonPath('longitude', 10.2);

        Http::assertNothingSent();
    }

    public function test_an_address_that_cannot_be_found_clears_the_old_coordinates(): void
    {
        $this->fakeNominatim([]);

        $this->putJson('/api/profile', ['address' => 'Adresse introuvable xyz'])
            ->assertOk()->assertJsonPath('latitude', null)->assertJsonPath('longitude', null);
    }

    public function test_unchanged_address_does_not_call_the_service(): void
    {
        Http::fake();

        $this->putJson('/api/profile', ['nom' => 'Nouveau nom', 'address' => 'Ancienne adresse'])
            ->assertOk()->assertJsonPath('latitude', 36.8);

        Http::assertNothingSent();
    }
}
