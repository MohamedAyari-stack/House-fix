<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\EmailCode;
use App\Services\EmailCodes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    /** Requests a code for the user and returns it, as read from the email. */
    private function requestCode(User $user): string
    {
        Notification::fake();
        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])->assertOk();

        $code = null;
        Notification::assertSentTo($user, EmailCode::class, function (EmailCode $n) use (&$code) {
            $code = $n->code;

            return true;
        });

        return $code ?? throw new \LogicException('Password reset notification did not provide a code.');
    }

    private function wrongCode(string $code): string
    {
        return $code === '000000' ? '111111' : '000000';
    }

    public function test_forgot_password_emails_a_six_digit_code(): void
    {
        $user = User::factory()->client()->create();

        $code = $this->requestCode($user);

        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);
        $this->assertDatabaseHas('email_codes', ['email' => $user->email, 'purpose' => EmailCodes::RESET]);
        $this->assertFalse($this->app['db']->table('email_codes')->where('code_hash', $code)->exists(), 'the code must be stored hashed');
    }

    public function test_forgot_password_gives_the_same_answer_for_an_unknown_email(): void
    {
        Notification::fake();
        $known = User::factory()->client()->create();

        $unknown = $this->postJson('/api/auth/forgot-password', ['email' => 'personne@example.tn'])->assertOk();
        $existing = $this->postJson('/api/auth/forgot-password', ['email' => $known->email])->assertOk();

        $this->assertSame($existing->json('message'), $unknown->json('message'));
        Notification::assertSentTimes(EmailCode::class, 1);
    }

    public function test_verify_accepts_the_right_code_and_rejects_a_wrong_one(): void
    {
        $user = User::factory()->client()->create();
        $code = $this->requestCode($user);

        $this->postJson('/api/auth/verify-reset-code', ['email' => $user->email, 'code' => $this->wrongCode($code)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('code')
            ->assertJsonPath('errors.code.0', 'Code incorrect. Il vous reste 4 tentatives.');

        $this->postJson('/api/auth/verify-reset-code', ['email' => $user->email, 'code' => $code])->assertOk();
    }

    public function test_reset_password_with_the_code_changes_password_and_revokes_tokens(): void
    {
        $user = User::factory()->client()->create();
        $user->createToken('ancien appareil');
        $code = $this->requestCode($user);

        $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'code' => $code,
            'password' => 'nouveau123',
            'password_confirmation' => 'nouveau123',
        ])->assertOk();

        $this->assertTrue(Hash::check('nouveau123', $user->fresh()->password));
        $this->assertSame(0, $user->tokens()->count());
        $this->assertDatabaseMissing('email_codes', ['email' => $user->email]);
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'nouveau123'])->assertOk();
    }

    public function test_reset_password_rejects_a_wrong_code(): void
    {
        $user = User::factory()->client()->create();
        $code = $this->requestCode($user);

        $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'code' => $this->wrongCode($code),
            'password' => 'nouveau123',
            'password_confirmation' => 'nouveau123',
        ])->assertUnprocessable()->assertJsonValidationErrors('code');

        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }

    public function test_a_code_works_only_once(): void
    {
        $user = User::factory()->client()->create();
        $payload = ['email' => $user->email, 'code' => $this->requestCode($user), 'password' => 'nouveau123', 'password_confirmation' => 'nouveau123'];

        $this->postJson('/api/auth/reset-password', $payload)->assertOk();
        $this->postJson('/api/auth/reset-password', $payload)->assertUnprocessable()->assertJsonValidationErrors('code');
    }

    public function test_the_code_is_cancelled_after_five_wrong_attempts(): void
    {
        $user = User::factory()->client()->create();
        $code = $this->requestCode($user);

        for ($i = 0; $i < 4; $i++) {
            $this->postJson('/api/auth/verify-reset-code', ['email' => $user->email, 'code' => $this->wrongCode($code)])->assertUnprocessable();
        }
        $this->postJson('/api/auth/verify-reset-code', ['email' => $user->email, 'code' => $this->wrongCode($code)])
            ->assertJsonPath('errors.code.0', 'Trop de codes incorrects. Ce code est annulé : demandez un nouveau code.');

        // Even the right code no longer works.
        $this->postJson('/api/auth/verify-reset-code', ['email' => $user->email, 'code' => $code])->assertUnprocessable();
    }

    public function test_a_mail_failure_returns_a_clear_message_and_cancels_the_code(): void
    {
        $user = User::factory()->client()->create();
        Notification::shouldReceive('send')->andThrow(new \RuntimeException('535 Username and Password not accepted'));

        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])
            ->assertStatus(503)
            ->assertJsonPath('message', "L'email n'a pas pu être envoyé pour le moment. Réessayez dans quelques minutes.");

        $this->assertDatabaseMissing('email_codes', ['email' => $user->email]);
    }

    public function test_an_expired_code_is_rejected(): void
    {
        $user = User::factory()->client()->create();
        $code = $this->requestCode($user);

        $this->travel(16)->minutes();

        $this->postJson('/api/auth/verify-reset-code', ['email' => $user->email, 'code' => $code])
            ->assertUnprocessable()
            ->assertJsonPath('errors.code.0', 'Ce code a expiré ou n\'existe pas. Demandez un nouveau code.');
    }
}
