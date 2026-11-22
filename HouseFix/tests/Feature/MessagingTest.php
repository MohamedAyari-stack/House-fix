<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MessagingTest extends TestCase
{
    use RefreshDatabase;

    private User $client;

    private User $presta;

    private Conversation $conv;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(Message::DISK);
        $this->client = User::factory()->client()->create(['nom' => 'Salma Client']);
        $this->presta = User::factory()->prestataire()->create(['nom' => 'Ali Plombier']);
        $this->conv = Conversation::create(['client_id' => $this->client->id, 'prestataire_id' => $this->presta->id]);
    }

    private function say(User $from, string $text, int $times = 1): void
    {
        $to = $from->is($this->client) ? $this->presta : $this->client;
        for ($i = 0; $i < $times; $i++) {
            $this->conv->messages()->create(['sender_id' => $from->id, 'receiver_id' => $to->id, 'content' => "$text $i", 'type' => Message::TEXT]);
        }
    }

    public function test_history_is_paginated_from_the_most_recent_messages(): void
    {
        $this->say($this->presta, 'msg', 45);
        Sanctum::actingAs($this->client);

        $latest = $this->getJson("/api/conversations/{$this->conv->id}/messages")->assertOk()->assertJsonCount(30)->json();
        $this->assertSame('msg 44', end($latest)['content'], 'latest message last');
        $this->assertSame('msg 15', $latest[0]['content']);

        $older = $this->getJson("/api/conversations/{$this->conv->id}/messages?before_id={$latest[0]['id']}")->assertOk()->assertJsonCount(15)->json();
        $this->assertSame('msg 0', $older[0]['content']);

        $this->assertSame(0, Message::where('receiver_id', $this->client->id)->where('is_read', false)->count(), 'opening marks as read');
    }

    public function test_updates_return_only_new_messages_read_receipts_and_typing(): void
    {
        $this->say($this->client, 'bonjour');
        $lastId = Message::max('id');

        // The prestataire opens the conversation (reads the message) and starts typing.
        Sanctum::actingAs($this->presta);
        $this->getJson("/api/conversations/{$this->conv->id}/messages")->assertOk();
        $this->postJson("/api/conversations/{$this->conv->id}/typing")->assertNoContent();

        Sanctum::actingAs($this->client);
        $this->getJson("/api/conversations/{$this->conv->id}/updates?after_id=$lastId")
            ->assertOk()
            ->assertJsonCount(0, 'messages')
            ->assertJsonPath('last_read_id', $lastId)
            ->assertJsonPath('typing', true);

        // The prestataire answers: typing stops, the new message arrives.
        Sanctum::actingAs($this->presta);
        $this->postJson("/api/conversations/{$this->conv->id}/messages", ['content' => 'Je passe demain'])->assertCreated();

        Sanctum::actingAs($this->client);
        $this->getJson("/api/conversations/{$this->conv->id}/updates?after_id=$lastId")
            ->assertJsonCount(1, 'messages')
            ->assertJsonPath('messages.0.content', 'Je passe demain')
            ->assertJsonPath('typing', false);
    }

    public function test_a_photo_can_be_sent_and_only_participants_can_open_it(): void
    {
        Sanctum::actingAs($this->client);
        $message = $this->post("/api/conversations/{$this->conv->id}/messages", [
            'file' => UploadedFile::fake()->image('fuite.jpg', 800, 600),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('type', 'image')
            ->assertJsonPath('content', null)
            ->assertJsonPath('attachment.name', 'fuite.jpg')
            ->json();

        Storage::disk(Message::DISK)->assertExists(Message::find($message['id'])->attachment_path);
        $this->assertSame("/messages/{$message['id']}/attachment", $message['attachment']['url']);

        Sanctum::actingAs($this->presta);
        $this->get("/api/messages/{$message['id']}/attachment")->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->assertStringContainsString('photo', AppNotification::where('user_id', $this->presta->id)->latest('id')->value('message'));

        Sanctum::actingAs(User::factory()->client()->create());
        $this->getJson("/api/messages/{$message['id']}/attachment")->assertForbidden();
    }

    public function test_a_pdf_with_text_is_a_document_downloaded_as_attachment(): void
    {
        Sanctum::actingAs($this->presta);
        $id = $this->post("/api/conversations/{$this->conv->id}/messages", [
            'content' => 'Voici le devis',
            'file' => UploadedFile::fake()->create('devis.pdf', 120, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('type', 'file')->json('id');

        Sanctum::actingAs($this->client);
        $this->get("/api/messages/$id/attachment")->assertOk()->assertDownload('devis.pdf');
    }

    public function test_invalid_messages_are_refused(): void
    {
        Sanctum::actingAs($this->client);
        $url = "/api/conversations/{$this->conv->id}/messages";

        $this->postJson($url, [])->assertUnprocessable()->assertJsonValidationErrors('content');
        $this->post($url, ['file' => UploadedFile::fake()->create('virus.exe', 10)], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonPath('errors.file.0', 'Pièce jointe acceptée : image JPG, PNG ou WebP, ou document PDF.');
        $this->post($url, ['file' => UploadedFile::fake()->image('enorme.jpg')->size(6000)], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonPath('errors.file.0', 'La pièce jointe ne doit pas dépasser 5 Mo.');

        Sanctum::actingAs(User::factory()->client()->create());
        $this->postJson($url, ['content' => 'intrus'])->assertForbidden();
        $this->getJson("/api/conversations/{$this->conv->id}/updates?after_id=0")->assertForbidden();
        $this->postJson("/api/conversations/{$this->conv->id}/typing")->assertForbidden();
    }

    public function test_unread_count_for_the_menu_badge(): void
    {
        $this->say($this->presta, 'hello', 3);
        Sanctum::actingAs($this->client);

        $this->getJson('/api/conversations/unread-count')->assertOk()->assertJsonPath('count', 3);
        $this->getJson("/api/conversations/{$this->conv->id}/messages")->assertOk();
        $this->getJson('/api/conversations/unread-count')->assertJsonPath('count', 0);
    }

    public function test_deleting_a_message_deletes_its_file(): void
    {
        Sanctum::actingAs($this->client);
        $id = $this->post("/api/conversations/{$this->conv->id}/messages", ['file' => UploadedFile::fake()->image('a.png')], ['Accept' => 'application/json'])->json('id');
        $path = Message::find($id)->attachment_path;

        Message::find($id)->delete();

        Storage::disk(Message::DISK)->assertMissing($path);
    }
}
