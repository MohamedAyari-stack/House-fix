<?php

namespace Database\Factories;

use App\Models\CategorieService;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CategorieService>
 */
class CategorieServiceFactory extends Factory
{
    public function definition(): array
    {
        return [
            'nom' => ucfirst(fake()->unique()->word()).' '.fake()->unique()->numberBetween(1, 99999),
            'description' => fake()->sentence(),
            'icone' => 'bi-tools',
        ];
    }
}
