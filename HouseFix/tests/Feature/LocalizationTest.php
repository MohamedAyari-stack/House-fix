<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\CategorieService;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Accept-Language fr|ar|en: API messages, validation, stored locale, notifications and multilingual categories. */
class LocalizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_validation_errors_follow_accept_language(): void
    {
        $this->postJson('/api/auth/register', [], ['Accept-Language' => 'ar'])
            ->assertStatus(422)
            ->assertJsonPath('errors.nom.0', 'حقل الاسم إجباري.')
            ->assertJsonPath('errors.email.0', 'حقل البريد الإلكتروني إجباري.');

        $this->postJson('/api/auth/register', [], ['Accept-Language' => 'fr'])
            ->assertStatus(422)
            ->assertJsonPath('errors.nom.0', 'Le champ nom est obligatoire.');

        $this->postJson('/api/auth/register', [], ['Accept-Language' => 'en-US,en;q=0.9'])
            ->assertStatus(422)
            ->assertJsonPath('errors.nom.0', 'The name field is required.')
            ->assertJsonPath('errors.email.0', 'The email address field is required.');

        // Regional variants and q-values are understood; an unsupported language falls back to French
        // (not to the previous request's language).
        $this->postJson('/api/auth/register', [], ['Accept-Language' => 'ar-TN,ar;q=0.9,fr;q=0.8'])
            ->assertJsonPath('errors.nom.0', 'حقل الاسم إجباري.');
        $this->postJson('/api/auth/register', [], ['Accept-Language' => 'de-DE'])
            ->assertJsonPath('errors.nom.0', 'Le champ nom est obligatoire.');
    }

    public function test_api_messages_are_translated(): void
    {
        User::factory()->create(['email' => 'client@housefix.tn']);
        $wrong = ['email' => 'client@housefix.tn', 'password' => 'faux'];

        $this->postJson('/api/auth/login', $wrong, ['Accept-Language' => 'ar'])
            ->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
        $this->postJson('/api/auth/login', $wrong, ['Accept-Language' => 'fr'])
            ->assertJsonPath('errors.email.0', 'Adresse e-mail ou mot de passe incorrect.');
        $this->postJson('/api/auth/login', $wrong, ['Accept-Language' => 'en'])
            ->assertJsonPath('errors.email.0', 'Incorrect email address or password.');

        $this->getJson('/api/auth/me', ['Accept-Language' => 'ar'])
            ->assertUnauthorized()->assertJson(['message' => 'يجب تسجيل الدخول أولًا.']);
        $this->getJson('/api/route-inconnue', ['Accept-Language' => 'ar'])
            ->assertNotFound()->assertJson(['message' => 'المورد المطلوب غير موجود.']);
        $this->getJson('/api/route-inconnue', ['Accept-Language' => 'en'])
            ->assertNotFound()->assertJson(['message' => 'Resource not found.']);
    }

    public function test_logout_message_and_user_locale_follow_the_header(): void
    {
        $user = User::factory()->create(['email' => 'client@housefix.tn']);
        $this->assertSame('fr', $user->fresh()->locale);
        $token = $this->postJson('/api/auth/login', ['email' => 'client@housefix.tn', 'password' => 'password'])->json('token');

        $this->withToken($token)->getJson('/api/auth/me', ['Accept-Language' => 'ar'])
            ->assertOk()->assertJsonPath('locale', 'ar');
        $this->assertSame('ar', $user->fresh()->locale);

        // Unsupported (or missing) language: the stored one is kept.
        $this->withToken($token)->getJson('/api/notifications', ['Accept-Language' => 'de'])->assertOk();
        $this->assertSame('ar', $user->fresh()->locale);

        $this->withToken($token)->getJson('/api/auth/me', ['Accept-Language' => 'en'])
            ->assertOk()->assertJsonPath('locale', 'en');
        $this->assertSame('en', $user->fresh()->locale);

        $this->withToken($token)->postJson('/api/auth/logout', [], ['Accept-Language' => 'ar'])
            ->assertOk()->assertJson(['message' => 'تم تسجيل الخروج بنجاح.']);
    }

    public function test_registration_stores_the_request_locale(): void
    {
        Notification::fake();

        $this->postJson('/api/auth/register', [
            'nom' => 'Salma Ben Ali', 'email' => 'salma@example.tn',
            'password' => 'secret123', 'password_confirmation' => 'secret123',
            'accepte_conditions' => true, 'terms_version' => config('app.terms_version'),
            'telephone' => '+216 20 000 000', 'gouvernorat' => 'Sousse', 'role' => 'client',
        ], ['Accept-Language' => 'ar'])
            ->assertCreated()
            ->assertJsonPath('message', 'تم إنشاء الحساب. أُرسل رمز التحقق إلى salma@example.tn.');

        $this->assertSame('ar', User::where('email', 'salma@example.tn')->value('locale'));
    }

    public function test_notification_is_stored_and_emailed_in_the_recipients_language(): void
    {
        $pending = User::factory()->prestataire('en_attente')->create(['locale' => 'ar']);
        Sanctum::actingAs(User::factory()->admin()->create());

        // The admin works in French...
        $this->postJson("/api/admin/prestataires/{$pending->id}/valider", [], ['Accept-Language' => 'fr'])->assertOk();

        // ...but the prestataire reads Arabic.
        $notification = AppNotification::where('user_id', $pending->id)->sole();
        $this->assertSame('تمت المصادقة على الحساب', $notification->titre);
        $this->assertStringStartsWith('تهانينا!', $notification->message);

        $email = Mail::mailer()->getSymfonyTransport()->messages()->last()->getOriginalMessage();
        $this->assertSame('تمت المصادقة على الحساب — DarFix', $email->getSubject());
        $this->assertStringContainsString('مرحبًا '.$pending->nom.'،', $email->getHtmlBody());
        $this->assertStringContainsString('فتح DarFix', $email->getHtmlBody());
    }

    public function test_notification_placeholders_are_filled_in_each_language(): void
    {
        $ar = User::factory()->client()->create(['locale' => 'ar']);
        $fr = User::factory()->client()->create(['locale' => 'fr']);
        $en = User::factory()->client()->create(['locale' => 'en']);

        foreach ([$ar, $fr, $en] as $user) {
            AppNotification::send($user, 'Nouvelle facture', 'Facture :numero de :montant DT émise par :nom.', 'facture', '/factures',
                ['numero' => 'FAC-2026-0001', 'montant' => '80,00', 'nom' => 'Karim']);
        }

        $this->assertSame('فاتورة FAC-2026-0001 بمبلغ 80,00 د.ت أصدرها Karim.', $ar->appNotifications()->value('message'));
        $this->assertSame('Facture FAC-2026-0001 de 80,00 DT émise par Karim.', $fr->appNotifications()->value('message'));
        $this->assertSame('New invoice', $en->appNotifications()->value('titre'));
        $this->assertSame('Invoice FAC-2026-0001 of 80,00 TND issued by Karim.', $en->appNotifications()->value('message'));
    }

    public function test_categories_are_multilingual(): void
    {
        CategorieService::factory()->create([
            'nom' => 'Plomberie', 'nom_ar' => 'سباكة', 'nom_en' => 'Plumbing',
            'description' => 'Fuites et canalisations.', 'description_ar' => 'التسرّبات والقنوات.', 'description_en' => 'Leaks and pipes.',
        ]);
        CategorieService::factory()->create(['nom' => 'Vitrerie', 'description' => 'Vitres.']);

        $this->getJson('/api/categories', ['Accept-Language' => 'ar'])->assertOk()
            ->assertJsonFragment(['nom' => 'سباكة', 'description' => 'التسرّبات والقنوات.', 'nom_fr' => 'Plomberie', 'nom_ar' => 'سباكة'])
            // No translation yet: French is shown.
            ->assertJsonFragment(['nom' => 'Vitrerie', 'nom_ar' => null]);

        $this->getJson('/api/categories', ['Accept-Language' => 'en'])->assertOk()
            ->assertJsonFragment(['nom' => 'Plumbing', 'description' => 'Leaks and pipes.', 'nom_fr' => 'Plomberie', 'nom_en' => 'Plumbing', 'description_en' => 'Leaks and pipes.'])
            ->assertJsonFragment(['nom' => 'Vitrerie', 'nom_en' => null]);

        $this->getJson('/api/categories', ['Accept-Language' => 'fr'])->assertOk()
            ->assertJsonFragment([
                'nom' => 'Plomberie', 'description' => 'Fuites et canalisations.',
                'nom_fr' => 'Plomberie', 'nom_ar' => 'سباكة', 'nom_en' => 'Plumbing',
                'description_fr' => 'Fuites et canalisations.', 'description_ar' => 'التسرّبات والقنوات.', 'description_en' => 'Leaks and pipes.',
            ]);
    }

    public function test_admin_saves_the_translated_names(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());

        $id = $this->postJson('/api/admin/categories', [
            'nom' => 'Vitrerie', 'nom_ar' => 'بلّور', 'description_ar' => 'تركيب البلّور.', 'nom_en' => 'Glazing', 'description_en' => 'Glass fitting.',
        ])
            ->assertCreated()
            ->assertJson([
                'nom' => 'Vitrerie', 'nom_fr' => 'Vitrerie', 'nom_ar' => 'بلّور', 'description_ar' => 'تركيب البلّور.',
                'nom_en' => 'Glazing', 'description_en' => 'Glass fitting.',
            ])
            ->json('id');

        $this->putJson("/api/admin/categories/{$id}", ['nom' => 'Vitrerie', 'nom_ar' => 'بلّور ومرايا'], ['Accept-Language' => 'ar'])
            ->assertOk()->assertJsonPath('nom', 'بلّور ومرايا')->assertJsonPath('nom_fr', 'Vitrerie');

        $categorie = CategorieService::find($id);
        $this->assertSame('بلّور ومرايا', $categorie->nom_ar);
        // A PUT without nom_en keeps the English name.
        $this->assertSame('Glazing', $categorie->nom_en);
    }

    public function test_embedded_category_names_are_localized(): void
    {
        $categorie = CategorieService::factory()->create(['nom' => 'Plomberie', 'nom_ar' => 'سباكة', 'nom_en' => 'Plumbing']);
        $prestataire = User::factory()->prestataire('valide', ['categorie_service_id' => $categorie->id])->create();
        Sanctum::actingAs(User::factory()->client()->create());

        foreach (['ar' => 'سباكة', 'fr' => 'Plomberie', 'en' => 'Plumbing'] as $locale => $nom) {
            $this->getJson("/api/prestataires/{$prestataire->id}", ['Accept-Language' => $locale])
                ->assertOk()->assertJsonPath('prestataire.categorie.nom', $nom);
        }
    }
}
