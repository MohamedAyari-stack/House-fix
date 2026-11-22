<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | The Angular dev server (http://localhost:4200) calls the API with a
    | Bearer token: no cookies, so credentials support stays disabled.
    |
    */

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_filter(explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:4200'))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    // Lets the frontend read the PDF filename on /factures/{id}/pdf.
    'exposed_headers' => ['Content-Disposition'],

    'max_age' => 0,

    'supports_credentials' => false,

];
