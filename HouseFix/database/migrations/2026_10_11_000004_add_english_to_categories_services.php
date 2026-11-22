<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** English name and description of the seeded categories, keyed by their French name. */
    private const ENGLISH = [
        'Plomberie' => ['Plumbing', 'Leaks, sanitary fittings, water heaters and pipes.'],
        'Électricité' => ['Electrical', 'Electrical installation, repairs and bringing wiring up to standard.'],
        'Serrurerie' => ['Locksmithing', 'Door opening, locks and reinforced doors.'],
        'Climatisation' => ['Air conditioning', 'Installation and servicing of air conditioners.'],
        'Menuiserie' => ['Carpentry', 'Custom-made doors, windows, cupboards and furniture.'],
        'Nettoyage' => ['Cleaning', 'Housekeeping, post-construction cleaning and windows.'],
        'Jardinage' => ['Gardening', 'Green space maintenance, pruning and lawn care.'],
        'Peinture' => ['Painting', 'Interior and exterior painting, wall coatings.'],
    ];

    public function up(): void
    {
        Schema::table('categories_services', function (Blueprint $table) {
            $table->string('nom_en')->nullable()->after('nom_ar');
            $table->text('description_en')->nullable()->after('description_ar');
        });

        foreach (self::ENGLISH as $nom => [$nomEn, $descriptionEn]) {
            DB::table('categories_services')->where('nom', $nom)->whereNull('nom_en')
                ->update(['nom_en' => $nomEn, 'description_en' => $descriptionEn]);
        }
    }

    public function down(): void
    {
        Schema::table('categories_services', fn (Blueprint $table) => $table->dropColumn(['nom_en', 'description_en']));
    }
};
