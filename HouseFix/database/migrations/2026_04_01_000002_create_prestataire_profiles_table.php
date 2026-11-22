<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prestataire_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            // A category with attached prestataires cannot be deleted (also enforced in the controller).
            $table->foreignId('categorie_service_id')->nullable()->constrained('categories_services')->restrictOnDelete();
            $table->string('specialite')->nullable();
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('experience_annees')->default(0);
            $table->string('certifications')->nullable();
            $table->decimal('tarif_horaire', 8, 2)->default(0);
            $table->boolean('is_available')->default(true);
            $table->string('disponibilites')->nullable();
            $table->decimal('note_moyenne', 3, 2)->default(0);
            $table->unsignedInteger('nb_avis')->default(0);
            $table->string('validation_status', 20)->default('en_attente')->index(); // en_attente | valide | refuse
            $table->string('motif_refus')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prestataire_profiles');
    }
};
