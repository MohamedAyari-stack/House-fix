<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class Message extends Model
{
    /** Message kinds: plain text, image (shown inline) or another file (PDF). */
    public const TEXT = 'text';

    public const IMAGE = 'image';

    public const FILE = 'file';

    /** Private disk: attachments are never reachable by a public URL. */
    public const DISK = 'local';

    protected $fillable = [
        'conversation_id', 'sender_id', 'receiver_id', 'content', 'type', 'is_read',
        'attachment_path', 'attachment_name', 'attachment_mime', 'attachment_size',
    ];

    // Posting a message bumps the conversation's updated_at (used for ordering).
    protected $touches = ['conversation'];

    protected static function booted(): void
    {
        // The file goes with its message (conversation or account deletion cascades only through the database).
        static::deleted(function (Message $message) {
            if ($message->attachment_path) {
                Storage::disk(self::DISK)->delete($message->attachment_path);
            }
        });
    }

    protected function casts(): array
    {
        return ['is_read' => 'boolean', 'attachment_size' => 'integer'];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'receiver_id');
    }

    public function hasAttachment(): bool
    {
        return $this->attachment_path !== null;
    }
}
