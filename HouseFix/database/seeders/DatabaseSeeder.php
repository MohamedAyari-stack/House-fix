<?php

namespace Database\Seeders;

use App\Models\AppNotification;
use App\Models\CategorieService;
use App\Models\Conversation;
use App\Models\Evaluation;
use App\Models\Facture;
use App\Models\Litige;
use App\Models\RendezVous;
use App\Models\User;
use App\Services\Tva;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

/**
 * Tunisian demo data. All accounts use the password "password", except amira@housefix.tn (Amira@2026).
 */
class DatabaseSeeder extends Seeder
{
    private string $password;

    public function run(): void
    {
        $this->password = Hash::make('password');

        $categories = $this->seedCategories();

        // ---- Accounts --------------------------------------------------------
        $admin = $this->user('Mohamed Admin', 'admin@housefix.tn', User::ROLE_ADMIN, 'Tunis', '+216 71 000 000');

        $client = $this->user('Mohamed Ayari', 'client@housefix.tn', User::ROLE_CLIENT, 'Tunis', '+216 21 123 456', [
            'address' => '12 rue de Marseille, Tunis', 'latitude' => 36.8008, 'longitude' => 10.1800,
        ]);
        $sarra = $this->user('Sarra Ben Salah', 'sarra@housefix.tn', User::ROLE_CLIENT, 'Ariana', '+216 22 456 789', [
            'address' => '5 avenue de l\'UMA, La Soukra', 'latitude' => 36.8747, 'longitude' => 10.2435,
        ]);
        // Second demo client, with her own password.
        $this->user('Amira Chaabane', 'amira@housefix.tn', User::ROLE_CLIENT, 'Sousse', '+216 23 654 321', [
            'address' => '18 avenue Léopold Senghor, Sousse', 'latitude' => 35.8256, 'longitude' => 10.6084,
            'password' => Hash::make('Amira@2026'),
        ]);
        $this->user('Youssef Trabelsi', 'youssef@housefix.tn', User::ROLE_CLIENT, 'Sfax', '+216 24 987 654', [
            'address' => 'Route de Tunis km 3, Sfax', 'latitude' => 34.7570, 'longitude' => 10.7500,
        ]);

        $p = fn (string $nom, string $email, string $gouv, string $tel, array $geo, string $cat, array $profile, string $status = 'valide') => $this->prestataire($nom, $email, $gouv, $tel, $geo, $categories[$cat], $profile, $status);

        $ayari2 = $p('Mohamed Ayari2', 'prestataire@housefix.tn', 'Tunis', '+216 98 111 222',
            ['address' => '45 avenue de la Liberté, Tunis', 'latitude' => 36.8065, 'longitude' => 10.1815], 'Plomberie', [
                'specialite' => 'Plombier sanitaire', 'experience_annees' => 8, 'certifications' => 'CAP Plomberie',
                'tarif_horaire' => 40, 'disponibilites' => 'Lun-Sam 08:00-18:00',
                'description' => 'Installation et réparation sanitaire, recherche de fuites, chauffe-eau et débouchage.',
            ]);
        $ahmed = $p('Ahmed Landolsi', 'ahmed@housefix.tn', 'Ariana', '+216 97 333 444',
            ['address' => 'Cité Ennasr 2, Ariana', 'latitude' => 36.8665, 'longitude' => 10.1647], 'Menuiserie', [
                'specialite' => 'Menuisier bois et aluminium', 'experience_annees' => 12, 'certifications' => 'BTP Menuiserie',
                'tarif_horaire' => 45, 'disponibilites' => 'Lun-Ven 08:00-17:00',
                'description' => 'Portes, fenêtres, placards sur mesure et réparations de mobilier.',
            ]);
        $karim = $p('Karim Jebali', 'karim@housefix.tn', 'Ben Arous', '+216 96 555 666',
            ['address' => 'Avenue Habib Bourguiba, Ben Arous', 'latitude' => 36.7531, 'longitude' => 10.2189], 'Électricité', [
                'specialite' => 'Électricien bâtiment', 'experience_annees' => 6, 'certifications' => 'Habilitation électrique BR',
                'tarif_horaire' => 35, 'disponibilites' => 'Lun-Sam 07:30-17:30',
                'description' => 'Installation électrique, tableaux, prises, éclairage et dépannage.',
            ]);
        $sami = $p('Sami Bouazizi', 'sami@housefix.tn', 'Sousse', '+216 95 777 888',
            ['address' => 'Boulevard du 14 janvier, Sousse', 'latitude' => 35.8256, 'longitude' => 10.6360], 'Climatisation', [
                'specialite' => 'Frigoriste', 'experience_annees' => 10, 'certifications' => 'Attestation fluides frigorigènes',
                'tarif_horaire' => 50, 'disponibilites' => 'Lun-Sam 08:00-19:00',
                'description' => 'Installation, entretien et recharge de climatiseurs toutes marques.',
            ]);
        $leila = $p('Leila Mansouri', 'leila@housefix.tn', 'La Manouba', '+216 94 222 111',
            ['address' => 'Cité Essaada, La Manouba', 'latitude' => 36.8101, 'longitude' => 10.0956], 'Nettoyage', [
                'specialite' => 'Agent de nettoyage', 'experience_annees' => 4,
                'tarif_horaire' => 25, 'disponibilites' => 'Lun-Dim 08:00-16:00',
                'description' => 'Ménage complet, nettoyage après travaux, vitres et tapis.',
            ]);
        $p('Hichem Gharbi', 'hichem@housefix.tn', 'Nabeul', '+216 93 444 555',
            ['address' => 'Rue de la République, Nabeul', 'latitude' => 36.4561, 'longitude' => 10.7376], 'Serrurerie', [
                'specialite' => 'Serrurier', 'experience_annees' => 9,
                'tarif_horaire' => 30, 'disponibilites' => '7j/7 urgences',
                'description' => 'Ouverture de portes, changement de serrures et blindage.',
            ]);
        $p('Nizar Chaabane', 'nizar@housefix.tn', 'Sfax', '+216 92 666 777',
            ['address' => 'Avenue Majida Boulila, Sfax', 'latitude' => 34.7406, 'longitude' => 10.7603], 'Peinture', [
                'specialite' => 'Peintre en bâtiment', 'experience_annees' => 7,
                'tarif_horaire' => 35, 'disponibilites' => 'Lun-Sam 08:00-17:00',
                'description' => 'Peinture intérieure et extérieure, enduits et revêtements décoratifs.',
            ]);
        $p('Rim Khelifi', 'rim@housefix.tn', 'Ariana', '+216 91 888 999',
            ['address' => 'Raoued Plage, Ariana', 'latitude' => 36.9333, 'longitude' => 10.1833], 'Jardinage', [
                'specialite' => 'Paysagiste', 'experience_annees' => 5,
                'tarif_horaire' => 28, 'disponibilites' => 'Mar-Sam 07:00-15:00', 'is_available' => false,
                'description' => 'Entretien de jardins, taille de haies, gazon et arrosage automatique.',
            ]);

        // Pending validation
        $p('Walid Hammami', 'nouveau@housefix.tn', 'Bizerte', '+216 90 123 321',
            ['address' => 'Corniche, Bizerte', 'latitude' => 37.2744, 'longitude' => 9.8739], 'Électricité', [
                'specialite' => 'Électricien', 'experience_annees' => 2, 'tarif_horaire' => 30,
                'description' => 'Jeune électricien motivé, dépannage rapide.',
            ], 'en_attente');

        // ---- Rendez-vous of client@housefix.tn ----------------------------
        $plomberie = $categories['Plomberie']->id;
        $rdv = fn (User $prest, int $cat, string $date, ?string $heure, string $status, string $description, array $extra = []) => tap((new RendezVous)->forceFill($extra + [
            'client_id' => $client->id, 'prestataire_id' => $prest->id, 'categorie_service_id' => $cat,
            'date' => $date, 'heure' => $heure, 'status' => $status, 'description' => $description,
            'address' => $client->address, 'latitude' => $client->latitude, 'longitude' => $client->longitude,
            // Requests are sent a few days before the intervention (or now, for upcoming ones).
            'created_at' => min(Carbon::parse($date)->subDays(3), now()), 'updated_at' => min(Carbon::parse($date), now()),
        ]))->save();

        $rdv1 = $rdv($ayari2, $plomberie, '2026-04-13', '09:00', 'facture', 'Fuite sous l\'évier de la cuisine');
        $rdv2 = $rdv($ayari2, $plomberie, '2026-04-22', '14:00', 'facture', 'Remplacement du chauffe-eau');
        $rdv3 = $rdv($ayari2, $plomberie, '2026-05-06', '10:30', 'facture', 'Débouchage de la canalisation de la salle de bain');
        $rdv($ahmed, $categories['Menuiserie']->id, '2026-05-12', '15:00', 'annule_par_client', 'Réparation d\'une porte de placard');
        $rdv($karim, $categories['Électricité']->id, '2026-05-20', '11:00', 'termine', 'Installation de trois prises dans le salon');
        $rdv($leila, $categories['Nettoyage']->id, '2026-06-03', null, 'refuse', 'Nettoyage complet après travaux',
            ['motif_refus' => 'Indisponible à cette date']);
        $upcoming = $rdv($ayari2, $plomberie, now()->addDays(4)->toDateString(), '09:00', 'accepte', 'Installation d\'un robinet mitigeur');
        $rdv($sami, $categories['Climatisation']->id, now()->addDays(9)->toDateString(), null, 'en_attente', 'Entretien annuel du climatiseur');

        // A pending request from another client, for the prestataire's dashboard.
        RendezVous::create([
            'client_id' => $sarra->id, 'prestataire_id' => $ayari2->id, 'categorie_service_id' => $plomberie,
            'date' => now()->addDays(3)->toDateString(), 'heure' => null, 'status' => 'en_attente',
            'description' => 'Chasse d\'eau qui fuit', 'address' => $sarra->address,
            'latitude' => $sarra->latitude, 'longitude' => $sarra->longitude,
        ]);

        // ---- Factures & paiements (250 DT paid in April 2026) -------------
        $f1 = $this->facture($rdv1, 120, 'Remplacement siphon + main d\'œuvre', '2026-04-13', 'payee', 'en_ligne', '2026-04-14 10:15:00');
        $f1->paiements()->create(['montant' => 120, 'mode' => 'en_ligne', 'statut' => 'valide', 'reference' => 'PAY-8F3K2A', 'card_last4' => '4242']);

        $f2 = $this->facture($rdv2, 130, 'Chauffe-eau 50 L fourni + pose', '2026-04-22', 'payee', 'especes', '2026-04-23 17:40:00');
        $f2->paiements()->create(['montant' => 130, 'mode' => 'especes', 'statut' => 'valide', 'reference' => 'PAY-Q7M1ZD']);

        $this->facture($rdv3, 80, 'Débouchage haute pression', '2026-05-06', 'non_payee');

        // ---- Évaluation ---------------------------------------------------
        $evaluation = Evaluation::create([
            'rendez_vous_id' => $rdv1->id, 'client_id' => $client->id, 'prestataire_id' => $ayari2->id,
            'note' => 5, 'commentaire' => 'Très bon travail, ponctuel et soigneux. Je recommande !',
            'reponse' => 'Merci beaucoup pour votre confiance !',
        ]);
        $evaluation->forceFill(['created_at' => '2026-04-14 18:00:00', 'updated_at' => '2026-04-14 18:00:00'])->save();
        Evaluation::refreshNoteFor($ayari2->id);

        // ---- Messagerie ---------------------------------------------------
        $conversation = Conversation::create(['client_id' => $client->id, 'prestataire_id' => $ayari2->id]);
        $messages = [
            [$client, $ayari2, 'Bonjour, pouvez-vous passer installer un mitigeur la semaine prochaine ?', true, 26],
            [$ayari2, $client, 'Bonjour Monsieur Ayari, oui sans problème. Le matin vous convient ?', true, 25],
            [$client, $ayari2, 'Oui, 9h c\'est parfait.', true, 24],
            [$ayari2, $client, 'Très bien, je confirme le rendez-vous. À bientôt !', false, 23],
        ];
        foreach ($messages as [$from, $to, $content, $read, $hoursAgo]) {
            $at = now()->subHours($hoursAgo);
            $message = $conversation->messages()->make([
                'sender_id' => $from->id, 'receiver_id' => $to->id, 'content' => $content, 'type' => 'text', 'is_read' => $read,
            ]);
            $message->created_at = $message->updated_at = $at;
            $message->save();
        }

        // ---- Litige -------------------------------------------------------
        Litige::create([
            'rendez_vous_id' => $rdv3->id, 'declarant_id' => $client->id, 'cible_id' => $ayari2->id,
            'sujet' => 'Montant contesté',
            'description' => 'Le montant facturé ne correspond pas au devis annoncé par téléphone (60 DT).',
            'statut' => 'ouvert',
        ]);

        // ---- Notifications (translation keys + params, see AppNotification::send) ----
        $notifs = [
            [$client, 'Rendez-vous accepté', ':nom a accepté votre rendez-vous du :date à :heure.', ['nom' => 'Mohamed Ayari2', 'date' => $this->fr($upcoming->date), 'heure' => '09:00'], 'rdv', '/client/rendez-vous', false],
            [$client, 'Nouvelle facture', 'Facture :numero de :montant DT émise par :nom.', ['numero' => 'FAC-2026-0003', 'montant' => '80,00', 'nom' => 'Mohamed Ayari2'], 'facture', '/client/factures', false],
            [$client, 'Paiement confirmé', 'Le prestataire a confirmé la réception de votre paiement en espèces pour la facture :numero.', ['numero' => 'FAC-2026-0002'], 'paiement', '/client/factures', true],
            [$ayari2, 'Nouvelle demande de rendez-vous', ':nom vous a envoyé une demande d\'intervention pour le :date.', ['nom' => 'Sarra Ben Salah', 'date' => $this->fr(now()->addDays(3)->toDateString())], 'rdv', '/prestataire/rendez-vous', false],
            [$ayari2, 'Nouvelle évaluation', ':nom vous a attribué la note de :note/5.', ['nom' => 'Mohamed Ayari', 'note' => 5], 'evaluation', '/prestataire/evaluations', true],
            [$admin, 'Nouveau prestataire à valider', ':nom s\'est inscrit en tant que prestataire et attend votre validation.', ['nom' => 'Walid Hammami'], 'compte', '/admin/validations', false],
            [$admin, 'Nouveau litige', ':nom a signalé un litige : :sujet.', ['nom' => 'Mohamed Ayari', 'sujet' => 'Montant contesté'], 'litige', '/admin/litiges', false],
        ];
        foreach ($notifs as [$user, $titre, $message, $params, $type, $lien, $lu]) {
            AppNotification::send($user, $titre, $message, $type, $lien, $params)->update(['lu' => $lu]);
        }
    }

    /** @return array<string, CategorieService> keyed by name */
    private function seedCategories(): array
    {
        $this->call(CategorieServiceSeeder::class);

        return CategorieService::all()->keyBy('nom')->all();
    }

    private function user(string $nom, string $email, string $role, string $gouvernorat, string $telephone, array $extra = []): User
    {
        $user = User::create($extra + [
            'nom' => $nom, 'email' => $email, 'password' => $this->password, 'role' => $role,
            'gouvernorat' => $gouvernorat, 'telephone' => $telephone, 'statut' => 'actif',
            'is_verified' => $role !== User::ROLE_PRESTATAIRE,
        ]);

        // Demo accounts skip the email verification step.
        $user->forceFill(['email_verified_at' => now()])->save();

        return $user;
    }

    private function prestataire(string $nom, string $email, string $gouv, string $tel, array $geo, CategorieService $categorie, array $profile, string $status): User
    {
        $user = $this->user($nom, $email, User::ROLE_PRESTATAIRE, $gouv, $tel, $geo + ['is_verified' => $status === 'valide']);

        $user->prestataireProfile()->create($profile + [
            'categorie_service_id' => $categorie->id,
            'is_available' => true,
            'validation_status' => $status,
        ]);

        return $user;
    }

    private function facture(RendezVous $rdv, float $montant, string $details, string $date, string $statut, ?string $mode = null, ?string $paidAt = null): Facture
    {
        return Facture::create([
            'numero' => Facture::nextNumero((int) substr($date, 0, 4)),
            'rendez_vous_id' => $rdv->id, 'client_id' => $rdv->client_id, 'prestataire_id' => $rdv->prestataire_id,
            // Demo amounts are what the client pays (TTC), split with the 19 % normal rate.
            'montant' => $montant, 'montant_ht' => Tva::depuisTtc($montant, 19)['montant_ht'], 'taux_tva' => 19,
            'montant_tva' => Tva::depuisTtc($montant, 19)['montant_tva'],
            'details' => $details, 'date' => $date,
            'statut_paiement' => $statut, 'mode_paiement' => $mode, 'paid_at' => $paidAt,
        ]);
    }

    private function fr(string $date): string
    {
        return Carbon::parse($date)->format('d/m/Y');
    }
}
