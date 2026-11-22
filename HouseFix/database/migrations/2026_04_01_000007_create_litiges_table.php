<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('litiges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rendez_vous_id')->constrained('rendez_vous')->cascadeOnDelete();
            $table->foreignId('declarant_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('cible_id')->constrained('users')->cascadeOnDelete();
            $table->string('sujet');
            $table->text('description');
            $table->string('statut', 20)->default('ouvert')->index(); // ouvert | en_cours | resolu | rejete
            $table->text('reponse_admin')->nullable();
            $table->foreignId('traite_par')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('traite_le')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('litiges');
    }
};
