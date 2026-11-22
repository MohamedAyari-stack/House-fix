<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\CategorieService;
use App\Models\User;
use App\Notifications\EmailCode;
use App\Services\EmailCodes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use RuntimeException;
use Tests\TestCase;

class EmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    private function register(array $overrides = []): void
    {
        $this->postJson('/api/auth/register', $overrides + [
            'nom' => 'Salma Ben Ali',
            'email' => 'salma@example.tn',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
            'accepte_conditions' => true,
            'terms_version' => config('app.terms_version'),
            'telephone' => '+216 20 000 000',
            'gouvernorat' => 'Sousse',
            'role' => 'client',
        ])->assertCreated();
    }

    /** Code of the last verification email sent to the address. */
    private function lastCode(string $email): string
    {
        $code = null;
        Notification::assertSentTo(User::where('email', $email)->first(), EmailCode::class, function (EmailCode $n) use (&$code) {
            if ($n->purpose === EmailCodes::VERIFY) {
                $code = $n->code;
            }

            return true;
        });

        return $code ?? throw new \LogicException('No verification code was emailed.');
    }

    public function test_the_right_code_verifies_the_email_and_signs_in(): void
    {
        Notification::fake();
        $this->register();

        $this->postJson('/api/auth/verify-email', ['email' => 'salma@example.tn', 'code' => $this->lastCode('salma@example.tn')])
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'email', 'role']])
            ->assertJsonPath('user.email', 'salma@example.tn');

        $this->assertTrue(User::where('email', 'salma@example.tn')->first()->hasVerifiedEmail());
        $this->assertDatabaseMissing('email_codes', ['email' => 'salma@example.tn']);
    }

    public function test_a_wrong_code_shows_an_error_and_keeps_the_account_unverified(): void
    {
        Notification::fake();
        $this->register();
        $code = $this->lastCode('salma@example.tn');

        $this->postJson('/api/auth/verify-email', ['email' => 'salma@example.tn', 'code' => $code === '000000' ? '111111' : '000000'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.code.0', 'Code incorrect. Il vous reste 4 tentatives.');

        $this->assertFalse(User::where('email', 'salma@example.tn')->first()->hasVerifiedEmail());
    }

    public function test_an_unverified_account_cannot_log_in_and_receives_a_new_code(): void
    {
        Notification::fake();
        $user = User::factory()->client()->unverified()->create();

        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'password'])
            ->assertForbidden()
            ->assertJsonPath('email_not_verified', true)
            ->assertJsonPath('email', $user->email)
            ->assertJsonMissingPath('token');

        Notification::assertSentTo($user, EmailCode::class, fn (EmailCode $n) => $n->purpose === EmailCodes::VERIFY);
    }

    public function test_a_wrong_password_does_not_reveal_that_the_email_is_unverified(): void
    {
        Notification::fake();
        $user = User::factory()->client()->unverified()->create();

        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'mauvais'])
            ->assertUnprocessable()
            ->assertJsonMissingPath('email_not_verified');

        Notification::assertNothingSent();
    }

    public function test_resend_sends_a_new_code_but_not_more_than_once_a_minute(): void
    {
        Notification::fake();
        $user = User::factory()->client()->unverified()->create();

        $this->postJson('/api/auth/resend-verification', ['email' => $user->email])->assertOk();
        $this->postJson('/api/auth/resend-verification', ['email' => $user->email])->assertOk();
        Notification::assertSentToTimes($user, EmailCode::class, 1);

        $this->travel(61)->seconds();
        $this->postJson('/api/auth/resend-verification', ['email' => $user->email])->assertOk();
        Notification::assertSentToTimes($user, EmailCode::class, 2);
    }

    public function test_resend_gives_the_same_answer_for_unknown_and_verified_addresses(): void
    {
        Notification::fake();
        $verified = User::factory()->client()->create();

        $unknown = $this->postJson('/api/auth/resend-verification', ['email' => 'personne@example.tn'])->assertOk();
        $done = $this->postJson('/api/auth/resend-verification', ['email' => $verified->email])->assertOk();

        $this->assertSame($unknown->json('message'), $done->json('message'));
        Notification::assertNothingSent();
    }

    public function test_the_admin_sees_a_new_prestataire_only_after_email_verification(): void
    {
        Notification::fake();
        User::factory()->admin()->create();
        $this->register([
            'email' => 'ali@example.tn',
            'role' => 'prestataire',
            'categorie_service_id' => CategorieService::factory()->create()->id,
        ]);

        $this->assertSame(0, AppNotification::where('titre', 'Nouveau prestataire à valider')->count());

        $this->postJson('/api/auth/verify-email', ['email' => 'ali@example.tn', 'code' => $this->lastCode('ali@example.tn')])->assertOk();

        $this->assertSame(1, AppNotification::where('titre', 'Nouveau prestataire à valider')->count());
    }

    public function test_registration_succeeds_even_when_the_email_cannot_be_sent(): void
    {
        Notification::shouldReceive('send')->andThrow(new RuntimeException('Brevo injoignable'));

        $this->postJson('/api/auth/register', [
            'nom' => 'Salma Ben Ali',
            'email' => 'salma@example.tn',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
            'accepte_conditions' => true,
            'terms_version' => config('app.terms_version'),
            'telephone' => '+216 20 000 000',
            'gouvernorat' => 'Sousse',
            'role' => 'client',
        ])->assertCreated()->assertJsonPath('email_sent', false);

        $this->assertDatabaseHas('users', ['email' => 'salma@example.tn', 'email_verified_at' => null]);
    }
}
