<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\Geocoder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    private const PRESTATAIRE_FIELDS = [
        'specialite', 'description', 'experience_annees', 'certifications',
        'tarif_horaire', 'disponibilites', 'categorie_service_id',
    ];

    public function update(Request $request, Geocoder $geocoder): UserResource
    {
        $user = $request->user();

        $rules = [
            'nom' => ['sometimes', 'required', 'string', 'max:255'],
            'telephone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'gouvernorat' => ['sometimes', 'nullable', Rule::in(User::GOUVERNORATS)],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
        ];

        if ($user->isPrestataire()) {
            $rules += [
                'specialite' => ['sometimes', 'nullable', 'string', 'max:255'],
                'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
                'experience_annees' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:60'],
                'certifications' => ['sometimes', 'nullable', 'string', 'max:255'],
                'tarif_horaire' => ['sometimes', 'nullable', 'numeric', 'min:0'],
                'disponibilites' => ['sometimes', 'nullable', 'string', 'max:255'],
                'categorie_service_id' => ['sometimes', 'nullable', 'integer', 'exists:categories_services,id'],
            ];
        }

        $data = $request->validate($rules);

        // A new address saved without GPS coordinates (« Utiliser ma position » not used): find them from the
        // address, so that distances match it. Never keep the coordinates of the previous address.
        $nouvelleAdresse = array_key_exists('address', $data) && $data['address'] !== $user->address;
        $sansCoordonnees = ($data['latitude'] ?? null) === null || ($data['longitude'] ?? null) === null;
        if ($nouvelleAdresse && $sansCoordonnees) {
            $point = $data['address'] ? $geocoder->geocode($data['address'], $data['gouvernorat'] ?? $user->gouvernorat) : null;
            $data['latitude'] = $point['lat'] ?? null;
            $data['longitude'] = $point['lng'] ?? null;
        }

        $user->update(Arr::except($data, self::PRESTATAIRE_FIELDS));

        if ($user->isPrestataire()) {
            $profileData = Arr::only($data, self::PRESTATAIRE_FIELDS);
            // Non-nullable numeric columns: treat null as 0.
            foreach (['experience_annees', 'tarif_horaire'] as $field) {
                if (array_key_exists($field, $profileData) && $profileData[$field] === null) {
                    $profileData[$field] = 0;
                }
            }
            $user->prestataireProfile()->updateOrCreate(['user_id' => $user->id], $profileData);
        }

        return new UserResource($user->fresh()->load('prestataireProfile.categorie'));
    }

    public function photo(Request $request): UserResource
    {
        $request->validate([
            'photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ], [
            'photo.max' => __('La photo ne doit pas dépasser 2 Mo.'),
            'photo.image' => __('La photo doit être une image JPG, PNG ou WebP.'),
            'photo.mimes' => __('La photo doit être une image JPG, PNG ou WebP.'),
        ]);

        $user = $request->user();
        $old = $user->photo_path;

        $user->update(['photo_path' => $request->file('photo')->store('photos', 'public')]);

        if ($old) {
            Storage::disk('public')->delete($old);
        }

        return new UserResource($user->load('prestataireProfile.categorie'));
    }

    public function password(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = $request->user();

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => [__('Le mot de passe actuel est incorrect.')],
            ]);
        }

        $user->update(['password' => $data['password']]);

        return response()->json(['message' => __('Mot de passe modifié avec succès.')]);
    }

    public function availability(Request $request): UserResource
    {
        $data = $request->validate(['is_available' => ['required', 'boolean']]);

        $user = $request->user();
        $user->prestataireProfile()->updateOrCreate(['user_id' => $user->id], ['is_available' => $data['is_available']]);

        return new UserResource($user->load('prestataireProfile.categorie'));
    }
}
