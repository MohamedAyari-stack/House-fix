<?php

namespace App\Http\Resources;

use App\Models\Conversation;
use Illuminate\Http\Request;

/** @mixin Conversation */
class ConversationResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        $me = $request->user();

        return [
            'id' => $this->id,
            'client_id' => $this->client_id,
            'prestataire_id' => $this->prestataire_id,
            'other_user' => self::miniUser($this->otherUser($me), ['id', 'nom', 'photo_url', 'role']),
            'last_message' => $this->lastMessage ? new MessageResource($this->lastMessage) : null,
            'unread_count' => (int) ($this->unread_count
                ?? $this->messages()->where('receiver_id', $me->id)->where('is_read', false)->count()),
            'updated_at' => self::iso($this->updated_at),
        ];
    }
}
