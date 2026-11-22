<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\LitigeResource;
use App\Models\AppNotification;
use App\Models\Litige;
use App\Models\RendezVous;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class LitigeController extends Controller
{
    private const WITH = ['declarant', 'cible', 'rendezVous.categorie'];

    /** Notification sentence per status (translation keys, one per status so each language can phrase it). */
    private const STATUT_MESSAGES = [
        'ouvert' => 'Votre litige « :sujet » est désormais ouvert.',
        'en_cours' => 'Votre litige « :sujet » est désormais en cours de traitement.',
        'resolu' => 'Votre litige « :sujet » est désormais résolu.',
        'rejete' => 'Votre litige « :sujet » est désormais rejeté.',
    ];

    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        $litiges = Litige::with(self::WITH)
            ->when(! $user->isAdmin(), fn ($q) => $q->where(fn ($w) => $w
                ->where('declarant_id', $user->id)->orWhere('cible_id', $user->id)))
            ->latest()
            ->orderByDesc('id')
            ->get();

        return LitigeResource::collection($litiges);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'rendez_vous_id' => ['required', 'integer', 'exists:rendez_vous,id'],
            'sujet' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:3000'],
        ]);

        $user = $request->user();
        $rdv = RendezVous::findOrFail($data['rendez_vous_id']);
        abort_unless($rdv->isParticipant($user), 403, __('Vous ne pouvez signaler un litige que sur vos propres rendez-vous.'));

        $litige = Litige::create($data + [
            'declarant_id' => $user->id,
            'cible_id' => $rdv->otherPartyId($user),
            'statut' => 'ouvert',
        ]);

        AppNotification::sendToAdmins('Nouveau litige', ':nom a signalé un litige : :sujet.', 'litige', '/admin/litiges',
            ['nom' => $user->nom, 'sujet' => $litige->sujet]);
        AppNotification::send($litige->cible_id, 'Litige signalé',
            'Un litige a été signalé concernant le rendez-vous du :date.', 'litige', '/litiges',
            ['date' => date('d/m/Y', strtotime($rdv->date))]);

        return (new LitigeResource($litige->load(self::WITH)))->response()->setStatusCode(201);
    }

    public function update(Request $request, Litige $litige): LitigeResource
    {
        $data = $request->validate([
            'statut' => ['required', Rule::in(Litige::STATUTS)],
            'reponse_admin' => ['nullable', 'string', 'max:3000'],
        ]);

        $litige->update([
            'statut' => $data['statut'],
            'reponse_admin' => $data['reponse_admin'] ?? $litige->reponse_admin,
            'traite_par' => $request->user()->id,
            'traite_le' => now(),
        ]);

        $message = array_filter([self::STATUT_MESSAGES[$litige->statut], $litige->reponse_admin ? 'Réponse : :reponse' : null]);
        $params = ['sujet' => $litige->sujet, 'reponse' => (string) $litige->reponse_admin];

        foreach ([$litige->declarant_id, $litige->cible_id] as $userId) {
            AppNotification::send($userId, 'Mise à jour d\'un litige', $message, 'litige', '/litiges', $params);
        }

        return new LitigeResource($litige->load(self::WITH));
    }
}
