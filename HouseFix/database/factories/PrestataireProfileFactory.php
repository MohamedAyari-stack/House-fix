<?php

namespace Database\Factories;

use App\Models\CategorieService;
use App\Models\PrestataireProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PrestataireProfile>
 */
class PrestataireProfileFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->state(['role' => User::ROLE_PRESTATAIRE]),
            'categorie_service_id' => CategorieService::factory(),
            'specialite' => fake()->jobTitle(),
            'description' => fake()->sentence(12),
            'experience_annees' => fake()->numberBetween(1, 20),
            'certifications' => null,
            'tarif_horaire' => fake()->randomElement([25, 30, 35, 40, 45, 50]),
            'is_available' => true,
            'disponibilites' => 'Lun-Sam 08:00-18:00',
            'note_moyenne' => 0,
            'nb_avis' => 0,
            'validation_status' => 'valide',
        ];
    }
}
