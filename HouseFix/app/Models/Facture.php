<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Facture extends Model
{
    use HasFactory;

    protected $fillable = [
        'numero', 'rendez_vous_id', 'client_id', 'prestataire_id', 'montant', 'montant_ht', 'taux_tva', 'montant_tva', 'details', 'date',
        'statut_paiement', 'mode_paiement', 'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'montant' => 'float',
            'montant_ht' => 'float',
            'taux_tva' => 'float',
            'montant_tva' => 'float',
            'paid_at' => 'datetime',
        ];
    }

    /** Next sequential invoice number for the given year, e.g. FAC-2026-0001. */
    public static function nextNumero(?int $year = null): string
    {
        $year ??= (int) now()->format('Y');
        $prefix = "FAC-{$year}-";

        $last = static::where('numero', 'like', $prefix.'%')->orderByDesc('numero')->value('numero');
        $seq = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
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

    public function paiements(): HasMany
    {
        return $this->hasMany(Paiement::class)->orderBy('id');
    }

    public function isParticipant(User $user): bool
    {
        return $user->id === $this->client_id || $user->id === $this->prestataire_id;
    }
}
