<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\RendezVousResource;
use App\Models\Evaluation;
use App\Models\Facture;
use App\Models\Litige;
use App\Models\RendezVous;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;

class DashboardController extends Controller
{
    /** Short month names (translation keys). */
    private const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

    public function client(Request $request): JsonResponse
    {
        $user = $request->user();
        $rdvs = RendezVous::where('client_id', $user->id);
        $today = now()->toDateString();

        $terminees = (clone $rdvs)->whereIn('status', ['termine', 'facture'])->count();
        // Appointments that were (or are) actually going ahead.
        $utiles = (clone $rdvs)->whereNotIn('status', ['refuse', 'annule_par_client']);

        $prochain = (clone $rdvs)->with(RendezVousController::WITH)
            ->whereIn('status', ['en_attente', 'accepte'])
            ->where('date', '>=', $today)
            ->orderBy('date')->orderBy('heure')
            ->first();

        $total = (clone $utiles)->count();

        return response()->json([
            'interventions_terminees' => $terminees,
            'categories_actives' => (clone $utiles)->whereNotNull('categorie_service_id')->distinct()->count('categorie_service_id'),
            'rdv_en_cours' => (clone $rdvs)->whereIn('status', ['en_attente', 'accepte'])->count(),
            'factures_impayees' => Facture::where('client_id', $user->id)->where('statut_paiement', '!=', 'payee')->count(),
            'prochain_rdv' => $prochain ? new RendezVousResource($prochain) : null,
            'progression' => $total > 0 ? (int) round($terminees / $total * 100) : 0,
        ]);
    }

    public function prestataire(Request $request): JsonResponse
    {
        $user = $request->user();
        $profile = $user->prestataireProfile;
        $now = now();
        $today = $now->toDateString();

        $revenus = fn (CarbonInterface $from, CarbonInterface $to) => $this->revenus($user->id, $from, $to);

        $weekStart = $now->copy()->startOfWeek();
        $lastWeekStart = $weekStart->copy()->subWeek();

        $rdvs = RendezVous::with(RendezVousController::WITH)->where('prestataire_id', $user->id);

        return response()->json([
            'revenus_jour' => $revenus($now->copy()->startOfDay(), $now->copy()->endOfDay()),
            'revenus_hier' => $revenus($now->copy()->subDay()->startOfDay(), $now->copy()->subDay()->endOfDay()),
            'revenus_semaine' => $revenus($weekStart, $now->copy()->endOfWeek()),
            'revenus_semaine_derniere' => $revenus($lastWeekStart, $lastWeekStart->copy()->endOfWeek()),
            'jobs_termines_semaine' => (clone $rdvs)->whereIn('status', ['termine', 'facture'])
                ->whereBetween('date', [$weekStart->toDateString(), $now->copy()->endOfWeek()->toDateString()])->count(),
            'note_moyenne' => (float) ($profile->note_moyenne ?? 0),
            'nb_avis' => (int) ($profile->nb_avis ?? 0),
            'demandes_en_attente' => (clone $rdvs)->where('status', 'en_attente')->count(),
            'interventions_du_jour' => RendezVousResource::collection(
                (clone $rdvs)->where('date', $today)->whereIn('status', ['accepte', 'termine', 'facture'])->orderBy('heure')->get()
            ),
            'prochaine_intervention' => ($next = (clone $rdvs)->where('status', 'accepte')->where('date', '>=', $today)
                ->orderBy('date')->orderBy('heure')->first()) ? new RendezVousResource($next) : null,
        ]);
    }

    public function revenusPrestataire(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $now = now();

        $courant = $this->revenus($userId, $now->copy()->startOfMonth(), $now->copy()->endOfMonth());
        $dernier = $this->revenus($userId, $now->copy()->subMonthNoOverflow()->startOfMonth(), $now->copy()->subMonthNoOverflow()->endOfMonth());

        $mensuel = [];
        for ($i = 5; $i >= 0; $i--) {
            $month = $now->copy()->startOfMonth()->subMonthsNoOverflow($i);
            $mensuel[] = [
                'mois' => $month->format('Y-m'),
                'label' => $this->label($month),
                'total' => $this->revenus($userId, $month, $month->copy()->endOfMonth()),
            ];
        }

        return response()->json([
            'total' => round((float) Facture::where('prestataire_id', $userId)->where('statut_paiement', 'payee')->sum('montant'), 2),
            'mois_courant' => $courant,
            'mois_dernier' => $dernier,
            'evolution_pct' => $dernier > 0 ? round(($courant - $dernier) / $dernier * 100, 1) : ($courant > 0 ? 100.0 : 0.0),
            'mensuel' => $mensuel,
        ]);
    }

    public function calendrier(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $rdvs = RendezVous::with(RendezVousController::WITH)
            ->where('prestataire_id', $request->user()->id)
            ->whereIn('status', ['accepte', 'termine', 'facture'])
            ->when($request->filled('from'), fn ($q) => $q->where('date', '>=', $request->query('from')))
            ->when($request->filled('to'), fn ($q) => $q->where('date', '<=', $request->query('to')))
            ->orderBy('date')->orderBy('heure')
            ->get();

        return RendezVousResource::collection($rdvs);
    }

    public function admin(): JsonResponse
    {
        $counts = RendezVous::selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        $now = now();
        $rdvParMois = [];
        for ($i = 5; $i >= 0; $i--) {
            $month = $now->copy()->startOfMonth()->subMonthsNoOverflow($i);
            $rdvParMois[] = [
                'label' => $this->label($month),
                'total' => RendezVous::whereBetween('date', [$month->toDateString(), $month->copy()->endOfMonth()->toDateString()])->count(),
            ];
        }

        $prestataires = fn (string $status) => User::where('role', User::ROLE_PRESTATAIRE)
            ->whereHas('prestataireProfile', fn ($q) => $q->where('validation_status', $status));

        return response()->json([
            'clients_inscrits' => User::where('role', User::ROLE_CLIENT)->count(),
            'prestataires_actifs' => $prestataires('valide')->where('is_blocked', false)->count(),
            'prestataires_en_attente' => $prestataires('en_attente')->whereNotNull('email_verified_at')->count(),
            'total_rdv' => RendezVous::count(),
            'moyenne_evaluations' => round((float) Evaluation::avg('note'), 1),
            'nb_avis' => Evaluation::count(),
            'litiges_ouverts' => Litige::where('statut', 'ouvert')->count(),
            'chiffre_affaires' => round((float) Facture::where('statut_paiement', 'payee')->sum('montant'), 2),
            // Paid invoices: revenue before tax, VAT collected and total incl. tax (= chiffre_affaires).
            'chiffre_affaires_ht' => round((float) Facture::where('statut_paiement', 'payee')->sum('montant_ht'), 2),
            'tva_collectee' => round((float) Facture::where('statut_paiement', 'payee')->sum('montant_tva'), 2),
            'statuts' => collect(RendezVous::STATUSES)
                ->map(fn ($status) => ['status' => $status, 'count' => (int) ($counts[$status] ?? 0)])
                ->all(),
            'rdv_par_mois' => $rdvParMois,
        ]);
    }

    /** Sum of paid invoices for a prestataire, dated by paid_at. */
    private function revenus(int $prestataireId, CarbonInterface $from, CarbonInterface $to): float
    {
        return round((float) Facture::where('prestataire_id', $prestataireId)
            ->where('statut_paiement', 'payee')
            ->whereBetween('paid_at', [$from, $to])
            ->sum('montant'), 2);
    }

    private function label(Carbon $month): string
    {
        return __(self::MOIS[$month->month - 1]).' '.$month->year;
    }
}
