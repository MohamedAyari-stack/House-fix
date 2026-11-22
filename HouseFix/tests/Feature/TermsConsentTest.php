<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class TermsConsentTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $overrides = []): array
    {
        return $overrides + [
            'nom' => 'Salma Ben Ali',
            'email' => 'salma@example.tn',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
            'telephone' => '+216 20 000 000',
            'gouvernorat' => 'Sousse',
            'role' => 'client',
            'accepte_conditions' => true,
            'terms_version' => config('app.terms_version'),
        ];
    }

    public function test_registration_records_when_and_which_terms_were_accepted(): void
    {
        Notification::fake();
        $this->freezeSecond();

        $this->postJson('/api/auth/register', $this->payload())->assertCreated();

        $user = User::where('email', 'salma@example.tn')->first();
        $this->assertSame(config('app.terms_version'), $user->terms_version);
        $this->assertTrue($user->terms_accepted_at->equalTo(now()));
    }

    public function test_registration_is_refused_without_consent(): void
    {
        $this->postJson('/api/auth/register', $this->payload(['accepte_conditions' => false]))
            ->assertUnprocessable()
            ->assertJsonPath('errors.accepte_conditions.0', "Vous devez accepter les conditions d'utilisation et la politique de confidentialité pour créer un compte.");

        $this->assertDatabaseMissing('users', ['email' => 'salma@example.tn']);
    }

    public function test_an_outdated_version_of_the_terms_is_refused(): void
    {
        $this->postJson('/api/auth/register', $this->payload(['terms_version' => '2020-01-01']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('terms_version');
    }

    public function test_the_consent_error_is_translated(): void
    {
        $this->postJson('/api/auth/register', $this->payload(['accepte_conditions' => false]), ['Accept-Language' => 'en'])
            ->assertJsonPath('errors.accepte_conditions.0', 'You must accept the Terms of Use and the Privacy Policy to create an account.');
        $this->postJson('/api/auth/register', $this->payload(['accepte_conditions' => false]), ['Accept-Language' => 'ar'])
            ->assertJsonPath('errors.accepte_conditions.0', 'يجب الموافقة على شروط الاستخدام وسياسة الخصوصية لإنشاء حساب.');
    }
}
