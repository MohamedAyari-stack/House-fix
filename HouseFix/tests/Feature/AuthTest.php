<?php

namespace Tests\Feature;

use App\Models\CategorieService;
use App\Models\User;
use App\Notifications\EmailCode;
use App\Services\EmailCodes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_can_register(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/auth/register', [
            'nom' => 'Salma Ben Ali',
            'email' => 'salma@example.tn',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
            'accepte_conditions' => true,
            'terms_version' => config('app.terms_version'),
            'telephone' => '+216 20 000 000',
            'gouvernorat' => 'Sousse',
            'role' => 'client',
        ]);

        // No token yet: the account is signed in once the emailed code is confirmed.
        $response->assertCreated()
            ->assertJsonMissingPath('token')
            ->assertJsonPath('email', 'salma@example.tn')
            ->assertJsonPath('email_sent', true);

        $user = User::where('email', 'salma@example.tn')->first();
        $this->assertSame(User::ROLE_CLIENT, $user->role);
        $this->assertTrue($user->is_verified);
        $this->assertFalse($user->hasVerifiedEmail());
        Notification::assertSentTo($user, EmailCode::class, fn (EmailCode $n) => $n->purpose === EmailCodes::VERIFY);
    }

    public function test_prestataire_registers_pending_and_unverified(): void
    {
        Notification::fake();
        $categorie = CategorieService::factory()->create();

        $response = $this->postJson('/api/auth/register', [
            'nom' => 'Ali Plombier',
            'email' => 'ali@example.tn',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
            'accepte_conditions' => true,
            'terms_version' => config('app.terms_version'),
            'telephone' => '+216 20 000 001',
            'gouvernorat' => 'Tunis',
            'role' => 'prestataire',
            'categorie_service_id' => $categorie->id,
        ]);

        $response->assertCreated();

        $user = User::with('prestataireProfile')->where('email', 'ali@example.tn')->first();
        $this->assertFalse($user->is_verified);
        $this->assertSame('en_attente', $user->prestataireProfile->validation_status);
        $this->assertSame($categorie->id, $user->prestataireProfile->categorie_service_id);
    }

    public function test_register_validation_errors_are_422_in_french(): void
    {
        $this->postJson('/api/auth/register', ['role' => 'admin'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['nom', 'email', 'password', 'role'])
            ->assertJsonPath('errors.nom.0', 'Le champ nom est obligatoire.');
    }

    public function test_login_returns_token_and_user(): void
    {
        User::factory()->create(['email' => 'client@housefix.tn']);

        $this->postJson('/api/auth/login', ['email' => 'client@housefix.tn', 'password' => 'password'])
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'email']]);
    }

    public function test_login_with_wrong_credentials_returns_422(): void
    {
        User::factory()->create(['email' => 'client@housefix.tn']);

        $this->postJson('/api/auth/login', ['email' => 'client@housefix.tn', 'password' => 'mauvais'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_blocked_user_cannot_login(): void
    {
        User::factory()->blocked()->create(['email' => 'bloque@housefix.tn']);

        $this->postJson('/api/auth/login', ['email' => 'bloque@housefix.tn', 'password' => 'password'])
            ->assertForbidden()
            ->assertJsonStructure(['message']);
    }

    public function test_expired_temporary_block_is_lifted_on_login(): void
    {
        $user = User::factory()->blocked(now()->subDay())->create(['email' => 'suspendu@housefix.tn']);

        $this->postJson('/api/auth/login', ['email' => 'suspendu@housefix.tn', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('user.is_blocked', false)
            ->assertJsonPath('user.statut', 'actif');

        $this->assertFalse($user->fresh()->is_blocked);
    }

    public function test_blocked_user_gets_403_on_authenticated_routes(): void
    {
        Sanctum::actingAs(User::factory()->blocked(now()->addDays(3))->create());

        $this->getJson('/api/auth/me')->assertForbidden()->assertJsonStructure(['message']);
    }

    public function test_unauthenticated_request_returns_401_json(): void
    {
        $this->get('/api/auth/me')->assertUnauthorized()->assertJson(['message' => 'Non authentifié.']);
    }

    public function test_me_and_logout(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $this->withToken($token)->getJson('/api/auth/me')->assertOk()->assertJsonPath('id', $user->id);
        $this->withToken($token)->postJson('/api/auth/logout')->assertOk()->assertJsonStructure(['message']);

        $this->assertCount(0, $user->tokens()->get());
    }
}
