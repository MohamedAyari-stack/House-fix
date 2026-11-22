<?php

namespace App\Http\Resources;

use App\Models\AppNotification;
use Illuminate\Http\Request;

/** @mixin AppNotification */
class NotificationResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'titre' => $this->titre,
            'message' => $this->message,
            'type' => $this->type,
            'lien' => $this->lien,
            'lu' => (bool) $this->lu,
            'created_at' => self::iso($this->created_at),
        ];
    }
}
