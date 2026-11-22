<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class RendezVous extends Model
{
    use HasFactory;

    public const STATUSES = ['en_attente', 'accepte', 'refuse', 'annule_par_client', 'termine', 'facture'];

    protected $table = 'rendez_vous';

    protected $fillable = [
        'client_id', 'prestataire_id', 'categorie_service_id', 'date', 'heure', 'description',
        'address', 'latitude', 'longitude', 'status', 'motif_refus',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function prestataire(): BelongsTo
    {
        return $this->belongsTo(User::class, 'prestataire_id');
    }

    public function categorie(): BelongsTo
    {
        return $this->belongsTo(CategorieService::class, 'categorie_service_id');
    }

    public function facture(): HasOne
    {
        return $this->hasOne(Facture::class);
    }

    public function evaluation(): HasOne
    {
        return $this->hasOne(Evaluation::class);
    }

    public function isParticipant(User $user): bool
    {
        return $user->id === $this->client_id || $user->id === $this->prestataire_id;
    }

    /** The other party of the appointment, seen from $user. */
    public function otherPartyId(User $user): int
    {
        return $user->id === $this->client_id ? $this->prestataire_id : $this->client_id;
    }
}
