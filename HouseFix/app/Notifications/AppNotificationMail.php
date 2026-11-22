<?php

namespace App\Notifications;

use App\Models\AppNotification;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Email copy of an in-app notification (rendez-vous, facture, compte, litige…).
 * Title and message are stored already translated; the fixed parts render in the
 * recipient's language (User::preferredLocale()).
 */
class AppNotificationMail extends Notification
{
    public function __construct(private readonly AppNotification $notification) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject(__(':titre — DarFix', ['titre' => $this->notification->titre]))
            ->greeting(__('Bonjour :nom,', ['nom' => $notifiable->nom]))
            ->line($this->notification->message);

        if ($this->notification->lien) {
            $mail->action(__('Ouvrir DarFix'), config('app.frontend_url').$this->notification->lien);
        }

        return $mail->salutation(__("L'équipe DarFix"));
    }
}
