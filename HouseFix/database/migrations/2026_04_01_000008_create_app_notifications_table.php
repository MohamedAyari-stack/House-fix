<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('titre');
            $table->text('message');
            $table->string('type', 30)->default('info'); // rdv | facture | paiement | evaluation | message | litige | compte | info
            $table->string('lien')->nullable();
            $table->boolean('lu')->default(false);
            $table->timestamps();
            $table->index(['user_id', 'lu']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app_notifications');
    }
};
