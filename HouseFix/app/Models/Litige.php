<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Litige extends Model
{
    public const STATUTS = ['ouvert', 'en_cours', 'resolu', 'rejete'];

    protected $fillable = [
        'rendez_vous_id', 'declarant_id', 'cible_id', 'sujet', 'description', 'statut',
        'reponse_admin', 'traite_par', 'traite_le',
    ];

    protected function casts(): array
    {
        return ['traite_le' => 'datetime'];
    }

    public function rendezVous(): BelongsTo
    {
        return $this->belongsTo(RendezVous::class);
    }

    public function declarant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'declarant_id');
    }

    public function cible(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cible_id');
    }

    public function traitePar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'traite_par');
    }
}
