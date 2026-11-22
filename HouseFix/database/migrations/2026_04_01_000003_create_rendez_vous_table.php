<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rendez_vous', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('prestataire_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('categorie_service_id')->nullable()->constrained('categories_services')->nullOnDelete();
            $table->date('date');
            $table->time('heure')->nullable();
            $table->text('description');
            $table->string('address');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            // en_attente | accepte | refuse | annule_par_client | termine | facture
            $table->string('status', 30)->default('en_attente')->index();
            $table->string('motif_refus')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rendez_vous');
    }
};
