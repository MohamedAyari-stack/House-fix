<?php

namespace Database\Factories;

use App\Models\CategorieService;
use App\Models\RendezVous;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RendezVous>
 */
class RendezVousFactory extends Factory
{
    public function definition(): array
    {
        return [
            'client_id' => User::factory()->client(),
            'prestataire_id' => User::factory()->prestataire(),
            'categorie_service_id' => CategorieService::factory(),
            'date' => now()->addDays(fake()->numberBetween(1, 30))->toDateString(),
            'heure' => '10:00',
            'description' => fake()->sentence(),
            'address' => fake()->streetAddress(),
            'status' => 'en_attente',
        ];
    }

    public function status(string $status): static
    {
        return $this->state(fn () => ['status' => $status]);
    }
}
