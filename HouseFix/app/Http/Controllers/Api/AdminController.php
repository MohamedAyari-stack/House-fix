<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\AppNotification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

class AdminController extends Controller
{
    private const WITH = ['prestataireProfile.categorie'];

    public function users(Request $request): AnonymousResourceCollection
    {
        $users = User::with(self::WITH)
            ->when($request->filled('role'), fn ($q) => $q->where('role', $request->query('role')))
            ->when($request->filled('q'), function ($q) use ($request) {
                $like = '%'.$request->query('q').'%';
                $q->where(fn ($w) => $w->where('nom', 'like', $like)->orWhere('email', 'like', $like));
            })
            ->latest()
            ->orderByDesc('id')
            ->get();

        return UserResource::collection($users);
    }

    public function prestataires(): AnonymousResourceCollection
    {
        return UserResource::collection(
            User::with(self::WITH)->where('role', User::ROLE_PRESTATAIRE)->orderBy('nom')->get()
        );
    }

    public function validations(): AnonymousResourceCollection
    {
        return UserResource::collection(
            User::with(self::WITH)
                ->where('role', User::ROLE_PRESTATAIRE)
                ->whereHas('prestataireProfile', fn ($q) => $q->where('validation_status', 'en_attente'))
                // An account appears in the queue once its owner has confirmed the email address.
                ->whereNotNull('email_verified_at')
                ->oldest()
                ->get()
        );
    }

    public function valider(int $id): UserResource
    {
        $user = $this->findPrestataire($id);

        $user->prestataireProfile()->updateOrCreate(['user_id' => $user->id], ['validation_status' => 'valide', 'motif_refus' => null]);
        $user->update(['is_verified' => true]);

        AppNotification::send($user, 'Compte validé',
            'Félicitations ! Votre profil prestataire a été validé. Vous êtes désormais visible par les clients.',
            'compte', '/prestataire');

        return new UserResource($user->fresh(self::WITH));
    }

    public function refuser(Request $request, int $id): UserResource
    {
        $data = $request->validate(['motif' => ['nullable', 'string', 'max:255']]);
        $user = $this->findPrestataire($id);

        $user->prestataireProfile()->updateOrCreate(['user_id' => $user->id], [
            'validation_status' => 'refuse',
            'motif_refus' => $data['motif'] ?? null,
        ]);
        $user->update(['is_verified' => false]);

        AppNotification::send($user, 'Compte refusé',
            array_filter(['Votre demande de validation a été refusée.', ! empty($data['motif']) ? 'Motif : :motif' : null]),
            'compte', '/parametres', ['motif' => $data['motif'] ?? '']);

        return new UserResource($user->fresh(self::WITH));
    }

    public function bloquer(Request $request, User $user): JsonResponse|UserResource
    {
        $data = $request->validate([
            'type' => ['required', 'in:temporaire,definitif'],
            'jusqu_au' => ['required_if:type,temporaire', 'nullable', 'date', 'after:today'],
            'motif' => ['nullable', 'string', 'max:255'],
        ], [
            'jusqu_au.required_if' => __('La date de fin est obligatoire pour un blocage temporaire.'),
            'jusqu_au.after' => __('La date de fin du blocage doit être postérieure à aujourd\'hui.'),
        ]);

        if ($user->id === $request->user()->id) {
            return response()->json(['message' => __('Vous ne pouvez pas bloquer votre propre compte.')], 403);
        }

        $temporaire = $data['type'] === 'temporaire';

        $user->forceFill([
            'is_blocked' => true,
            'statut' => $temporaire ? 'suspendu' : 'bloque',
            // A temporary block lasts until the end of the given day.
            'blocked_until' => $temporaire ? Carbon::parse($data['jusqu_au'])->endOfDay() : null,
            'block_motif' => $data['motif'] ?? null,
        ])->save();

        $user->tokens()->delete();

        return new UserResource($user->load(self::WITH));
    }

    public function debloquer(User $user): UserResource
    {
        $user->unblock();

        AppNotification::send($user, 'Compte débloqué', 'Votre compte a été réactivé. Vous pouvez de nouveau utiliser DarFix.', 'compte');

        return new UserResource($user->load(self::WITH));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => __('Vous ne pouvez pas supprimer votre propre compte.')], 403);
        }

        if ($user->photo_path) {
            Storage::disk('public')->delete($user->photo_path);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => __('Utilisateur supprimé.')]);
    }

    private function findPrestataire(int $id): User
    {
        return User::where('role', User::ROLE_PRESTATAIRE)->findOrFail($id);
    }
}
