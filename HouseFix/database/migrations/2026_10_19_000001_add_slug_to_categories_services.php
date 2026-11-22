<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /** URL of the public service page: /services/{slug}, built from the French name ("Électricité" → "electricite"). */
    public function up(): void
    {
        Schema::table('categories_services', function (Blueprint $table) {
            $table->string('slug')->nullable()->unique()->after('nom');
        });

        $used = [];
        foreach (DB::table('categories_services')->orderBy('id')->get(['id', 'nom']) as $row) {
            $base = Str::slug($row->nom) ?: 'service';
            $slug = $base;
            for ($i = 2; in_array($slug, $used, true); $i++) {
                $slug = "$base-$i";
            }
            $used[] = $slug;
            DB::table('categories_services')->where('id', $row->id)->update(['slug' => $slug]);
        }
    }

    public function down(): void
    {
        Schema::table('categories_services', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropColumn('slug');
        });
    }
};
