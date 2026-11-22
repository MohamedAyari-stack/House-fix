<?php

namespace App\Notifications;

use App\Services\EmailCodes;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Email containing a 6-digit code: email verification at sign-up, or password reset.
 * Rendered in the recipient's language (User::preferredLocale()).
 */
class EmailCode extends Notification
{
    public function __construct(
        public readonly string $code,
        public readonly string $purpose,
        private readonly int $expireMinutes,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $verify = $this->purpose === EmailCodes::VERIFY;

        return (new MailMessage)
            ->subject($verify
                ? __(':code est votre code de vérification — DarFix', ['code' => $this->code])
                : __(':code est votre code de réinitialisation — DarFix', ['code' => $this->code]))
            ->greeting(__('Bonjour :nom,', ['nom' => $notifiable->nom]))
            ->line($verify
                ? __('Bienvenue sur DarFix ! Pour activer votre compte, saisissez ce code dans l\'application :')
                : __('Vous avez demandé à réinitialiser le mot de passe de votre compte DarFix. Saisissez ce code dans l\'application :'))
            ->line('# '.implode(' ', str_split($this->code)))
            ->line(__('Ce code expire dans :minutes minutes.', ['minutes' => $this->expireMinutes]))
            ->line($verify
                ? __("Si vous n'avez pas créé de compte DarFix, ignorez cet email.")
                : __("Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé."))
            ->salutation(__("L'équipe DarFix"));
    }
}
