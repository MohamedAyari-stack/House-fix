<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Paiement extends Model
{
    protected $fillable = ['facture_id', 'montant', 'mode', 'statut', 'reference', 'card_last4'];

    protected function casts(): array
    {
        return ['montant' => 'float'];
    }

    public static function newReference(): string
    {
        do {
            $reference = 'PAY-'.strtoupper(Str::random(6));
        } while (static::where('reference', $reference)->exists());

        return $reference;
    }

    public function facture(): BelongsTo
    {
        return $this->belongsTo(Facture::class);
    }
}
