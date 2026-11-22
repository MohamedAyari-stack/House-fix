<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

/**
 * Applies the language sent by the app in Accept-Language (fr|ar|en) to messages and validation errors.
 * The signed-in user's stored locale follows it, so emails and notifications later go out in that language.
 */
class SetLocale
{
    public const SUPPORTED = ['fr', 'ar', 'en'];

    /** Not config('app.locale'): App::setLocale() overwrites it, so it would carry over to the next request (tests, Octane). */
    public const DEFAULT = 'fr';

    public function handle(Request $request, Closure $next): Response
    {
        $locale = self::fromHeader($request);
        App::setLocale($locale ?? self::DEFAULT);

        if ($locale && ($user = $request->user('sanctum')) && $user->locale !== $locale) {
            $user->forceFill(['locale' => $locale])->saveQuietly();
        }

        return $next($request);
    }

    /** First supported language of the Accept-Language header ("ar-TN" → "ar"), or null. */
    public static function fromHeader(Request $request): ?string
    {
        if (! $request->hasHeader('Accept-Language')) {
            return null;
        }

        foreach ($request->getLanguages() as $language) {
            $primary = strtolower(strtok($language, '_-'));
            if (in_array($primary, self::SUPPORTED, true)) {
                return $primary;
            }
        }

        return null;
    }
}
