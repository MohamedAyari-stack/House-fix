<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\EvaluationResource;
use App\Models\AppNotification;
use App\Models\Evaluation;
use App\Models\RendezVous;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class EvaluationController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        $evaluations = Evaluation::with('client', 'prestataire')
            ->when($user->isClient(), fn ($q) => $q->where('client_id', $user->id))
            ->when($user->isPrestataire(), fn ($q) => $q->where('prestataire_id', $user->id))
            ->latest()
            ->orderByDesc('id')
            ->get();

        return EvaluationResource::collection($evaluations);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'rendez_vous_id' => ['required', 'integer', 'exists:rendez_vous,id'],
            'note' => ['required', 'integer', 'between:1,5'],
            'commentaire' => ['nullable', 'string', 'max:1000'],
        ], [
            'note.between' => __('La note doit être comprise entre 1 et 5.'),
        ]);

        $user = $request->user();
        $rdv = RendezVous::findOrFail($data['rendez_vous_id']);

        abort_unless($rdv->client_id === $user->id, 403, __('Vous ne pouvez évaluer que vos propres rendez-vous.'));

        if (! in_array($rdv->status, ['termine', 'facture'], true)) {
            return response()->json(['message' => __('Ce rendez-vous ne peut pas encore être évalué.')], 409);
        }
        if ($rdv->evaluation()->exists()) {
            return response()->json(['message' => __('Ce rendez-vous a déjà été évalué.')], 409);
        }

        $evaluation = Evaluation::create([
            'rendez_vous_id' => $rdv->id,
            'client_id' => $user->id,
            'prestataire_id' => $rdv->prestataire_id,
            'note' => $data['note'],
            'commentaire' => $data['commentaire'] ?? null,
        ]);
        Evaluation::refreshNoteFor($rdv->prestataire_id);

        AppNotification::send($rdv->prestataire_id, 'Nouvelle évaluation',
            ':nom vous a attribué la note de :note/5.', 'evaluation', '/prestataire/evaluations',
            ['nom' => $user->nom, 'note' => $evaluation->note]);

        return (new EvaluationResource($evaluation->load('client', 'prestataire')))->response()->setStatusCode(201);
    }

    public function update(Request $request, Evaluation $evaluation): EvaluationResource
    {
        abort_unless($evaluation->client_id === $request->user()->id, 403, __('Vous ne pouvez modifier que vos propres évaluations.'));

        $data = $request->validate([
            'note' => ['required', 'integer', 'between:1,5'],
            'commentaire' => ['nullable', 'string', 'max:1000'],
        ], [
            'note.between' => __('La note doit être comprise entre 1 et 5.'),
        ]);

        $evaluation->update(['note' => $data['note'], 'commentaire' => $data['commentaire'] ?? null]);
        Evaluation::refreshNoteFor($evaluation->prestataire_id);

        return new EvaluationResource($evaluation->load('client', 'prestataire'));
    }

    public function repondre(Request $request, Evaluation $evaluation): EvaluationResource
    {
        abort_unless($evaluation->prestataire_id === $request->user()->id, 403, __('Vous ne pouvez répondre qu\'aux évaluations vous concernant.'));

        $data = $request->validate(['reponse' => ['required', 'string', 'max:1000']]);

        $evaluation->update(['reponse' => $data['reponse']]);

        AppNotification::send($evaluation->client_id, 'Réponse à votre évaluation',
            ':nom a répondu à votre évaluation.', 'evaluation', '/client/evaluations', ['nom' => $request->user()->nom]);

        return new EvaluationResource($evaluation->load('client', 'prestataire'));
    }

    public function destroy(Evaluation $evaluation): JsonResponse
    {
        $prestataireId = $evaluation->prestataire_id;
        $evaluation->delete();
        Evaluation::refreshNoteFor($prestataireId);

        return response()->json(['message' => __('Évaluation supprimée.')]);
    }
}
