<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Address -> GPS coordinates with OpenStreetMap Nominatim (free, no key), limited to Tunisia.
 * Used when an address is saved without coordinates, so the distances shown to clients match the address.
 */
class Geocoder
{
    /** @return array{lat: float, lng: float}|null null when the address cannot be found or the service fails */
    public function geocode(string $address, ?string $gouvernorat = null): ?array
    {
        $query = trim($address.($gouvernorat && ! str_contains(mb_strtolower($address), mb_strtolower($gouvernorat)) ? ', '.$gouvernorat : ''));
        if ($query === '' || ! config('services.geocoding.url')) {
            return null;
        }

        return Cache::remember('geocode:'.md5(mb_strtolower($query)), now()->addDays(30), function () use ($query) {
            try {
                $res = Http::timeout((float) config('services.geocoding.timeout'))
                    // Nominatim's usage policy requires an identifying User-Agent.
                    ->withHeaders(['User-Agent' => config('app.name').'/1.0 (plateforme de services a domicile)'])
                    ->get(rtrim(config('services.geocoding.url'), '/').'/search', [
                        'q' => $query, 'format' => 'jsonv2', 'limit' => 1, 'countrycodes' => 'tn', 'accept-language' => 'fr',
                    ]);
                $hit = $res->successful() ? ($res->json()[0] ?? null) : null;

                return $hit ? ['lat' => round((float) $hit['lat'], 7), 'lng' => round((float) $hit['lon'], 7)] : null;
            } catch (Throwable $e) {
                Log::warning('Geocoding failed', ['error' => $e->getMessage()]);

                return null;
            }
        });
    }
}
