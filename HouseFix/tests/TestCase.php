<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Http;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // No real network in tests (e.g. the AI recommendation service): tests use Http::fake().
        Http::preventStrayRequests();

        // Like the Angular app. Without it Symfony's test requests send "Accept-Language: en-us,en;q=0.5".
        $this->withHeader('Accept-Language', 'fr');
    }
}
