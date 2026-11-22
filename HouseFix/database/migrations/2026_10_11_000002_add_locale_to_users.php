<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Language the user last used the app in (fr|ar): emails and notifications are written in it.
        Schema::table('users', function (Blueprint $table) {
            $table->string('locale', 5)->default('fr')->after('gouvernorat');
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('locale'));
    }
};
