<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\AppNotification;
use App\Models\User;
use App\Services\EmailCodes;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class AuthController extends Controller
{
    private const CODE_RULES = ['required', 'digits:6'];

    /**
     * Creates the account and emails a verification code. No token is returned:
     * the user is signed in once the code is confirmed (POST /auth/verify-email).
     */
    public function register(Request $request, EmailCodes $codes): JsonResponse
    {
        $data = $request->validate([
            'nom' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'telephone' => ['required', 'string', 'max:30'],
            'gouvernorat' => ['required', Rule::in(User::GOUVERNORATS)],
            'role' => ['required', Rule::in([User::ROLE_CLIENT, User::ROLE_PRESTATAIRE])],
            'categorie_service_id' => ['nullable', 'integer', 'exists:categories_services,id'],
            // Consent to the terms of use and privacy policy, in the version currently published.
            'accepte_conditions' => ['accepted'],
            'terms_version' => ['required', Rule::in([config('app.terms_version')])],
        ], [
            'email.unique' => __('Cette adresse e-mail est déjà utilisée.'),
            'accepte_conditions.accepted' => __("Vous devez accepter les conditions d'utilisation et la politique de confidentialité pour créer un compte."),
            'terms_version.*' => __("Les conditions d'utilisation ont été mises à jour. Rechargez la page pour les accepter."),
        ]);

        $user = DB::transaction(function () use ($data) {
            $isPrestataire = $data['role'] === User::ROLE_PRESTATAIRE;

            $user = User::create([
                'nom' => $data['nom'],
                'email' => $data['email'],
                'password' => $data['password'],
                'telephone' => $data['telephone'],
                'gouvernorat' => $data['gouvernorat'],
                // Language of the app at sign-up (Accept-Language), used for the emails.
                'locale' => app()->getLocale(),
                'role' => $data['role'],
                'statut' => 'actif',
                'is_verified' => ! $isPrestataire,
            ]);
            // Proof of consent: when and which version of the documents was accepted.
            $user->forceFill(['terms_accepted_at' => now(), 'terms_version' => $data['terms_version']])->save();

            if ($isPrestataire) {
                $user->prestataireProfile()->create([
                    'categorie_service_id' => $data['categorie_service_id'] ?? null,
                    'validation_status' => 'en_attente',
                ]);
            }

            return $user;
        });

        // The account exists even if the email fails: the user can ask for a new code from the verification page.
        $sent = $this->sendCode($codes, $user, EmailCodes::VERIFY);

        return response()->json([
            'message' => $sent
                ? __('Compte créé. Un code de vérification a été envoyé à :email.', ['email' => $user->email])
                : __("Compte créé, mais l'email de vérification n'a pas pu être envoyé. Demandez un nouveau code."),
            'email' => $user->email,
            'email_sent' => $sent,
        ], 201);
    }

    /** Confirms the address with the code received by email, then signs the user in. */
    public function verifyEmail(Request $request, EmailCodes $codes): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email'], 'code' => self::CODE_RULES], $this->codeMessages());

        $user = User::where('email', $data['email'])->first();
        if ($user?->hasVerifiedEmail()) {
            throw ValidationException::withMessages(['code' => [__('Cette adresse est déjà vérifiée. Connectez-vous.')]]);
        }

        $codes->verify($data['email'], EmailCodes::VERIFY, $data['code']);

        $user->forceFill(['email_verified_at' => now()])->save();
        $codes->forget($user->email, EmailCodes::VERIFY);

        if ($user->isPrestataire()) {
            AppNotification::sendToAdmins(
                'Nouveau prestataire à valider',
                ":nom s'est inscrit en tant que prestataire et attend votre validation.",
                'compte',
                '/admin/validations',
                ['nom' => $user->nom],
            );
        }

        return $this->signIn($user);
    }

    /** Sends a new verification code. Same answer whatever the address, so it cannot reveal accounts. */
    public function resendVerification(Request $request, EmailCodes $codes): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email']]);

        $user = User::where('email', $data['email'])->first();
        if ($user && ! $user->hasVerifiedEmail()) {
            $codes->send($user, EmailCodes::VERIFY);
        }

        return response()->json(['message' => __('Si cette adresse attend une vérification, un nouveau code vient d\'être envoyé.')]);
    }

    public function login(Request $request, EmailCodes $codes): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => [__('Adresse e-mail ou mot de passe incorrect.')],
            ]);
        }

        if ($user->checkBlocked()) {
            return response()->json(['message' => $user->blockedMessage()], 403);
        }

        // Correct password but address never confirmed: send a code and let the app open the verification page.
        if (! $user->hasVerifiedEmail()) {
            $this->sendCode($codes, $user, EmailCodes::VERIFY);

            return response()->json([
                'message' => __("Votre adresse email n'est pas encore vérifiée. Un code vous a été envoyé par email."),
                'email_not_verified' => true,
                'email' => $user->email,
            ], 403);
        }

        return $this->signIn($user);
    }

    /**
     * Emails a 6-digit reset code. The answer is the same whether the address exists or not,
     * so the form cannot be used to discover registered emails.
     */
    public function forgotPassword(Request $request, EmailCodes $codes): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email']]);

        if ($user = User::where('email', $data['email'])->first()) {
            $codes->send($user, EmailCodes::RESET);
        }

        return response()->json([
            'message' => __('Si un compte existe avec cette adresse, un code de vérification vient d\'être envoyé par email.'),
        ]);
    }

    /** Checks the code before the "new password" step; the code stays valid for reset-password. */
    public function verifyResetCode(Request $request, EmailCodes $codes): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email'], 'code' => self::CODE_RULES], $this->codeMessages());

        $codes->verify($data['email'], EmailCodes::RESET, $data['code']);

        return response()->json(['message' => __('Code vérifié. Choisissez votre nouveau mot de passe.')]);
    }

    public function resetPassword(Request $request, EmailCodes $codes): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'code' => self::CODE_RULES,
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ], $this->codeMessages());

        $codes->verify($data['email'], EmailCodes::RESET, $data['code']);

        $user = User::where('email', $data['email'])->firstOrFail();
        $user->forceFill([
            'password' => $data['password'],
            'remember_token' => Str::random(60),
            // Receiving the code proves the user owns the address.
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();
        // Signs out every device: whoever knew the old password loses access.
        $user->tokens()->delete();
        $codes->forget($user->email, EmailCodes::RESET);
        event(new PasswordReset($user));

        return response()->json(['message' => __('Votre mot de passe a été réinitialisé. Vous pouvez vous connecter.')]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => __('Déconnexion réussie.')]);
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user()->load('prestataireProfile.categorie'));
    }

    private function signIn(User $user): JsonResponse
    {
        return response()->json([
            'token' => $user->createToken('auth_token')->plainTextToken,
            'user' => new UserResource($user->load('prestataireProfile.categorie')),
        ]);
    }

    private function codeMessages(): array
    {
        return ['code.digits' => __('Le code doit contenir 6 chiffres.')];
    }

    /** Sends a code without failing the request when the mail server is down; returns whether it went out. */
    private function sendCode(EmailCodes $codes, User $user, string $purpose): bool
    {
        try {
            $codes->send($user, $purpose);

            return true;
        } catch (HttpException) {
            return false;
        }
    }
}
