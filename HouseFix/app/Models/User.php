<?php

namespace App\Models;

use App\Http\Middleware\SetLocale;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Translation\HasLocalePreference;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements HasLocalePreference
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLE_CLIENT = 'client';

    public const ROLE_PRESTATAIRE = 'prestataire';

    public const ROLE_ADMIN = 'admin';

    public const GOUVERNORATS = [
        'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba', 'Kairouan',
        'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'La Manouba', 'Médenine', 'Monastir', 'Nabeul',
        'Sfax', 'Sidi Bouzid', 'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
    ];

    protected $fillable = [
        'nom', 'email', 'password', 'telephone', 'gouvernorat', 'locale', 'role', 'statut',
        'is_verified', 'is_blocked', 'blocked_until', 'block_motif', 'photo_path',
        'address', 'latitude', 'longitude',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'email_verified_at' => 'datetime',
            'terms_accepted_at' => 'datetime',
            'is_verified' => 'boolean',
            'is_blocked' => 'boolean',
            'blocked_until' => 'datetime',
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    public function prestataireProfile(): HasOne
    {
        return $this->hasOne(PrestataireProfile::class);
    }

    public function rendezVousClient(): HasMany
    {
        return $this->hasMany(RendezVous::class, 'client_id');
    }

    public function rendezVousPrestataire(): HasMany
    {
        return $this->hasMany(RendezVous::class, 'prestataire_id');
    }

    /** Invoices issued by this prestataire. */
    public function facturesPrestataire(): HasMany
    {
        return $this->hasMany(Facture::class, 'prestataire_id');
    }

    public function evaluationsRecues(): HasMany
    {
        return $this->hasMany(Evaluation::class, 'prestataire_id');
    }

    public function appNotifications(): HasMany
    {
        return $this->hasMany(AppNotification::class);
    }

    /** Email address confirmed with the code sent at sign-up (distinct from is_verified, the admin's validation). */
    public function hasVerifiedEmail(): bool
    {
        return $this->email_verified_at !== null;
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function isClient(): bool
    {
        return $this->role === self::ROLE_CLIENT;
    }

    public function isPrestataire(): bool
    {
        return $this->role === self::ROLE_PRESTATAIRE;
    }

    /** Name shown publicly (reviews on public pages): "Mohamed Ayari" → "Mohamed A.". */
    public static function publicName(?string $nom): string
    {
        $parts = preg_split('/\s+/', trim((string) $nom)) ?: [];
        $first = Str::ucfirst($parts[0] ?? 'Client');
        $last = isset($parts[1]) ? ' '.Str::upper(Str::substr($parts[1], 0, 1)).'.' : '';

        return $first.$last;
    }

    public function photoUrl(): ?string
    {
        return $this->photo_path ? asset('storage/'.$this->photo_path) : null;
    }

    /**
     * Lifts an expired temporary block. Returns true if the user is (still) blocked.
     */
    public function checkBlocked(): bool
    {
        if (! $this->is_blocked) {
            return false;
        }

        if ($this->blocked_until && $this->blocked_until->isPast()) {
            $this->unblock();

            return false;
        }

        return true;
    }

    public function unblock(): void
    {
        $this->forceFill([
            'is_blocked' => false,
            'statut' => 'actif',
            'blocked_until' => null,
            'block_motif' => null,
        ])->save();
    }

    /** Language of the emails and notifications sent to the user (Laravel uses it for mail notifications). */
    public function preferredLocale(): string
    {
        return $this->locale ?? SetLocale::DEFAULT;
    }

    public function blockedMessage(): string
    {
        $message = $this->blocked_until
            ? __('Votre compte est suspendu jusqu\'au :date.', ['date' => $this->blocked_until->format('d/m/Y')])
            : __('Votre compte a été bloqué définitivement.');

        return $this->block_motif ? $message.' '.__('Motif : :motif', ['motif' => $this->block_motif]) : $message;
    }
}
