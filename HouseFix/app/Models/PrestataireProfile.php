<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrestataireProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'categorie_service_id', 'specialite', 'description', 'experience_annees',
        'certifications', 'tarif_horaire', 'is_available', 'disponibilites', 'note_moyenne',
        'nb_avis', 'validation_status', 'motif_refus',
    ];

    protected function casts(): array
    {
        return [
            'experience_annees' => 'integer',
            'tarif_horaire' => 'float',
            'is_available' => 'boolean',
            'note_moyenne' => 'float',
            'nb_avis' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function categorie(): BelongsTo
    {
        return $this->belongsTo(CategorieService::class, 'categorie_service_id');
    }

    /** Recomputes note_moyenne / nb_avis from the evaluations received by this prestataire. */
    public function recalculerNote(): void
    {
        $query = Evaluation::where('prestataire_id', $this->user_id);

        $this->update([
            'note_moyenne' => round((float) $query->avg('note'), 2),
            'nb_avis' => $query->count(),
        ]);
    }
}
