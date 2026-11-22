<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\User;
use App\Notifications\AppNotificationMail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use RuntimeException;
use Tests\TestCase;

class EmailNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_validating_a_prestataire_emails_them(): void
    {
        Notification::fake();
        $pending = User::factory()->prestataire('en_attente')->create();
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->postJson("/api/admin/prestataires/{$pending->id}/valider")->assertOk();

        Notification::assertSentTo($pending, AppNotificationMail::class, function (AppNotificationMail $mail) use ($pending) {
            $message = $mail->toMail($pending);

            return str_contains($message->subject, 'Compte validé')
                && str_starts_with((string) $message->actionUrl, config('app.frontend_url').'/prestataire');
        });
    }

    public function test_chat_messages_stay_in_app_only(): void
    {
        Notification::fake();
        $user = User::factory()->client()->create();

        AppNotification::send($user, 'Nouveau message', 'Ali vous a envoyé un message.', 'message', '/messages');

        $this->assertDatabaseHas('app_notifications', ['user_id' => $user->id, 'type' => 'message']);
        Notification::assertNothingSent();
    }

    public function test_a_mail_failure_does_not_block_the_notification(): void
    {
        $user = User::factory()->client()->create();
        Notification::shouldReceive('send')->andThrow(new RuntimeException('Serveur SMTP injoignable'));

        $notification = AppNotification::send($user, 'Rendez-vous accepté', 'Votre rendez-vous est confirmé.', 'rdv', '/rendez-vous');

        $this->assertTrue($notification->exists);
        $this->assertSame('/client/rendez-vous', $notification->lien);
    }
}
