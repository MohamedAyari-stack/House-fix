<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Arabic name and description of the seeded categories, keyed by their French name. */
    private const ARABIC = [
        'Plomberie' => ['سباكة', 'تسرّبات المياه، الأدوات الصحية، سخّانات الماء والقنوات.'],
        'Électricité' => ['كهرباء', 'تركيب التجهيزات الكهربائية وإصلاح أعطالها ومطابقتها للمعايير.'],
        'Serrurerie' => ['أقفال', 'فتح الأبواب، تركيب الأقفال وتصفيح الأبواب.'],
        'Climatisation' => ['تكييف', 'تركيب المكيّفات وصيانتها.'],
        'Menuiserie' => ['نجارة', 'أبواب، نوافذ، خزائن وأثاث حسب الطلب.'],
        'Nettoyage' => ['تنظيف', 'تنظيف المنازل، التنظيف بعد الأشغال وتنظيف البلّور.'],
        'Jardinage' => ['بستنة', 'العناية بالمساحات الخضراء، التقليم والعشب.'],
        'Peinture' => ['طلاء', 'طلاء داخلي وخارجي وتلبيس الجدران.'],
    ];

    public function up(): void
    {
        Schema::table('categories_services', function (Blueprint $table) {
            $table->string('nom_ar')->nullable()->after('nom');
            $table->text('description_ar')->nullable()->after('description');
        });

        foreach (self::ARABIC as $nom => [$nomAr, $descriptionAr]) {
            DB::table('categories_services')->where('nom', $nom)->whereNull('nom_ar')
                ->update(['nom_ar' => $nomAr, 'description_ar' => $descriptionAr]);
        }
    }

    public function down(): void
    {
        Schema::table('categories_services', fn (Blueprint $table) => $table->dropColumn(['nom_ar', 'description_ar']));
    }
};
