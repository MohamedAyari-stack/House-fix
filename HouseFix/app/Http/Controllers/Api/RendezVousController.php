<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\FactureResource;
use App\Http\Resources\RendezVousResource;
use App\Models\AppNotification;
use App\Models\Facture;
use App\Models\RendezVous;
use App\Models\User;
use App\Services\Tva;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class RendezVousController extends Controller
{
    public const WITH = [
        'client', 'prestataire', 'categorie', 'facture.paiements',
        'evaluation.client', 'evaluation.prestataire',
    ];

    /** 409 message per current status (translation keys). */
    private const STATUS_ERRORS = [
        'en_attente' => 'Action impossible : le rendez-vous est en attente.',
        'accepte' => 'Action impossible : le rendez-vous est accepté.',
        'refuse' => 'Action impossible : le rendez-vous est refusé.',
        'annule_par_client' => 'Action impossible : le rendez-vous est annulé.',
        'termine' => 'Action impossible : le rendez-vous est terminé.',
        'facture' => 'Action impossible : le rendez-vous est facturé.',
    ];

    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        $query = RendezVous::with(self::WITH)
            ->when($user->isClient(), fn ($q) => $q->where('client_id', $user->id))
            ->when($user->isPrestataire(), fn ($q) => $q->where('prestataire_id', $user->id))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->query('status')))
            ->orderByDesc('date')
            ->orderByDesc('heure')
            ->orderByDesc('id');

        return RendezVousResource::collection($query->get());
    }

    public function show(Request $request, RendezVous $rendezVous): RendezVousResource
    {
        $this->authorizeView($request->user(), $rendezVous);

        return new RendezVousResource($rendezVous->load(self::WITH));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'prestataire_id' => ['required', 'integer', 'exists:users,id'],
            'categorie_service_id' => ['required', 'integer', 'exists:categories_services,id'],
            'date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'heure' => ['nullable', 'date_format:H:i'],
            'address' => ['required', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'description' => ['required', 'string', 'max:2000'],
        ], [
            'date.after_or_equal' => __('La date du rendez-vous doit être aujourd\'hui ou une date future.'),
        ]);

        $prestataire = User::with('prestataireProfile')->find($data['prestataire_id']);
        $profile = $prestataire?->prestataireProfile;

        if (! $prestataire->isPrestataire() || ! $profile || $profile->validation_status !== 'valide'
            || ! $profile->is_available || $prestataire->checkBlocked()) {
            return response()->json(['message' => __('Prestataire indisponible')], 422);
        }

        $client = $request->user();
        $rdv = RendezVous::create($data + ['client_id' => $client->id, 'status' => 'en_attente']);

        AppNotification::send(
            $prestataire,
            'Nouvelle demande de rendez-vous',
            ":nom vous a envoyé une demande d'intervention pour le :date.",
            'rdv',
            '/prestataire/rendez-vous',
            ['nom' => $client->nom, 'date' => $this->dmy($rdv->date)],
        );

        return (new RendezVousResource($rdv->load(self::WITH)))->response()->setStatusCode(201);
    }

    public function annuler(Request $request, RendezVous $rendezVous): RendezVousResource
    {
        $this->authorizeClient($request->user(), $rendezVous);
        $this->assertStatus($rendezVous, ['en_attente', 'accepte']);

        $rendezVous->update(['status' => 'annule_par_client']);

        $this->notifyPrestataire($rendezVous, 'Rendez-vous annulé', ':nom a annulé le rendez-vous du :date.',
            ['nom' => $rendezVous->client->nom, 'date' => $this->dmy($rendezVous->date)]);

        return new RendezVousResource($rendezVous->load(self::WITH));
    }

    public function accepter(Request $request, RendezVous $rendezVous): RendezVousResource
    {
        $this->authorizePrestataire($request->user(), $rendezVous);
        $data = $request->validate(['heure' => ['nullable', 'date_format:H:i']]);
        $this->assertStatus($rendezVous, ['en_attente']);

        $rendezVous->update(array_filter(['status' => 'accepte', 'heure' => $data['heure'] ?? null]));

        $this->notifyClient($rendezVous, 'Rendez-vous accepté',
            $rendezVous->heure ? ':nom a accepté votre rendez-vous du :date à :heure.' : ':nom a accepté votre rendez-vous du :date.',
            $this->params($rendezVous));

        return new RendezVousResource($rendezVous->load(self::WITH));
    }

    public function refuser(Request $request, RendezVous $rendezVous): RendezVousResource
    {
        $this->authorizePrestataire($request->user(), $rendezVous);
        $data = $request->validate(['motif' => ['nullable', 'string', 'max:255']]);
        $this->assertStatus($rendezVous, ['en_attente']);

        $rendezVous->update(['status' => 'refuse', 'motif_refus' => $data['motif'] ?? null]);

        $this->notifyClient($rendezVous, 'Rendez-vous refusé',
            array_filter([':nom a refusé votre demande du :date.', $rendezVous->motif_refus ? 'Motif : :motif' : null]),
            $this->params($rendezVous) + ['motif' => (string) $rendezVous->motif_refus]);

        return new RendezVousResource($rendezVous->load(self::WITH));
    }

    public function horaire(Request $request, RendezVous $rendezVous): RendezVousResource
    {
        $this->authorizePrestataire($request->user(), $rendezVous);
        $data = $request->validate([
            'heure' => ['required', 'date_format:H:i'],
            'date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:today'],
        ]);
        $this->assertStatus($rendezVous, ['accepte']);

        $rendezVous->update(array_filter($data));

        $this->notifyClient($rendezVous, 'Horaire modifié',
            "L'intervention de :nom est prévue le :date à :heure.", $this->params($rendezVous));

        return new RendezVousResource($rendezVous->load(self::WITH));
    }

    public function terminer(Request $request, RendezVous $rendezVous): RendezVousResource
    {
        $this->authorizePrestataire($request->user(), $rendezVous);
        $this->assertStatus($rendezVous, ['accepte']);

        $rendezVous->update(['status' => 'termine']);

        $this->notifyClient($rendezVous, 'Intervention terminée',
            ":nom a marqué l'intervention du :date comme terminée. Vous pouvez maintenant l'évaluer.", $this->params($rendezVous));

        return new RendezVousResource($rendezVous->load(self::WITH));
    }

    public function facturer(Request $request, RendezVous $rendezVous): JsonResponse
    {
        $this->authorizePrestataire($request->user(), $rendezVous);
        $data = $request->validate([
            'montant' => ['required', 'numeric', 'gt:0', 'max:999999'],
            'details' => ['nullable', 'string', 'max:2000'],
        ], [
            'montant.gt' => __('Le montant doit être supérieur à 0.'),
        ]);
        $this->assertStatus($rendezVous, ['termine']);

        $facture = DB::transaction(function () use ($rendezVous, $data) {
            // The prestataire enters the HT amount; VAT and TTC are computed here, with the service's rate.
            $tva = Tva::calculer((float) $data['montant'], Tva::tauxPour($rendezVous->categorie));
            $facture = Facture::create([
                'numero' => Facture::nextNumero(),
                'rendez_vous_id' => $rendezVous->id,
                'client_id' => $rendezVous->client_id,
                'prestataire_id' => $rendezVous->prestataire_id,
                'montant' => $tva['montant_ttc'],
                'montant_ht' => $tva['montant_ht'],
                'taux_tva' => $tva['taux_tva'],
                'montant_tva' => $tva['montant_tva'],
                'details' => $data['details'] ?? null,
                'date' => now()->toDateString(),
                'statut_paiement' => 'non_payee',
            ]);
            $rendezVous->update(['status' => 'facture']);

            return $facture;
        });

        AppNotification::send($rendezVous->client_id, 'Nouvelle facture',
            'Facture :numero de :montant DT émise par :nom.',
            'facture', '/client/factures', [
                'numero' => $facture->numero,
                'montant' => number_format($facture->montant, 2, ',', ' '),
                'nom' => $rendezVous->prestataire->nom,
            ]);

        return (new FactureResource($facture->load(FactureController::WITH)))->response()->setStatusCode(201);
    }

    private function authorizeView(User $user, RendezVous $rdv): void
    {
        abort_unless($user->isAdmin() || $rdv->isParticipant($user), 403, __('Accès non autorisé à ce rendez-vous.'));
    }

    private function authorizeClient(User $user, RendezVous $rdv): void
    {
        abort_unless($rdv->client_id === $user->id, 403, __('Accès non autorisé à ce rendez-vous.'));
    }

    private function authorizePrestataire(User $user, RendezVous $rdv): void
    {
        abort_unless($rdv->prestataire_id === $user->id, 403, __('Accès non autorisé à ce rendez-vous.'));
    }

    /** Aborts with 409 when the transition is not allowed from the current status. */
    private function assertStatus(RendezVous $rdv, array $allowed): void
    {
        abort_unless(in_array($rdv->status, $allowed, true), 409,
            __(self::STATUS_ERRORS[$rdv->status] ?? 'Action impossible pour ce rendez-vous.'));
    }

    /** Keys and :placeholders are translated by AppNotification::send() in the recipient's language. */
    private function notifyClient(RendezVous $rdv, string $titre, string|array $message, array $params): void
    {
        AppNotification::send($rdv->client_id, $titre, $message, 'rdv', '/client/rendez-vous', $params);
    }

    private function notifyPrestataire(RendezVous $rdv, string $titre, string|array $message, array $params): void
    {
        AppNotification::send($rdv->prestataire_id, $titre, $message, 'rdv', '/prestataire/rendez-vous', $params);
    }

    /** :nom (the prestataire), :date and :heure of a rendez-vous for the client's notifications. */
    private function params(RendezVous $rdv): array
    {
        return [
            'nom' => $rdv->prestataire->nom,
            'date' => $this->dmy($rdv->date),
            'heure' => substr((string) $rdv->heure, 0, 5),
        ];
    }

    /** dd/mm/yyyy: the same digits in French and Arabic messages. */
    private function dmy(string $date): string
    {
        return Carbon::parse($date)->format('d/m/Y');
    }
}
