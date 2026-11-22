<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\FactureResource;
use App\Models\AppNotification;
use App\Models\Facture;
use App\Models\Paiement;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class FactureController extends Controller
{
    public const WITH = ['rendezVous.categorie', 'rendezVous.client', 'rendezVous.prestataire', 'rendezVous.evaluation.client', 'rendezVous.evaluation.prestataire', 'paiements'];

    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        $factures = Facture::with(self::WITH)
            ->when($user->isClient(), fn ($q) => $q->where('client_id', $user->id))
            ->when($user->isPrestataire(), fn ($q) => $q->where('prestataire_id', $user->id))
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->get();

        return FactureResource::collection($factures);
    }

    public function show(Request $request, Facture $facture): FactureResource
    {
        $this->authorizeView($request->user(), $facture);

        return new FactureResource($facture->load(self::WITH));
    }

    public function pdf(Request $request, Facture $facture): Response
    {
        $this->authorizeView($request->user(), $facture);
        $facture->load(['rendezVous.categorie', 'client', 'prestataire.prestataireProfile', 'paiements']);

        return Pdf::loadView('pdf.facture', ['facture' => $facture])
            ->setPaper('a4')
            ->download("facture-{$facture->numero}.pdf");
    }

    public function payer(Request $request, Facture $facture): JsonResponse|FactureResource
    {
        $user = $request->user();
        abort_unless($facture->client_id === $user->id, 403, __('Accès non autorisé à cette facture.'));

        if ($facture->statut_paiement === 'payee') {
            return response()->json(['message' => __('Facture déjà payée')], 409);
        }

        // Accept "4242 4242 4242 4242" as well as "4242424242424242".
        if ($request->has('card_number')) {
            $request->merge(['card_number' => preg_replace('/[\s-]/', '', (string) $request->input('card_number'))]);
        }

        $data = $request->validate([
            'mode' => ['required', 'in:en_ligne,especes'],
            'card_number' => ['required_if:mode,en_ligne', 'nullable', 'digits:16'],
            'card_name' => ['nullable', 'string', 'max:255'],
            'expiry' => ['required_if:mode,en_ligne', 'nullable', 'regex:/^(0[1-9]|1[0-2])\/\d{2}$/'],
            'cvv' => ['required_if:mode,en_ligne', 'nullable', 'digits:3'],
        ], [
            'card_number.digits' => __('Le numéro de carte doit comporter 16 chiffres.'),
            'expiry.regex' => __('La date d\'expiration doit être au format MM/AA.'),
            'cvv.digits' => __('Le CVV doit comporter 3 chiffres.'),
            'card_number.required_if' => __('Le numéro de carte est obligatoire pour un paiement en ligne.'),
            'expiry.required_if' => __('La date d\'expiration est obligatoire pour un paiement en ligne.'),
            'cvv.required_if' => __('Le CVV est obligatoire pour un paiement en ligne.'),
        ]);

        if ($data['mode'] === 'especes') {
            if ($facture->statut_paiement === 'en_attente') {
                return response()->json(['message' => __('Un paiement en espèces est déjà en attente de confirmation.')], 409);
            }

            DB::transaction(function () use ($facture) {
                $facture->paiements()->create([
                    'montant' => $facture->montant,
                    'mode' => 'especes',
                    'statut' => 'en_attente',
                    'reference' => Paiement::newReference(),
                ]);
                $facture->update(['statut_paiement' => 'en_attente', 'mode_paiement' => 'especes']);
            });

            AppNotification::send($facture->prestataire_id, 'Paiement en espèces à confirmer',
                'Le client a déclaré avoir réglé la facture :numero en espèces. Merci de confirmer la réception.',
                'paiement', '/prestataire/factures', ['numero' => $facture->numero]);

            return new FactureResource($facture->load(self::WITH));
        }

        // Simulated card payment: a card ending with 0000 is declined.
        $cardNumber = $data['card_number'];
        $declined = str_ends_with($cardNumber, '0000');

        $facture->paiements()->create([
            'montant' => $facture->montant,
            'mode' => 'en_ligne',
            'statut' => $declined ? 'refuse' : 'valide',
            'reference' => Paiement::newReference(),
            'card_last4' => substr($cardNumber, -4),
        ]);

        if ($declined) {
            return response()->json(['message' => __('Paiement refusé par la banque. Veuillez utiliser une autre carte.')], 402);
        }

        // Paying online supersedes a pending cash declaration.
        $facture->paiements()->where('statut', 'en_attente')->update(['statut' => 'refuse']);
        $facture->update(['statut_paiement' => 'payee', 'mode_paiement' => 'en_ligne', 'paid_at' => now()]);

        AppNotification::send($facture->prestataire_id, 'Paiement reçu',
            'La facture :numero (:montant DT) a été payée en ligne.',
            'paiement', '/prestataire/factures',
            ['numero' => $facture->numero, 'montant' => number_format($facture->montant, 2, ',', ' ')]);

        return new FactureResource($facture->load(self::WITH));
    }

    public function confirmerEspeces(Request $request, Facture $facture): JsonResponse|FactureResource
    {
        abort_unless($facture->prestataire_id === $request->user()->id, 403, __('Accès non autorisé à cette facture.'));

        if ($facture->statut_paiement !== 'en_attente') {
            return response()->json(['message' => __('Aucun paiement en espèces en attente de confirmation pour cette facture.')], 409);
        }

        DB::transaction(function () use ($facture) {
            $facture->paiements()->where('statut', 'en_attente')->update(['statut' => 'valide']);
            $facture->update(['statut_paiement' => 'payee', 'mode_paiement' => 'especes', 'paid_at' => now()]);
        });

        AppNotification::send($facture->client_id, 'Paiement confirmé',
            'Le prestataire a confirmé la réception de votre paiement en espèces pour la facture :numero.',
            'paiement', '/client/factures', ['numero' => $facture->numero]);

        return new FactureResource($facture->load(self::WITH));
    }

    /** The prestataire records cash handed over on site, without waiting for the client to declare it. */
    public function encaisserEspeces(Request $request, Facture $facture): JsonResponse|FactureResource
    {
        abort_unless($facture->prestataire_id === $request->user()->id, 403, __('Accès non autorisé à cette facture.'));

        if ($facture->statut_paiement === 'payee') {
            return response()->json(['message' => __('Facture déjà payée')], 409);
        }

        DB::transaction(function () use ($facture) {
            // A pending declaration becomes the validated payment instead of a duplicate row.
            $pending = $facture->paiements()->where('statut', 'en_attente')->first();
            $pending
                ? $pending->update(['statut' => 'valide'])
                : $facture->paiements()->create([
                    'montant' => $facture->montant,
                    'mode' => 'especes',
                    'statut' => 'valide',
                    'reference' => Paiement::newReference(),
                ]);
            $facture->update(['statut_paiement' => 'payee', 'mode_paiement' => 'especes', 'paid_at' => now()]);
        });

        AppNotification::send($facture->client_id, 'Paiement en espèces enregistré',
            'Le prestataire a enregistré votre paiement de :montant DT en espèces pour la facture :numero.',
            'paiement', '/client/factures/'.$facture->id,
            ['numero' => $facture->numero, 'montant' => number_format($facture->montant, 2, ',', ' ')]);

        return new FactureResource($facture->load(self::WITH));
    }

    /** The prestataire did not receive the declared cash: the invoice goes back to unpaid. */
    public function refuserEspeces(Request $request, Facture $facture): JsonResponse|FactureResource
    {
        abort_unless($facture->prestataire_id === $request->user()->id, 403, __('Accès non autorisé à cette facture.'));

        if ($facture->statut_paiement !== 'en_attente') {
            return response()->json(['message' => __('Aucun paiement en espèces en attente de confirmation pour cette facture.')], 409);
        }

        $this->resetPending($facture, 'refuse');

        AppNotification::send($facture->client_id, 'Paiement en espèces non reçu',
            'Le prestataire indique ne pas avoir reçu votre paiement en espèces pour la facture :numero. Elle est de nouveau à régler.',
            'paiement', '/client/factures/'.$facture->id, ['numero' => $facture->numero]);

        return new FactureResource($facture->load(self::WITH));
    }

    /** The client withdraws a cash declaration (e.g. to pay by card instead). */
    public function annulerEspeces(Request $request, Facture $facture): JsonResponse|FactureResource
    {
        abort_unless($facture->client_id === $request->user()->id, 403, __('Accès non autorisé à cette facture.'));

        if ($facture->statut_paiement !== 'en_attente') {
            return response()->json(['message' => __('Aucun paiement en espèces en attente de confirmation pour cette facture.')], 409);
        }

        $this->resetPending($facture, 'annule');

        AppNotification::send($facture->prestataire_id, 'Déclaration en espèces annulée',
            'Le client a annulé sa déclaration de paiement en espèces pour la facture :numero.',
            'paiement', '/prestataire/factures/'.$facture->id, ['numero' => $facture->numero]);

        return new FactureResource($facture->load(self::WITH));
    }

    private function resetPending(Facture $facture, string $statut): void
    {
        DB::transaction(function () use ($facture, $statut) {
            $facture->paiements()->where('statut', 'en_attente')->update(['statut' => $statut]);
            $facture->update(['statut_paiement' => 'non_payee', 'mode_paiement' => null]);
        });
    }

    private function authorizeView(User $user, Facture $facture): void
    {
        abort_unless($user->isAdmin() || $facture->isParticipant($user), 403, __('Accès non autorisé à cette facture.'));
    }
}
