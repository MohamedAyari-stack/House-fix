<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // VAT rates managed by the admin. Starting values: the Tunisian rates (19 % normal, 13 % and 7 % reduced)
        // and 0 % for exempt services. The admin must check them against the current Loi de finances.
        Schema::create('taux_tva', function (Blueprint $table) {
            $table->id();
            $table->string('libelle', 100);
            $table->decimal('taux', 5, 2);
            $table->boolean('par_defaut')->default(false);
            $table->timestamps();
        });

        $now = now();
        DB::table('taux_tva')->insert([
            ['libelle' => 'Taux normal', 'taux' => 19, 'par_defaut' => true, 'created_at' => $now, 'updated_at' => $now],
            ['libelle' => 'Taux réduit 13 %', 'taux' => 13, 'par_defaut' => false, 'created_at' => $now, 'updated_at' => $now],
            ['libelle' => 'Taux réduit 7 %', 'taux' => 7, 'par_defaut' => false, 'created_at' => $now, 'updated_at' => $now],
            ['libelle' => 'Exonéré', 'taux' => 0, 'par_defaut' => false, 'created_at' => $now, 'updated_at' => $now],
        ]);

        // A service without a rate uses the default rate.
        Schema::table('categories_services', function (Blueprint $table) {
            $table->foreignId('taux_tva_id')->nullable()->after('icone')->constrained('taux_tva')->nullOnDelete();
        });

        // The rate is copied onto the invoice: changing a rate later never changes an issued invoice.
        // `montant` stays the amount to pay (TTC), so payments, revenue and exports keep working.
        Schema::table('factures', function (Blueprint $table) {
            $table->decimal('montant_ht', 10, 2)->nullable()->after('montant');
            $table->decimal('taux_tva', 5, 2)->default(0)->after('montant_ht');
            $table->decimal('montant_tva', 10, 2)->default(0)->after('taux_tva');
        });
        // Invoices issued before VAT existed: no VAT, HT = TTC.
        DB::table('factures')->update(['montant_ht' => DB::raw('montant')]);
    }

    public function down(): void
    {
        Schema::table('factures', fn (Blueprint $table) => $table->dropColumn(['montant_ht', 'taux_tva', 'montant_tva']));
        Schema::table('categories_services', fn (Blueprint $table) => $table->dropConstrainedForeignId('taux_tva_id'));
        Schema::dropIfExists('taux_tva');
    }
};
