<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('email_verified_at')->nullable()->after('email');
        });

        // Accounts created before this feature keep working without a verification step.
        DB::table('users')->update(['email_verified_at' => now()]);

        // 6-digit codes sent by email, one per address and purpose (verify the email, reset the password).
        Schema::create('email_codes', function (Blueprint $table) {
            $table->id();
            $table->string('email');
            $table->string('purpose', 20);
            $table->string('code_hash');
            $table->timestamp('created_at');
            $table->unique(['email', 'purpose']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_codes');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('email_verified_at'));
    }
};
