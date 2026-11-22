<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Rejects blocked accounts with 403; an expired temporary block is lifted on the fly. */
class EnsureNotBlocked
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->checkBlocked()) {
            return response()->json(['message' => $user->blockedMessage()], 403);
        }

        return $next($request);
    }
}
