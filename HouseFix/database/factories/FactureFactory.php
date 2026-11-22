<?php

namespace Database\Factories;

use App\Models\Facture;
use App\Models\RendezVous;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Facture>
 */
class FactureFactory extends Factory
{
    public function definition(): array
    {
        return [
            'numero' => fn () => Facture::nextNumero(),
            'rendez_vous_id' => RendezVous::factory()->status('facture'),
            'client_id' => fn (array $attrs) => RendezVous::find($attrs['rendez_vous_id'])->client_id,
            'prestataire_id' => fn (array $attrs) => RendezVous::find($attrs['rendez_vous_id'])->prestataire_id,
            'montant' => fake()->randomFloat(2, 30, 300),
            'details' => fake()->sentence(),
            'date' => now()->toDateString(),
            'statut_paiement' => 'non_payee',
        ];
    }
}
