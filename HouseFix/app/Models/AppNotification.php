<?php

namespace App\Models;

use App\Notifications\AppNotificationMail;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Throwable;

class AppNotification extends Model
{
    /** Types that stay in the app only, without an email copy (chat messages would flood the inbox). */
    public const IN_APP_ONLY = ['message'];

    protected $table = 'app_notifications';

    protected $fillable = ['user_id', 'titre', 'message', 'type', 'lien', 'lu'];

    protected function casts(): array
    {
        return ['lu' => 'boolean'];
    }

    /**
     * Creates an in-app notification for a user (or user id).
     * $titre and $message are French translation keys (lang/*.json) sharing the :placeholders of $params;
     * they are translated in the RECIPIENT's language, whatever the language of the current request.
     * $message may be a list of keys, joined with a space (e.g. a sentence followed by an optional "Motif : :motif").
     * A role-neutral link such as "/messages" is prefixed with the recipient's
     * space ("/client/messages", "/prestataire/messages"…) to match the Angular routes.
     * An email copy is also sent, except for the IN_APP_ONLY types.
     */
    public static function send(User|int $user, string $titre, string|array $message, string $type = 'info', ?string $lien = null, array $params = []): self
    {
        $user = $user instanceof User ? $user : User::find($user);
        $locale = $user?->preferredLocale() ?? app()->getLocale();

        if ($lien && $user && ! preg_match('#^/(client|prestataire|admin)(/|$)#', $lien)) {
            $lien = '/'.$user->role.$lien;
        }

        $notification = static::create([
            'user_id' => $user?->id,
            'titre' => __($titre, $params, $locale),
            'message' => collect((array) $message)->map(fn (string $key) => __($key, $params, $locale))->implode(' '),
            'type' => $type,
            'lien' => $lien,
        ]);

        if ($user && ! in_array($type, self::IN_APP_ONLY, true)) {
            $notification->sendEmail($user);
        }

        return $notification;
    }

    /** Sends the email copy; a mail server failure must never block the business action. */
    private function sendEmail(User $user): void
    {
        try {
            $user->notify(new AppNotificationMail($this));
        } catch (Throwable $e) {
            report($e);
        }
    }

    /** Notifies every admin account, each in their own language. */
    public static function sendToAdmins(string $titre, string|array $message, string $type = 'info', ?string $lien = null, array $params = []): void
    {
        User::where('role', User::ROLE_ADMIN)->get()
            ->each(fn (User $admin) => static::send($admin, $titre, $message, $type, $lien, $params));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
