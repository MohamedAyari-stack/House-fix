<?php

use App\Services\Tva;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Invoices issued before VAT existed: their amount (already paid or due) is kept as the TTC
 * and split into HT + TVA at the 19 % normal rate, so no client pays a different amount.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('factures')->where('taux_tva', 0)->where('montant_tva', 0)->orderBy('id')->each(function ($f) {
            $tva = Tva::depuisTtc((float) $f->montant, 19);
            DB::table('factures')->where('id', $f->id)->update([
                'montant_ht' => $tva['montant_ht'], 'taux_tva' => 19, 'montant_tva' => $tva['montant_tva'],
            ]);
        });
    }

    public function down(): void
    {
        DB::table('factures')->where('taux_tva', 19)->update(['montant_ht' => DB::raw('montant'), 'taux_tva' => 0, 'montant_tva' => 0]);
    }
};
