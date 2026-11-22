<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TauxTva extends Model
{
    protected $table = 'taux_tva';

    protected $fillable = ['libelle', 'taux', 'par_defaut'];

    protected function casts(): array
    {
        return ['taux' => 'float', 'par_defaut' => 'boolean'];
    }

    public static function parDefaut(): ?self
    {
        return static::where('par_defaut', true)->first();
    }

    public function categories(): HasMany
    {
        return $this->hasMany(CategorieService::class, 'taux_tva_id');
    }
}
