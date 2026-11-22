<?php

use App\Http\Controllers\Api\AccueilController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AdminExportController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategorieController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EvaluationController;
use App\Http\Controllers\Api\FactureController;
use App\Http\Controllers\Api\TauxTvaController;
use App\Http\Controllers\Api\LitigeController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PrestataireController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\RendezVousController;
use App\Http\Controllers\Api\ServicePageController;
use Illuminate\Support\Facades\Route;

/*
| DarFix REST API — see docs/API.md for the contract.
| All routes are prefixed with /api.
*/

// Public
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::middleware('throttle:10,1')->group(function () {
    Route::post('/auth/verify-email', [AuthController::class, 'verifyEmail']);
    Route::post('/auth/resend-verification', [AuthController::class, 'resendVerification']);
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/auth/verify-reset-code', [AuthController::class, 'verifyResetCode']);
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);
});
Route::get('/categories', [CategorieController::class, 'index']);
Route::get('/taux-tva', [TauxTvaController::class, 'index']);
Route::get('/accueil', AccueilController::class);
Route::get('/services', [ServicePageController::class, 'index']);
Route::get('/services/{slug}', [ServicePageController::class, 'show']);

Route::middleware(['auth:sanctum', 'not_blocked'])->group(function () {
    // Auth & profile
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::post('/profile/photo', [ProfileController::class, 'photo']);
    Route::put('/profile/password', [ProfileController::class, 'password']);

    // Prestataire search
    Route::get('/prestataires', [PrestataireController::class, 'index']);
    Route::get('/prestataires/recommandations', [PrestataireController::class, 'recommandations']);
    Route::get('/prestataires/{id}', [PrestataireController::class, 'show'])->whereNumber('id');

    // Rendez-vous
    Route::get('/rendez-vous', [RendezVousController::class, 'index']);
    Route::get('/rendez-vous/{rendezVous}', [RendezVousController::class, 'show']);
    Route::middleware('role:client')->group(function () {
        Route::post('/rendez-vous', [RendezVousController::class, 'store']);
        Route::post('/rendez-vous/{rendezVous}/annuler', [RendezVousController::class, 'annuler']);
    });
    Route::middleware('role:prestataire')->group(function () {
        Route::post('/rendez-vous/{rendezVous}/accepter', [RendezVousController::class, 'accepter']);
        Route::post('/rendez-vous/{rendezVous}/refuser', [RendezVousController::class, 'refuser']);
        Route::patch('/rendez-vous/{rendezVous}/horaire', [RendezVousController::class, 'horaire']);
        Route::post('/rendez-vous/{rendezVous}/terminer', [RendezVousController::class, 'terminer']);
        Route::post('/rendez-vous/{rendezVous}/facture', [RendezVousController::class, 'facturer']);
    });

    // Factures & paiements
    Route::get('/factures', [FactureController::class, 'index']);
    Route::get('/factures/{facture}', [FactureController::class, 'show']);
    Route::get('/factures/{facture}/pdf', [FactureController::class, 'pdf']);
    Route::post('/factures/{facture}/payer', [FactureController::class, 'payer'])->middleware('role:client');
    Route::post('/factures/{facture}/confirmer-especes', [FactureController::class, 'confirmerEspeces'])->middleware('role:prestataire');
    Route::post('/factures/{facture}/encaisser-especes', [FactureController::class, 'encaisserEspeces'])->middleware('role:prestataire');
    Route::post('/factures/{facture}/refuser-especes', [FactureController::class, 'refuserEspeces'])->middleware('role:prestataire');
    Route::post('/factures/{facture}/annuler-especes', [FactureController::class, 'annulerEspeces'])->middleware('role:client');

    // Dashboards
    Route::get('/client/dashboard', [DashboardController::class, 'client'])->middleware('role:client');
    Route::middleware('role:prestataire')->group(function () {
        Route::patch('/prestataire/availability', [ProfileController::class, 'availability']);
        Route::get('/prestataire/dashboard', [DashboardController::class, 'prestataire']);
        Route::get('/prestataire/revenus', [DashboardController::class, 'revenusPrestataire']);
        Route::get('/prestataire/calendrier', [DashboardController::class, 'calendrier']);
    });

    // Évaluations
    Route::get('/evaluations', [EvaluationController::class, 'index']);
    Route::middleware('role:client')->group(function () {
        Route::post('/evaluations', [EvaluationController::class, 'store']);
        Route::put('/evaluations/{evaluation}', [EvaluationController::class, 'update']);
    });
    Route::post('/evaluations/{evaluation}/repondre', [EvaluationController::class, 'repondre'])->middleware('role:prestataire');

    // Messagerie
    Route::get('/conversations', [ConversationController::class, 'index']);
    Route::get('/conversations/unread-count', [ConversationController::class, 'unreadCount']);
    Route::post('/conversations', [ConversationController::class, 'store'])->middleware('role:client,prestataire');
    Route::get('/conversations/{conversation}/messages', [ConversationController::class, 'messages']);
    Route::post('/conversations/{conversation}/messages', [ConversationController::class, 'send'])->middleware('throttle:30,1');
    Route::get('/conversations/{conversation}/updates', [ConversationController::class, 'updates']);
    Route::post('/conversations/{conversation}/typing', [ConversationController::class, 'typing'])->middleware('throttle:60,1');
    Route::get('/messages/{message}/attachment', [ConversationController::class, 'attachment']);

    // Litiges
    Route::get('/litiges', [LitigeController::class, 'index']);
    Route::post('/litiges', [LitigeController::class, 'store'])->middleware('role:client,prestataire');

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/lire-tout', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/lu', [NotificationController::class, 'markRead'])->whereNumber('id');

    // Administration
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'admin']);
        Route::get('/export', AdminExportController::class);

        Route::post('/categories', [CategorieController::class, 'store']);
        Route::put('/categories/{categorie}', [CategorieController::class, 'update']);
        Route::delete('/categories/{categorie}', [CategorieController::class, 'destroy']);
        Route::post('/taux-tva', [TauxTvaController::class, 'store']);
        Route::put('/taux-tva/{tauxTva}', [TauxTvaController::class, 'update']);
        Route::delete('/taux-tva/{tauxTva}', [TauxTvaController::class, 'destroy']);

        Route::delete('/evaluations/{evaluation}', [EvaluationController::class, 'destroy']);
        Route::patch('/litiges/{litige}', [LitigeController::class, 'update']);

        Route::get('/users', [AdminController::class, 'users']);
        Route::get('/prestataires', [AdminController::class, 'prestataires']);
        Route::get('/validations', [AdminController::class, 'validations']);
        Route::post('/prestataires/{id}/valider', [AdminController::class, 'valider'])->whereNumber('id');
        Route::post('/prestataires/{id}/refuser', [AdminController::class, 'refuser'])->whereNumber('id');
        Route::post('/users/{user}/bloquer', [AdminController::class, 'bloquer']);
        Route::post('/users/{user}/debloquer', [AdminController::class, 'debloquer']);
        Route::delete('/users/{user}', [AdminController::class, 'destroy']);
    });
});
