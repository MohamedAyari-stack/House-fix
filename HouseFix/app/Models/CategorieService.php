<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/** Service category, named in French (nom) and optionally in Arabic (nom_ar) and English (nom_en). */
class CategorieService extends Model
{
    use HasFactory;

    protected $table = 'categories_services';

    protected $fillable = ['nom', 'nom_ar', 'nom_en', 'description', 'description_ar', 'description_en', 'icone', 'taux_tva_id'];

    /** The slug (URL of the public page /services/{slug}) follows the French name, and stays unique. */
    protected static function booted(): void
    {
        static::saving(function (CategorieService $categorie) {
            if ($categorie->slug && ! $categorie->isDirty('nom')) {
                return;
            }
            $base = Str::slug($categorie->nom) ?: 'service';
            $slug = $base;
            for ($i = 2; static::where('slug', $slug)->whereKeyNot($categorie->getKey())->exists(); $i++) {
                $slug = "$base-$i";
            }
            $categorie->slug = $slug;
        });
    }

    public function tauxTva(): BelongsTo
    {
        return $this->belongsTo(TauxTva::class, 'taux_tva_id');
    }

    public function prestataires(): HasMany
    {
        return $this->hasMany(PrestataireProfile::class, 'categorie_service_id');
    }

    public function rendezVous(): HasMany
    {
        return $this->hasMany(RendezVous::class, 'categorie_service_id');
    }

    /** Name in the current language, falling back to French. Keep "nom" (French) for the AI service. */
    public function localizedNom(): string
    {
        return $this->localized('nom') ?: $this->nom;
    }

    public function localizedDescription(): ?string
    {
        return $this->localized('description') ?: $this->description;
    }

    /** {id, nom} embedded in other resources, nom in the current language. */
    public function summary(): array
    {
        return ['id' => $this->id, 'nom' => $this->localizedNom()];
    }

    /** nom_ar / nom_en (or description_*) for the current locale; null in French. */
    private function localized(string $field): ?string
    {
        $locale = app()->getLocale();

        return in_array($locale, ['ar', 'en'], true) ? $this->{$field.'_'.$locale} : null;
    }
}
