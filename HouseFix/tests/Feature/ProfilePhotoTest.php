<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProfilePhotoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    public function test_clients_and_prestataires_can_upload_a_profile_photo(): void
    {
        foreach ([User::factory()->client()->create(), User::factory()->prestataire()->create()] as $user) {
            Sanctum::actingAs($user);

            $response = $this->post('/api/profile/photo', ['photo' => UploadedFile::fake()->image('moi.jpg', 400, 400)], ['Accept' => 'application/json'])
                ->assertOk();

            $path = $user->fresh()->photo_path;
            Storage::disk('public')->assertExists($path);
            $this->assertStringEndsWith($path, $response->json('photo_url'));
        }
    }

    public function test_a_new_photo_replaces_and_deletes_the_old_one(): void
    {
        $user = User::factory()->client()->create();
        Sanctum::actingAs($user);

        $this->post('/api/profile/photo', ['photo' => UploadedFile::fake()->image('a.png')], ['Accept' => 'application/json'])->assertOk();
        $old = $user->fresh()->photo_path;
        $this->post('/api/profile/photo', ['photo' => UploadedFile::fake()->image('b.webp')], ['Accept' => 'application/json'])->assertOk();

        Storage::disk('public')->assertMissing($old);
        Storage::disk('public')->assertExists($user->fresh()->photo_path);
    }

    public function test_other_formats_and_large_files_are_refused(): void
    {
        Sanctum::actingAs(User::factory()->client()->create());

        $this->post('/api/profile/photo', ['photo' => UploadedFile::fake()->image('anim.gif')], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.photo.0', 'La photo doit être une image JPG, PNG ou WebP.');

        $this->post('/api/profile/photo', ['photo' => UploadedFile::fake()->create('cv.pdf', 100, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertUnprocessable();

        $this->post('/api/profile/photo', ['photo' => UploadedFile::fake()->image('big.jpg')->size(3000)], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.photo.0', 'La photo ne doit pas dépasser 2 Mo.');
    }
}
