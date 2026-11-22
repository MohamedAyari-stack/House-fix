<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('factures', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 30)->unique();
            $table->foreignId('rendez_vous_id')->unique()->constrained('rendez_vous')->cascadeOnDelete();
            $table->foreignId('client_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('prestataire_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('montant', 10, 2);
            $table->text('details')->nullable();
            $table->date('date');
            $table->string('statut_paiement', 20)->default('non_payee')->index(); // non_payee | en_attente | payee
            $table->string('mode_paiement', 20)->nullable();                     // en_ligne | especes
            $table->dateTime('paid_at')->nullable();
            $table->timestamps();
        });

        Schema::create('paiements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facture_id')->constrained('factures')->cascadeOnDelete();
            $table->decimal('montant', 10, 2);
            $table->string('mode', 20);                 // en_ligne | especes
            $table->string('statut', 20);               // en_attente | valide | refuse | annule
            $table->string('reference', 30)->unique();
            $table->string('card_last4', 4)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('paiements');
        Schema::dropIfExists('factures');
    }
};
