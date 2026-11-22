<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\EmailCode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Six-digit codes sent by email: to verify the address at sign-up (VERIFY)
 * and to choose a new password (RESET). Codes are stored hashed in email_codes,
 * expire after EXPIRE_MINUTES and are cancelled after MAX_ATTEMPTS wrong entries
 * (a 6-digit code must not be guessable).
 */
class EmailCodes
{
    public const VERIFY = 'verify';

    public const RESET = 'reset';

    public const EXPIRE_MINUTES = 15;

    public const MAX_ATTEMPTS = 5;

    /** Minimum delay between two emails for the same address and purpose. */
    public const RESEND_SECONDS = 60;

    /**
     * Creates and emails a new code. Returns false when a code was sent less than
     * RESEND_SECONDS ago (the previous one is still valid). Aborts with 503 when the email cannot be sent.
     */
    public function send(User $user, string $purpose): bool
    {
        $existing = $this->row($user->email, $purpose);
        if ($existing && Carbon::parse($existing->created_at)->addSeconds(self::RESEND_SECONDS)->isFuture()) {
            return false;
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        DB::table('email_codes')->updateOrInsert(
            ['email' => $user->email, 'purpose' => $purpose],
            ['code_hash' => Hash::make($code), 'created_at' => now()],
        );
        RateLimiter::clear($this->attemptsKey($user->email, $purpose));

        try {
            $user->notify(new EmailCode($code, $purpose, self::EXPIRE_MINUTES));
        } catch (Throwable $e) {
            // Without the email the code is useless: cancel it so a new request is not blocked by RESEND_SECONDS.
            $this->forget($user->email, $purpose);
            report($e);
            abort(503, __("L'email n'a pas pu être envoyé pour le moment. Réessayez dans quelques minutes."));
        }

        return true;
    }

    /** Throws a validation error on the "code" field when the code is wrong, expired or exhausted. */
    public function verify(string $email, string $purpose, string $code): void
    {
        $row = $this->row($email, $purpose);

        if (! $row || Carbon::parse($row->created_at)->addMinutes(self::EXPIRE_MINUTES)->isPast()) {
            $this->forget($email, $purpose);
            $this->fail(__('Ce code a expiré ou n\'existe pas. Demandez un nouveau code.'));
        }

        if (! Hash::check($code, $row->code_hash)) {
            $key = $this->attemptsKey($email, $purpose);
            RateLimiter::hit($key, self::EXPIRE_MINUTES * 60);
            $left = self::MAX_ATTEMPTS - RateLimiter::attempts($key);

            if ($left <= 0) {
                $this->forget($email, $purpose);
                $this->fail(__('Trop de codes incorrects. Ce code est annulé : demandez un nouveau code.'));
            }

            $this->fail($left > 1
                ? __('Code incorrect. Il vous reste :left tentatives.', ['left' => $left])
                : __('Code incorrect. Il vous reste :left tentative.', ['left' => $left]));
        }
    }

    /** Invalidates the code once it has been used (or cancelled). */
    public function forget(string $email, string $purpose): void
    {
        DB::table('email_codes')->where(['email' => $email, 'purpose' => $purpose])->delete();
        RateLimiter::clear($this->attemptsKey($email, $purpose));
    }

    private function row(string $email, string $purpose): ?object
    {
        return DB::table('email_codes')->where(['email' => $email, 'purpose' => $purpose])->first();
    }

    private function attemptsKey(string $email, string $purpose): string
    {
        return "email-code:{$purpose}:".mb_strtolower($email);
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['code' => [$message]]);
    }
}
