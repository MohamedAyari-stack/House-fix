<?php

namespace App\Services;

use App\Models\Evaluation;
use App\Models\Facture;
use App\Models\Litige;
use App\Models\RendezVous;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Lang;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * Admin exports (CSV / Excel). Each dataset is a "sheet": a title, translated headers, rows and
 * the columns holding money. Labels follow the request language (lang/{fr,ar,en}/export.php).
 * Rows hold personal data (emails, phones): the route is admin-only.
 */
class AdminExport
{
    public const DATASETS = ['statistiques', 'utilisateurs', 'prestataires', 'rendez_vous', 'factures', 'litiges'];

    /** Every dataset in one Excel workbook (one sheet each). */
    public const ALL = 'tout';

    public function __construct(private ?CarbonInterface $from = null, private ?CarbonInterface $to = null) {}

    /** @return list<array{key: string, title: string, headers: list<string>, rows: iterable<list<mixed>>, money?: list<int>}> */
    public function sheets(string $dataset): array
    {
        return match ($dataset) {
            'statistiques' => $this->statistiques(),
            'utilisateurs' => [$this->utilisateurs()],
            'prestataires' => [$this->prestataires()],
            'rendez_vous' => [$this->rendezVous()],
            'factures' => [$this->factures()],
            'litiges' => [$this->litiges()],
            self::ALL => array_merge(...array_map(fn (string $d) => $this->sheets($d), self::DATASETS)),
        };
    }

    // ---------- datasets ----------

    private function statistiques(): array
    {
        $rdv = $this->inPeriod(RendezVous::query(), 'date');
        $counts = (clone $rdv)->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $decided = ($counts['accepte'] ?? 0) + ($counts['termine'] ?? 0) + ($counts['facture'] ?? 0) + ($counts['refuse'] ?? 0);
        $accepted = $decided - ($counts['refuse'] ?? 0);

        $prestataires = fn (string $status) => User::where('role', User::ROLE_PRESTATAIRE)
            ->whereHas('prestataireProfile', fn ($q) => $q->where('validation_status', $status));

        $kpis = [
            [__('export.kpi.periode'), $this->periodLabel()],
            [__('export.kpi.genere_le'), now()->format('Y-m-d H:i')],
            [__('export.kpi.clients'), $this->inPeriod(User::where('role', User::ROLE_CLIENT), 'created_at')->count()],
            [__('export.kpi.prestataires_actifs'), $prestataires('valide')->where('is_blocked', false)->count()],
            [__('export.kpi.prestataires_en_attente'), $prestataires('en_attente')->whereNotNull('email_verified_at')->count()],
            [__('export.kpi.rendez_vous'), (clone $rdv)->count()],
            [__('export.kpi.rendez_vous_termines'), ($counts['termine'] ?? 0) + ($counts['facture'] ?? 0)],
            [__('export.kpi.taux_acceptation'), $decided ? round($accepted / $decided * 100, 1) : 0],
            [__('export.kpi.note_moyenne'), round((float) $this->inPeriod(Evaluation::query(), 'created_at')->avg('note'), 2)],
            [__('export.kpi.avis'), $this->inPeriod(Evaluation::query(), 'created_at')->count()],
            [__('export.kpi.litiges'), $this->inPeriod(Litige::query(), 'created_at')->count()],
            [__('export.kpi.litiges_ouverts'), Litige::where('statut', 'ouvert')->count()],
            [__('export.kpi.chiffre_affaires'), round((float) $this->inPeriod(Facture::where('statut_paiement', 'payee'), 'paid_at')->sum('montant'), 2)],
            [__('export.kpi.factures_impayees'), $this->inPeriod(Facture::where('statut_paiement', '!=', 'payee'), 'date')->count()],
        ];

        $statuts = array_map(
            fn (string $s) => [__("export.rdv.$s"), (int) ($counts[$s] ?? 0)],
            RendezVous::STATUSES,
        );

        return [
            ['key' => 'statistiques', 'title' => __('export.sheets.statistiques'), 'headers' => [__('export.headers.indicateur'), __('export.headers.valeur')], 'rows' => $kpis],
            ['key' => 'statuts', 'title' => __('export.sheets.statuts'), 'headers' => [__('export.headers.statut'), __('export.headers.nombre')], 'rows' => $statuts],
            ['key' => 'mois', 'title' => __('export.sheets.mois'), 'headers' => [__('export.headers.mois'), __('export.headers.nombre'), __('export.headers.chiffre_affaires')], 'rows' => $this->parMois(), 'money' => [2]],
        ];
    }

    /** Appointments and collected revenue per month over the period (last 12 months by default). */
    private function parMois(): array
    {
        $end = Carbon::parse($this->to ?? now())->startOfMonth();
        $start = $this->from ? Carbon::parse($this->from)->startOfMonth() : $end->copy()->subMonthsNoOverflow(11);
        $rows = [];
        for ($m = $start->copy(); $m <= $end; $m->addMonthNoOverflow()) {
            $first = $m->copy()->startOfMonth();
            $last = $m->copy()->endOfMonth();
            $rows[] = [
                $first->format('Y-m'),
                RendezVous::whereBetween('date', [$first->toDateString(), $last->toDateString()])->count(),
                round((float) Facture::where('statut_paiement', 'payee')->whereBetween('paid_at', [$first, $last])->sum('montant'), 2),
            ];
        }

        return $rows;
    }

    private function utilisateurs(): array
    {
        $rows = $this->inPeriod(User::query(), 'created_at')->orderBy('id')->lazy()->map(fn (User $u) => [
            $u->id,
            $u->nom,
            $u->email,
            $u->telephone,
            __("export.roles.{$u->role}"),
            $this->gouvernorat($u->gouvernorat),
            __("export.comptes.{$u->statut}"),
            $this->yesNo($u->email_verified_at !== null),
            $this->yesNo((bool) $u->is_blocked),
            $u->created_at?->format('Y-m-d'),
            __('export.langues.'.($u->locale ?? 'fr')),
        ]);

        return $this->sheet('utilisateurs', ['id', 'nom', 'email', 'telephone', 'role', 'gouvernorat', 'compte', 'email_verifie', 'bloque', 'inscrit_le', 'langue'], $rows);
    }

    private function prestataires(): array
    {
        // Completed jobs and collected revenue are computed in SQL, not per row.
        $query = User::where('role', User::ROLE_PRESTATAIRE)
            ->with('prestataireProfile.categorie')
            ->withCount(['rendezVousPrestataire as termines' => fn ($q) => $q->whereIn('status', ['termine', 'facture'])])
            ->withSum(['facturesPrestataire as encaisse' => fn ($q) => $q->where('statut_paiement', 'payee')], 'montant')
            ->orderBy('id');

        $rows = $query->lazy()->map(function (User $u) {
            $p = $u->prestataireProfile;

            return [
                $u->id,
                $u->nom,
                $u->email,
                $u->telephone,
                $this->gouvernorat($u->gouvernorat),
                $p?->categorie?->localizedNom(),
                $p?->specialite,
                (int) $p?->experience_annees,
                (float) $p?->tarif_horaire,
                round((float) $p?->note_moyenne, 2),
                (int) $p?->nb_avis,
                $p ? __("export.validation.{$p->validation_status}") : null,
                $this->yesNo((bool) $p?->is_available),
                (int) $u->termines,
                round((float) $u->encaisse, 2),
            ];
        });

        return $this->sheet('prestataires', ['id', 'nom', 'email', 'telephone', 'gouvernorat', 'categorie', 'specialite', 'experience', 'tarif', 'note', 'nb_avis', 'validation', 'disponible', 'interventions', 'chiffre_affaires'], $rows, [8, 14]);
    }

    private function rendezVous(): array
    {
        $rows = $this->inPeriod(RendezVous::with(['client', 'prestataire', 'categorie']), 'date')->orderBy('date')->lazy()->map(fn (RendezVous $r) => [
            $r->id,
            Carbon::parse($r->date)->format('Y-m-d'),
            $r->heure ? substr((string) $r->heure, 0, 5) : null,
            $r->client?->nom,
            $r->prestataire?->nom,
            $r->categorie?->localizedNom(),
            __("export.rdv.{$r->status}"),
            $r->address,
            $r->created_at?->format('Y-m-d H:i'),
        ]);

        return $this->sheet('rendez_vous', ['id', 'date', 'heure', 'client', 'prestataire', 'categorie', 'statut', 'adresse', 'cree_le'], $rows);
    }

    private function factures(): array
    {
        $rows = $this->inPeriod(Facture::with(['client', 'prestataire']), 'date')->orderBy('date')->lazy()->map(fn (Facture $f) => [
            $f->numero,
            Carbon::parse($f->date)->format('Y-m-d'),
            $f->client?->nom,
            $f->prestataire?->nom,
            (float) $f->montant,
            __("export.paiement.{$f->statut_paiement}"),
            $f->mode_paiement ? __("export.modes.{$f->mode_paiement}") : null,
            $f->paid_at?->format('Y-m-d H:i'),
        ]);

        return $this->sheet('factures', ['numero', 'date', 'client', 'prestataire', 'montant', 'paiement', 'mode', 'payee_le'], $rows, [4]);
    }

    private function litiges(): array
    {
        $rows = $this->inPeriod(Litige::with(['declarant', 'cible']), 'created_at')->orderBy('created_at')->lazy()->map(fn (Litige $l) => [
            $l->id,
            $l->created_at?->format('Y-m-d H:i'),
            $l->declarant?->nom,
            $l->cible?->nom,
            $l->rendez_vous_id ? '#'.$l->rendez_vous_id : null,
            $l->sujet,
            __("export.litige.{$l->statut}"),
            $l->traite_le?->format('Y-m-d H:i'),
        ]);

        return $this->sheet('litiges', ['id', 'ouvert_le', 'declarant', 'cible', 'rendez_vous', 'sujet', 'statut', 'traite_le'], $rows);
    }

    // ---------- writers ----------

    /**
     * Streams one sheet as CSV: UTF-8 with BOM (accents and Arabic open correctly in Excel),
     * ";" separator for French/Arabic Excel, "," for English.
     */
    public function writeCsv(array $sheet): void
    {
        $out = fopen('php://output', 'w');
        fwrite($out, "\xEF\xBB\xBF");
        $sep = app()->getLocale() === 'en' ? ',' : ';';
        fputcsv($out, $sheet['headers'], $sep, '"', '');
        foreach ($sheet['rows'] as $row) {
            fputcsv($out, array_map(fn ($v) => is_float($v) ? $this->csvNumber($v) : $v, $row), $sep, '"', '');
        }
        fclose($out);
    }

    /** Streams an Excel workbook: one sheet per dataset, styled header, filters, frozen header row. */
    public function writeXlsx(array $sheets): void
    {
        $book = new Spreadsheet;
        $book->getProperties()->setCreator('DarFix')->setTitle('DarFix');
        $book->removeSheetByIndex(0);
        $rtl = app()->getLocale() === 'ar';

        foreach ($sheets as $sheet) {
            $ws = $book->createSheet();
            // Excel limits sheet names to 31 characters and forbids : \ / ? * [ ].
            $ws->setTitle(mb_substr(str_replace([':', '\\', '/', '?', '*', '[', ']'], ' ', $sheet['title']), 0, 31));
            $ws->setRightToLeft($rtl);

            $ws->fromArray($sheet['headers'], null, 'A1');
            $r = 2;
            foreach ($sheet['rows'] as $row) {
                $ws->fromArray(array_values($row), null, 'A'.$r++, true);
            }

            $lastCol = Coordinate::stringFromColumnIndex(count($sheet['headers']));
            $lastRow = max(1, $r - 1);
            $ws->getStyle("A1:{$lastCol}1")->applyFromArray([
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '2563EB']],
            ]);
            $ws->freezePane('A2');
            $ws->setAutoFilter("A1:{$lastCol}{$lastRow}");
            foreach ($sheet['money'] ?? [] as $col) {
                $letter = Coordinate::stringFromColumnIndex($col + 1);
                $ws->getStyle("{$letter}2:{$letter}{$lastRow}")->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_NUMBER_COMMA_SEPARATED1);
            }
            for ($c = 1; $c <= count($sheet['headers']); $c++) {
                $ws->getColumnDimension(Coordinate::stringFromColumnIndex($c))->setAutoSize(true);
            }
        }

        $book->setActiveSheetIndex(0);
        (new Xlsx($book))->save('php://output');
        $book->disconnectWorksheets();
    }

    // ---------- helpers ----------

    private function sheet(string $key, array $headerKeys, iterable $rows, array $money = []): array
    {
        return [
            'key' => $key,
            'title' => __("export.sheets.$key"),
            'headers' => array_map(fn (string $h) => __("export.headers.$h"), $headerKeys),
            'rows' => $rows,
            'money' => $money,
        ];
    }

    private function inPeriod(Builder $query, string $column): Builder
    {
        // whereDate: the bounds are whole days, for DATE columns (rendez_vous.date) as for DATETIME ones.
        if ($this->from) {
            $query->whereDate($column, '>=', Carbon::parse($this->from)->toDateString());
        }
        if ($this->to) {
            $query->whereDate($column, '<=', Carbon::parse($this->to)->toDateString());
        }

        return $query;
    }

    private function periodLabel(): string
    {
        if (! $this->from && ! $this->to) {
            return __('export.kpi.toute_periode');
        }

        return trim(($this->from ? Carbon::parse($this->from)->format('Y-m-d') : '…').' → '.($this->to ? Carbon::parse($this->to)->format('Y-m-d') : '…'));
    }

    /** Governorate in the request language (stored in French; French files have no map). */
    private function gouvernorat(?string $name): ?string
    {
        return $name && Lang::has("export.gouvernorats.$name") ? __("export.gouvernorats.$name") : $name;
    }

    private function yesNo(bool $value): string
    {
        return $value ? __('export.yes') : __('export.no');
    }

    /** Decimal comma in French and Arabic CSV (as Excel expects there), point in English. */
    private function csvNumber(float $value): string
    {
        $text = rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.');

        return app()->getLocale() === 'en' ? $text : str_replace('.', ',', $text);
    }
}
