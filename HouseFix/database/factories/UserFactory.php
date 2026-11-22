<?php

namespace Database\Factories;

use App\Models\PrestataireProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    public function definition(): array
    {
        return [
            'nom' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'telephone' => '+216 '.fake()->numerify('## ### ###'),
            'gouvernorat' => fake()->randomElement(User::GOUVERNORATS),
            'role' => User::ROLE_CLIENT,
            'statut' => 'actif',
            'is_verified' => true,
            'is_blocked' => false,
            'address' => fake()->streetAddress(),
            'latitude' => null,
            'longitude' => null,
            'remember_token' => Str::random(10),
        ];
    }

    /** Account whose owner has not entered the verification code yet. */
    public function unverified(): static
    {
        return $this->state(fn () => ['email_verified_at' => null]);
    }

    public function client(): static
    {
        return $this->state(fn () => ['role' => User::ROLE_CLIENT, 'is_verified' => true]);
    }

    public function admin(): static
    {
        return $this->state(fn () => ['role' => User::ROLE_ADMIN, 'is_verified' => true]);
    }

    /** A prestataire with a profile in the given validation status. */
    public function prestataire(string $validationStatus = 'valide', array $profile = []): static
    {
        return $this->state(fn () => [
            'role' => User::ROLE_PRESTATAIRE,
            'is_verified' => $validationStatus === 'valide',
        ])->afterCreating(function (User $user) use ($validationStatus, $profile) {
            PrestataireProfile::factory()->create($profile + [
                'user_id' => $user->id,
                'validation_status' => $validationStatus,
            ]);
        });
    }

    public function blocked(?\DateTimeInterface $until = null): static
    {
        return $this->state(fn () => [
            'is_blocked' => true,
            'statut' => $until ? 'suspendu' : 'bloque',
            'blocked_until' => $until,
        ]);
    }
}
