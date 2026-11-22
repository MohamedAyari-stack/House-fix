<?php

namespace App\Http\Resources;

use App\Models\Message;
use Illuminate\Http\Request;

/** @mixin Message */
class MessageResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'sender_id' => $this->sender_id,
            'receiver_id' => $this->receiver_id,
            'content' => $this->content,
            'type' => $this->type,
            'is_read' => (bool) $this->is_read,
            // Path of the authorized download route (the file itself stays on the private disk).
            'attachment' => $this->hasAttachment() ? [
                'name' => $this->attachment_name,
                'mime' => $this->attachment_mime,
                'size' => $this->attachment_size,
                'url' => "/messages/{$this->id}/attachment",
            ] : null,
            'created_at' => self::iso($this->created_at),
        ];
    }
}
