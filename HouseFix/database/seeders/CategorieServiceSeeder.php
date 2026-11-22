<?php

namespace Database\Seeders;

use App\Models\CategorieService;
use Illuminate\Database\Seeder;

/**
 * Catalogue of service categories, in French, Arabic and English.
 * Idempotent (keyed by the French name): on an existing database it only adds the missing services,
 * and leaves the existing ones (possibly edited by the admin) as they are: php artisan db:seed --class=CategorieServiceSeeder
 */
class CategorieServiceSeeder extends Seeder
{
    /** [nom, description, icone, nom_ar, description_ar, nom_en, description_en] */
    public const CATALOGUE = [
        ['Plomberie', 'Fuites, sanitaires, chauffe-eau et canalisations.', 'bi-droplet',
            'سباكة', 'تسرّبات المياه، الأدوات الصحية، سخّانات الماء والقنوات.',
            'Plumbing', 'Leaks, sanitary fittings, water heaters and pipes.'],
        ['Électricité', 'Installation, dépannage et mise aux normes électriques.', 'bi-lightning-charge',
            'كهرباء', 'تركيب التجهيزات الكهربائية وإصلاح أعطالها ومطابقتها للمعايير.',
            'Electrical', 'Electrical installation, repairs and bringing wiring up to standard.'],
        ['Serrurerie', 'Ouverture de portes, serrures et blindage.', 'bi-key',
            'أقفال', 'فتح الأبواب، تركيب الأقفال وتصفيح الأبواب.',
            'Locksmithing', 'Door opening, locks and reinforced doors.'],
        ['Climatisation', 'Installation et entretien de climatiseurs.', 'bi-snow',
            'تكييف', 'تركيب المكيّفات وصيانتها.',
            'Air conditioning', 'Installation and servicing of air conditioners.'],
        ['Menuiserie', 'Portes, fenêtres, placards et mobilier sur mesure.', 'bi-hammer',
            'نجارة', 'أبواب، نوافذ، خزائن وأثاث حسب الطلب.',
            'Carpentry', 'Custom-made doors, windows, cupboards and furniture.'],
        ['Nettoyage', 'Ménage, nettoyage après travaux et vitres.', 'bi-stars',
            'تنظيف', 'تنظيف المنازل، التنظيف بعد الأشغال وتنظيف البلّور.',
            'Cleaning', 'Housekeeping, post-construction cleaning and windows.'],
        ['Jardinage', 'Entretien d\'espaces verts, taille et gazon.', 'bi-flower1',
            'بستنة', 'العناية بالمساحات الخضراء، التقليم والعشب.',
            'Gardening', 'Green space maintenance, pruning and lawn care.'],
        ['Peinture', 'Peinture intérieure et extérieure, enduits.', 'bi-palette',
            'طلاء', 'طلاء داخلي وخارجي وتلبيس الجدران.',
            'Painting', 'Interior and exterior painting, wall coatings.'],
        ['Étanchéité', 'Toits-terrasses, infiltrations d\'eau et traitement de l\'humidité.', 'bi-umbrella',
            'عزل مائي', 'عزل الأسطح، معالجة تسرّب مياه الأمطار والرطوبة.',
            'Waterproofing', 'Flat roofs, water infiltration and damp treatment.'],
        ['Maçonnerie & carrelage', 'Petits travaux de maçonnerie, carrelage, faïence et dalles.', 'bi-bricks',
            'بناء وجليز', 'أشغال البناء الصغيرة، تركيب الجليز والفايونس والبلاط.',
            'Masonry & tiling', 'Small masonry jobs, floor and wall tiling.'],
        ['Électroménager', 'Réparation de machines à laver, réfrigérateurs, fours et lave-vaisselle.', 'bi-plug',
            'تصليح الأجهزة المنزلية', 'إصلاح الغسّالات والثلاجات والأفران وغسّالات الأواني.',
            'Appliance repair', 'Repair of washing machines, fridges, ovens and dishwashers.'],
        ['Aluminium & vitrerie', 'Fenêtres et portes en aluminium, baies vitrées et remplacement de vitres.', 'bi-window',
            'ألمنيوم وبلّور', 'نوافذ وأبواب الألمنيوم، الواجهات البلّورية وتغيير البلّور.',
            'Aluminium & glazing', 'Aluminium windows and doors, glass sliding doors and glass replacement.'],
        ['Ferronnerie', 'Grilles de protection, portails, rampes et soudure.', 'bi-grid-3x3',
            'حدادة', 'شبابيك الحماية، البوّابات، الدرابزين واللحام.',
            'Metalwork', 'Security grilles, gates, railings and welding.'],
        ['Pompes & bâches à eau', 'Surpresseurs, pompes, citernes et bâches à eau.', 'bi-water',
            'مضخّات وخزّانات الماء', 'المضخّات، معزّزات الضغط، الخزّانات والمواجل.',
            'Water pumps & tanks', 'Booster pumps, water pumps, cisterns and storage tanks.'],
        ['Chauffage & gaz', 'Chauffage central, chaudières, radiateurs et raccordement au gaz.', 'bi-fire',
            'تدفئة وغاز', 'التدفئة المركزية، المراجل، المشعّات والربط بالغاز.',
            'Heating & gas', 'Central heating, boilers, radiators and gas connection.'],
        ['Énergie solaire', 'Chauffe-eau solaires et panneaux photovoltaïques (programmes Prosol).', 'bi-sun',
            'طاقة شمسية', 'سخّانات الماء الشمسية والألواح الكهروضوئية (برامج بروسول).',
            'Solar energy', 'Solar water heaters and photovoltaic panels (Prosol programmes).'],
    ];

    public function run(): void
    {
        foreach (self::CATALOGUE as [$nom, $description, $icone, $nom_ar, $description_ar, $nom_en, $description_en]) {
            CategorieService::firstOrCreate(
                ['nom' => $nom],
                compact('description', 'icone', 'nom_ar', 'description_ar', 'nom_en', 'description_en'),
            );
        }
    }
}
