<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Evaluation extends Model
{
    protected $fillable = ['rendez_vous_id', 'client_id', 'prestataire_id', 'note', 'commentaire', 'reponse'];

    protected function casts(): array
    {
        return ['note' => 'integer'];
    }

    public function rendezVous(): BelongsTo
    {
        return $this->belongsTo(RendezVous::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function prestataire(): BelongsTo
    {
        return $this->belongsTo(User::class, 'prestataire_id');
    }

    /** Refreshes the rating aggregates on the prestataire's profile. */
    public static function refreshNoteFor(int $prestataireId): void
    {
        PrestataireProfile::where('user_id', $prestataireId)->first()?->recalculerNote();
    }
}
