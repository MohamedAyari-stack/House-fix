<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Attachments (photo of the problem, quote in PDF…). Files live on the private disk and are served
     * only to the two participants (GET /messages/{id}/attachment). A message may be a file without text.
     */
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->text('content')->nullable()->change();
            $table->string('attachment_path')->nullable()->after('type');
            $table->string('attachment_name')->nullable()->after('attachment_path');
            $table->string('attachment_mime', 100)->nullable()->after('attachment_name');
            $table->unsignedInteger('attachment_size')->nullable()->after('attachment_mime');
            // Incremental loading (?after_id / ?before_id) walks messages of one conversation by id.
            $table->index(['conversation_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex(['conversation_id', 'id']);
            $table->dropColumn(['attachment_path', 'attachment_name', 'attachment_mime', 'attachment_size']);
        });
    }
};
