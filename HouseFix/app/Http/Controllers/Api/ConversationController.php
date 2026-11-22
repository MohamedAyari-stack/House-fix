<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ConversationResource;
use App\Http\Resources\MessageResource;
use App\Models\AppNotification;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ConversationController extends Controller
{
    /** Messages per page of history. */
    private const PAGE = 30;

    /** How long a "typing…" signal lasts without a new one (the app sends one every few seconds while typing). */
    private const TYPING_SECONDS = 6;

    /** Attachments: photos of the problem, quotes or invoices in PDF. */
    private const ATTACHMENT_RULES = ['file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'];

    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        $conversations = Conversation::query()
            ->where(fn ($q) => $q->where('client_id', $user->id)->orWhere('prestataire_id', $user->id))
            ->with(['client', 'prestataire', 'lastMessage'])
            ->withCount(['messages as unread_count' => fn ($q) => $q->where('receiver_id', $user->id)->where('is_read', false)])
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->get();

        return ConversationResource::collection($conversations);
    }

    /** Total unread messages, for the badge of the "Messages" menu entry. */
    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json([
            'count' => Message::where('receiver_id', $request->user()->id)->where('is_read', false)->count(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['user_id' => ['required', 'integer', 'exists:users,id']]);

        $me = $request->user();
        $other = User::findOrFail($data['user_id']);

        // Conversations only exist between a client and a prestataire.
        $valid = ($me->isClient() && $other->isPrestataire()) || ($me->isPrestataire() && $other->isClient());
        if (! $valid) {
            return response()->json(['message' => __('Une conversation n\'est possible qu\'entre un client et un prestataire.')], 422);
        }

        [$clientId, $prestataireId] = $me->isClient() ? [$me->id, $other->id] : [$other->id, $me->id];

        $conversation = Conversation::firstOrCreate(['client_id' => $clientId, 'prestataire_id' => $prestataireId]);
        $conversation->load(['client', 'prestataire', 'lastMessage']);

        return (new ConversationResource($conversation))->response()->setStatusCode(200);
    }

    /**
     * History, most recent page by default (in chronological order); ?before_id= loads the page before it.
     * Opening the conversation marks the received messages as read.
     */
    public function messages(Request $request, Conversation $conversation): AnonymousResourceCollection
    {
        $user = $this->participant($request, $conversation);
        $data = $request->validate(['before_id' => ['nullable', 'integer']]);

        $this->markRead($conversation, $user);

        $page = $conversation->messages()
            ->when($data['before_id'] ?? null, fn ($q, $id) => $q->where('id', '<', $id))
            ->orderByDesc('id')
            ->limit(self::PAGE)
            ->get()
            ->reverse()
            ->values();

        return MessageResource::collection($page);
    }

    /**
     * Polled every few seconds by the open conversation: only what changed since ?after_id=,
     * the read receipt of my own messages and whether the other person is typing.
     */
    public function updates(Request $request, Conversation $conversation): JsonResponse
    {
        $user = $this->participant($request, $conversation);
        $data = $request->validate(['after_id' => ['required', 'integer', 'min:0']]);

        $this->markRead($conversation, $user);
        $other = $user->id === $conversation->client_id ? $conversation->prestataire_id : $conversation->client_id;

        return response()->json([
            'messages' => MessageResource::collection(
                $conversation->messages()->where('id', '>', $data['after_id'])->orderBy('id')->limit(100)->get()
            ),
            // My messages up to this id have been read (✓✓).
            'last_read_id' => $conversation->messages()->where('sender_id', $user->id)->where('is_read', true)->max('id'),
            'typing' => Cache::has($this->typingKey($conversation, $other)),
        ]);
    }

    /** "Typing…" signal, kept for a few seconds. */
    public function typing(Request $request, Conversation $conversation): Response
    {
        $user = $this->participant($request, $conversation);
        Cache::put($this->typingKey($conversation, $user->id), true, self::TYPING_SECONDS);

        return response()->noContent();
    }

    /** Text, attachment, or both (multipart when there is a file). */
    public function send(Request $request, Conversation $conversation): JsonResponse
    {
        $user = $this->participant($request, $conversation);

        $data = $request->validate([
            'content' => ['nullable', 'string', 'max:2000', 'required_without:file'],
            'file' => ['nullable', 'required_without:content', ...self::ATTACHMENT_RULES],
        ], [
            'content.required_without' => __('Écrivez un message ou joignez un fichier.'),
            'file.mimes' => __('Pièce jointe acceptée : image JPG, PNG ou WebP, ou document PDF.'),
            'file.max' => __('La pièce jointe ne doit pas dépasser 5 Mo.'),
        ]);

        $receiverId = $user->id === $conversation->client_id ? $conversation->prestataire_id : $conversation->client_id;
        $file = $request->file('file');
        $content = trim((string) ($data['content'] ?? '')) ?: null;

        $message = $conversation->messages()->create([
            'sender_id' => $user->id,
            'receiver_id' => $receiverId,
            'content' => $content,
            'type' => $file ? (str_starts_with((string) $file->getMimeType(), 'image/') ? Message::IMAGE : Message::FILE) : Message::TEXT,
            'attachment_path' => $file?->store("messages/{$conversation->id}", Message::DISK),
            'attachment_name' => $file ? mb_substr($file->getClientOriginalName(), 0, 255) : null,
            'attachment_mime' => $file?->getMimeType(),
            'attachment_size' => $file?->getSize(),
        ]);

        // Sending also means "no longer typing".
        Cache::forget($this->typingKey($conversation, $user->id));

        $text = match ($message->type) {
            Message::IMAGE => ':nom vous a envoyé une photo.',
            Message::FILE => ':nom vous a envoyé un document.',
            default => ':nom vous a envoyé un message.',
        };
        AppNotification::send($receiverId, 'Nouveau message', $text, 'message', '/messages', ['nom' => $user->nom]);

        return (new MessageResource($message))->response()->setStatusCode(201);
    }

    /** The attachment, only for the two participants: images are shown inline, documents downloaded. */
    public function attachment(Request $request, Message $message): StreamedResponse
    {
        $this->participant($request, $message->conversation);
        abort_unless($message->hasAttachment() && Storage::disk(Message::DISK)->exists($message->attachment_path), 404);

        $disposition = $message->type === Message::IMAGE ? 'inline' : 'attachment';

        return Storage::disk(Message::DISK)->response($message->attachment_path, $message->attachment_name, [
            'Content-Type' => $message->attachment_mime,
            'Cache-Control' => 'private, max-age=86400',
            'X-Content-Type-Options' => 'nosniff',
        ], $disposition);
    }

    private function participant(Request $request, Conversation $conversation): User
    {
        $user = $request->user();
        abort_unless($conversation->isParticipant($user), 403, __('Accès non autorisé à cette conversation.'));

        return $user;
    }

    /** Bulk update: does not touch the conversation's updated_at. */
    private function markRead(Conversation $conversation, User $user): void
    {
        $conversation->messages()->where('receiver_id', $user->id)->where('is_read', false)->update(['is_read' => true]);
    }

    private function typingKey(Conversation $conversation, int $userId): string
    {
        return "typing:{$conversation->id}:{$userId}";
    }
}
