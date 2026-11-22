<?php

use App\Services\AiRecommender;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('reco:status', function (AiRecommender $ai) {
    $status = $ai->status();
    if ($status === null) {
        $this->error('Service IA injoignable ('.config('services.ai_reco.url').'). Les recommandations utilisent la formule locale.');

        return 1;
    }

    $model = $status['model'];
    $this->info("Service IA en ligne — modèle : {$model['kind']}".($model['samples'] ? " ({$model['samples']} rendez-vous)" : ''));
    $this->table(['Critère', 'Poids'], collect($model['weights'])->map(fn ($w, $f) => [$f, $w])->values());

    return 0;
})->purpose('Show the AI recommendation service status and model weights');

Artisan::command('reco:train', function (AiRecommender $ai) {
    $this->info('Envoi de l\'historique des rendez-vous au service IA…');
    $result = $ai->train();
    if ($result === null) {
        $this->error('Service IA injoignable ('.config('services.ai_reco.url').').');

        return 1;
    }

    $result['trained'] ? $this->info($result['message']) : $this->warn($result['message']);
    $this->table(['Critère', 'Poids'], collect($result['weights'])->map(fn ($w, $f) => [$f, $w])->values());

    return 0;
})->purpose('Train the AI recommendation model on the finished rendez-vous');

// The model improves as rendez-vous accumulate (needs the scheduler: php artisan schedule:work).
Schedule::command('reco:train')->weeklyOn(1, '03:00');
