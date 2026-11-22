<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // Python AI recommendation service (ai-recommendation-service/). Without it, the local formula is used.
    // Address -> coordinates (OpenStreetMap Nominatim). Empty URL disables geocoding.
    'geocoding' => [
        'url' => env('GEOCODING_URL', 'https://nominatim.openstreetmap.org'),
        'timeout' => (float) env('GEOCODING_TIMEOUT', 5),
    ],

    'ai_reco' => [
        'url' => env('AI_RECO_URL', 'http://127.0.0.1:8100'),
        'key' => env('AI_RECO_KEY'),
        'timeout' => (float) env('AI_RECO_TIMEOUT', 2),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
