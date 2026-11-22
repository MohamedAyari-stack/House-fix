<?php

namespace App\Http\Resources;

use App\Models\User;
use DateTimeInterface;
use Illuminate\Http\Resources\Json\JsonResource;

abstract class BaseResource extends JsonResource
{
    /** ISO 8601 UTC timestamp, e.g. 2026-04-01T10:00:00Z. */
    protected static function iso(?DateTimeInterface $date): ?string
    {
        return $date?->toIso8601ZuluString();
    }

    /** HH:mm (database may return HH:mm:ss). */
    protected static function hhmm(?string $time): ?string
    {
        return $time ? substr($time, 0, 5) : null;
    }

    /** YYYY-MM-DD. */
    protected static function ymd(mixed $date): ?string
    {
        if ($date instanceof DateTimeInterface) {
            return $date->format('Y-m-d');
        }

        return $date ? substr((string) $date, 0, 10) : null;
    }

    /** Compact user summary embedded in other objects. */
    protected static function miniUser(?User $user, array $fields = ['id', 'nom', 'photo_url']): ?array
    {
        if (! $user) {
            return null;
        }

        $data = [];
        foreach ($fields as $field) {
            $data[$field] = $field === 'photo_url' ? $user->photoUrl() : $user->{$field};
        }

        return $data;
    }
}
