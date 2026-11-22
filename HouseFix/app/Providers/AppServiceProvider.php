<?php

namespace App\Providers;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\ServiceProvider;
use Symfony\Component\Mailer\Bridge\Brevo\Transport\BrevoTransportFactory;
use Symfony\Component\Mailer\Transport\Dsn;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // The API contract returns bare objects/arrays, not { data: ... }.
        JsonResource::withoutWrapping();

        // MAIL_MAILER=brevo: emails go through the Brevo HTTP API (key in BREVO_API_KEY).
        Mail::extend('brevo', fn (array $config) => (new BrevoTransportFactory)->create(
            new Dsn('brevo+api', 'default', $config['key'] ?? null),
        ));
    }
}
