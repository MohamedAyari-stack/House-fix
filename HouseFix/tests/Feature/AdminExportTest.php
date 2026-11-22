<?php

namespace Tests\Feature;

use App\Models\RendezVous;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

class AdminExportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        Sanctum::actingAs(User::where('email', 'admin@housefix.tn')->first());
    }

    /** CSV rows, without the UTF-8 BOM. */
    private function csv(string $query, string $lang = 'fr'): array
    {
        $response = $this->get('/api/admin/export?'.$query, ['Accept-Language' => $lang])->assertOk();
        $body = $response->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $body, 'BOM so that Excel reads UTF-8');

        return array_values(array_filter(explode("\n", substr($body, 3))));
    }

    public function test_only_admins_can_export(): void
    {
        Sanctum::actingAs(User::where('email', 'client@housefix.tn')->first());
        $this->getJson('/api/admin/export?type=utilisateurs&format=csv')->assertForbidden();
    }

    public function test_every_dataset_exports_as_csv_with_translated_headers(): void
    {
        $expected = [
            'statistiques' => 'Indicateur;Valeur',
            'utilisateurs' => 'ID;Nom;Email;Téléphone;Rôle;Gouvernorat',
            'prestataires' => 'ID;Nom;Email;Téléphone;Gouvernorat;Catégorie',
            'rendez_vous' => 'ID;Date;Heure;Client;Prestataire;Catégorie;Statut',
            'factures' => 'Numéro;Date;Client;Prestataire;"Montant (DT)"',
            'litiges' => 'ID;"Ouvert le";Déclarant;Contre',
        ];
        foreach ($expected as $type => $header) {
            $lines = $this->csv("type=$type&format=csv");
            $this->assertStringStartsWith($header, $lines[0], $type);
            $this->assertGreaterThan(1, count($lines), "$type has data rows");
        }

        $users = implode("\n", $this->csv('type=utilisateurs&format=csv'));
        $this->assertStringContainsString('client@housefix.tn', $users);
        $this->assertStringContainsString(';Administrateur;', $users);
    }

    public function test_the_period_filter_keeps_only_appointments_in_range(): void
    {
        $day = RendezVous::orderBy('date')->value('date');
        $inRange = RendezVous::whereDate('date', $day)->count();

        $lines = $this->csv("type=rendez_vous&format=csv&du=$day&au=$day");

        $this->assertCount($inRange + 1, $lines);
    }

    public function test_the_full_workbook_has_one_sheet_per_dataset_in_arabic_right_to_left(): void
    {
        $response = $this->get('/api/admin/export?type=tout&format=xlsx', ['Accept-Language' => 'ar'])
            ->assertOk()
            ->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $file = tempnam(sys_get_temp_dir(), 'hf').'.xlsx';
        file_put_contents($file, $response->streamedContent());
        $book = IOFactory::load($file);
        unlink($file);

        $this->assertSame(['الإحصائيات', 'حالات المواعيد', 'المواعيد حسب الشهر', 'المستخدمون', 'مقدّمو الخدمات', 'المواعيد', 'الفواتير', 'النزاعات'], $book->getSheetNames());
        $users = $book->getSheetByName('المستخدمون');
        $this->assertTrue($users->getRightToLeft());
        $this->assertSame('A2', $users->getFreezePane());
        $this->assertSame('الاسم', $users->getCell('B1')->getValue());
        $this->assertContains('تونس', array_column($users->toArray(), 5), 'governorate in Arabic');
    }

    public function test_english_csv_uses_comma_separator_and_decimal_point(): void
    {
        $lines = $this->csv('type=statistiques&format=csv', 'en');

        $this->assertSame('Indicator,Value', $lines[0]);
        $this->assertMatchesRegularExpression('/^"Acceptance rate \(%\)",\d+(\.\d)?$/', collect($lines)->first(fn ($l) => str_contains($l, 'Acceptance')));
    }

    public function test_invalid_requests_are_refused(): void
    {
        $this->getJson('/api/admin/export?type=tout&format=csv')->assertUnprocessable()->assertJsonValidationErrors('format');
        $this->getJson('/api/admin/export?type=mots_de_passe&format=csv')->assertUnprocessable()->assertJsonValidationErrors('type');
        $this->getJson('/api/admin/export?type=factures&format=pdf')->assertUnprocessable()->assertJsonValidationErrors('format');
        $this->getJson('/api/admin/export?type=factures&format=csv&du=2026-05-01&au=2026-04-01')->assertUnprocessable()->assertJsonValidationErrors('au');
    }
}
