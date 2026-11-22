# DarFix — Contrat d'API REST

Backend : Laravel 13 (`DarFix/`) — Frontend : Angular 22 (`housefix-frontend/`).
Base URL : `http://localhost:8000/api`. Toutes les réponses sont en JSON.
Authentification : Laravel Sanctum, en-tête `Authorization: Bearer <token>`.

Conventions :
- Les listes sont renvoyées sous forme de tableaux JSON simples (pas de pagination).
- Erreurs de validation : `422 { message, errors: { champ: [..] } }` (format Laravel standard).
- `401` non authentifié, `403 { message }` rôle interdit ou compte bloqué, `404` introuvable,
  `409 { message }` conflit d'état (ex. facture déjà payée), `402 { message }` paiement refusé.
- Les dates sont `YYYY-MM-DD`, les heures `HH:mm`, les horodatages ISO 8601.
- Les montants sont en dinars tunisiens (DT), nombres décimaux.
- Les messages sont en français, arabe ou anglais selon l'en-tête `Accept-Language` (voir « Langue » ci-dessous).

Rôles : `client`, `prestataire`, `admin`.

### Langue
- L'application envoie `Accept-Language: fr`, `ar` ou `en` sur chaque appel (`ar-TN`, `en-US`… sont acceptés). Langue absente ou non gérée : français.
  Elle s'applique aux `message` de l'API, aux erreurs de validation (`lang/ar/validation.php`, `lang/en/validation.php`) et aux noms des catégories.
- `users.locale` (`fr` par défaut) mémorise la dernière langue utilisée : fixée à l'inscription, puis mise à jour à chaque appel authentifié dont la langue diffère. Elle est renvoyée dans `User.locale`.
- Les notifications (titre et message) sont stockées dans la langue de leur **destinataire**, quelle que soit la langue de la requête qui les déclenche (ex. un admin en français valide un prestataire arabophone → notification en arabe). Les emails (codes de vérification et de réinitialisation, copies des notifications) partent aussi dans la langue du destinataire. Les dates y restent au format `jj/mm/aaaa`.
- Catégories : `nom` et `description` sont dans la langue de la requête (français si la traduction manque) ; `nom_fr`, `nom_ar`, `nom_en`, `description_fr`, `description_ar`, `description_en` donnent toutes les versions (formulaire admin).
- Les gouvernorats, statuts et autres valeurs d'énumération restent en français dans l'API : le frontend les traduit.
- Le service IA reçoit `langue` et rédige les `raisons` dans cette langue ; les catégories lui sont toujours envoyées en français.
- Le PDF des factures reste en français (dompdf ne sait pas mettre en forme l'arabe).

---

## 1. Objets JSON

### User
```json
{
  "id": 1, "nom": "Mohamed Ayari", "email": "client@housefix.tn",
  "telephone": "+216 21 123 456", "gouvernorat": "Tunis", "locale": "fr",
  "role": "client", "statut": "actif",
  "is_verified": true, "is_blocked": false, "blocked_until": null, "block_motif": null,
  "photo_url": null, "address": "Rue ...", "latitude": 36.80, "longitude": 10.18,
  "created_at": "2026-04-01T10:00:00Z",
  "prestataire": null
}
```
`statut` vaut `actif`, `suspendu` (blocage temporaire) ou `bloque` (blocage définitif).
`is_verified` est `true` pour les clients et les admins. Pour un prestataire, il passe à `true` une fois validé par l'admin.
`prestataire` contient un `PrestataireProfile` lorsque `role = prestataire`, et vaut `null` sinon.
`locale` (`fr`, `ar` ou `en`) est la langue des emails et notifications de l'utilisateur.

### PrestataireProfile
```json
{
  "id": 1, "user_id": 3, "categorie_service_id": 1,
  "categorie": { "id": 1, "nom": "Plomberie" },
  "specialite": "Plombier sanitaire", "description": "…",
  "experience_annees": 5, "certifications": "CAP Plomberie",
  "tarif_horaire": 40.0, "is_available": true,
  "disponibilites": "Lun-Sam 08:00-18:00",
  "note_moyenne": 4.5, "nb_avis": 2,
  "validation_status": "valide"
}
```
`validation_status` : `en_attente`, `valide` ou `refuse`.

### PrestataireCard (recherche, recommandations)
C'est un `User` avec `prestataire`, plus `distance_km` (nombre ou `null`) et `score` (de 0 à 1).
Sur les recommandations : `raisons` (phrases expliquant le choix), `source` (`ia` = classé par le service de recommandation, `local` = formule de secours) et `modele` (`expert` ou `appris`, sinon `null`).

### Categorie
```json
{
  "id": 1, "nom": "سباكة", "description": "…",
  "nom_fr": "Plomberie", "nom_ar": "سباكة", "nom_en": "Plumbing",
  "description_fr": "…", "description_ar": "…", "description_en": "…",
  "icone": "bi-droplet", "prestataires_count": 3
}
```
`nom` / `description` suivent `Accept-Language` (ici `ar`), avec repli sur le français. Les catégories imbriquées ailleurs (`{id, nom}` dans `PrestataireProfile`, `RendezVous`, `Litige`, et `categorie` de `/accueil`) sont aussi dans la langue de la requête.

### RendezVous
```json
{
  "id": 1, "client_id": 2, "prestataire_id": 3, "categorie_service_id": 1,
  "date": "2026-04-13", "heure": "09:00", "description": "Fuite sous l'évier",
  "address": "12 rue de Marseille, Tunis", "latitude": 36.8, "longitude": 10.18,
  "status": "en_attente", "motif_refus": null, "created_at": "…",
  "client": { "id": 2, "nom": "…", "telephone": "…", "photo_url": null },
  "prestataire": { "id": 3, "nom": "…", "telephone": "…", "photo_url": null },
  "categorie": { "id": 1, "nom": "Plomberie" },
  "facture": null,
  "evaluation": null
}
```
Valeurs de `status` :

| Statut | Signification |
|---|---|
| `en_attente` | Demande envoyée par le client |
| `accepte` | Acceptée par le prestataire |
| `refuse` | Refusée par le prestataire |
| `annule_par_client` | Annulée par le client |
| `termine` | Intervention terminée |
| `facture` | Facture générée |

`heure` peut être `null` : elle est confirmée par le prestataire.

### Facture
```json
{
  "id": 1, "numero": "FAC-2026-0001", "rendez_vous_id": 1, "client_id": 2, "prestataire_id": 3,
  "montant": 120.0, "details": "Remplacement siphon + main d'œuvre",
  "date": "2026-04-14", "statut_paiement": "non_payee", "mode_paiement": null, "paid_at": null,
  "rendez_vous": { …RendezVous sans facture… },
  "paiements": [ …Paiement… ]
}
```
- `statut_paiement` : `non_payee`, `en_attente` (espèces déclarées par le client, en attente de confirmation par le prestataire) ou `payee`.
- `mode_paiement` : `null`, `en_ligne` ou `especes`.

### Paiement
`{ "id": 1, "facture_id": 1, "montant": 120.0, "mode": "en_ligne", "statut": "valide", "reference": "PAY-8F3K2A", "created_at": "…" }`
`statut` : `en_attente`, `valide` ou `refuse`.

### Evaluation
```json
{ "id": 1, "rendez_vous_id": 1, "client_id": 2, "prestataire_id": 3, "note": 5,
  "commentaire": "Très bon travail", "reponse": null, "created_at": "…",
  "client": { "id": 2, "nom": "…", "photo_url": null },
  "prestataire": { "id": 3, "nom": "…", "photo_url": null } }
```

### Conversation / Message
```json
{ "id": 1, "client_id": 2, "prestataire_id": 3,
  "other_user": { "id": 3, "nom": "…", "photo_url": null, "role": "prestataire" },
  "last_message": { …Message… }, "unread_count": 2, "updated_at": "…" }
```
```json
{ "id": 1, "conversation_id": 1, "sender_id": 2, "receiver_id": 3,
  "content": "Bonjour", "type": "text", "is_read": false, "created_at": "…" }
```

### Litige
```json
{ "id": 1, "rendez_vous_id": 1, "declarant_id": 2, "cible_id": 3,
  "sujet": "Retard", "description": "…", "statut": "ouvert",
  "reponse_admin": null, "traite_par": null, "traite_le": null, "created_at": "…",
  "declarant": { "id": 2, "nom": "…", "role": "client" },
  "cible": { "id": 3, "nom": "…", "role": "prestataire" },
  "rendez_vous": { "id": 1, "date": "2026-04-13", "categorie": { "id": 1, "nom": "Plomberie" } } }
```
`statut` : `ouvert`, `en_cours`, `resolu` ou `rejete`.

### Notification
`{ "id": 1, "titre": "Rendez-vous accepté", "message": "…", "type": "rdv", "lien": "/client/rendez-vous", "lu": false, "created_at": "…" }`

---

## 2. Authentification et profil

| Méthode | URL | Accès | Corps / Réponse |
|---|---|---|---|
| POST | `/auth/register` | public | `{nom, email, password, password_confirmation, telephone, gouvernorat, role: client|prestataire, categorie_service_id?, accepte_conditions: true, terms_version}` → `201 {message, email, email_sent}`. `terms_version` doit être la version publiée des documents légaux (`config('app.terms_version')`, sinon `422`) ; la date et la version acceptées sont enregistrées (`users.terms_accepted_at`, `users.terms_version`), **sans jeton** : un code de vérification à 6 chiffres est envoyé par email. Un prestataire est créé avec `validation_status = en_attente` et `is_verified = false` ; les admins sont notifiés après la vérification de son email. |
| POST | `/auth/verify-email` | public | `{email, code}` → `{token, user}` : confirme l’adresse et ouvre la session. Code faux : `422` sur `code` (« Code incorrect. Il vous reste N tentatives. »). |
| POST | `/auth/resend-verification` | public | `{email}` → `{message}`. Renvoie un code si l’adresse attend une vérification (au plus un email par minute). Même réponse sinon. |
| POST | `/auth/login` | public | `{email, password}` → `{token, user}`. Identifiants faux : `422`. Compte bloqué : `403 {message}`. Email non vérifié (mot de passe correct) : un nouveau code est envoyé et la réponse est `403 {message, email_not_verified: true, email}`. |
| POST | `/auth/forgot-password` | public | `{email}` → `{message}`. Envoie par email un code à 6 chiffres valable 15 minutes (au plus un email par minute et par adresse). Même réponse que l'adresse existe ou non. |
| POST | `/auth/verify-reset-code` | public | `{email, code}` → `{message}`. Vérifie le code sans le consommer. Code faux : `422 {errors: {code: ["Code incorrect. Il vous reste N tentatives."]}}`. Après 5 codes faux, ou après expiration, le code est annulé (`422`) et il faut en demander un nouveau. |
| POST | `/auth/reset-password` | public | `{email, code, password, password_confirmation}` → `{message}`. Revérifie le code, change le mot de passe, révoque tous les jetons de l'utilisateur et invalide le code. Mêmes erreurs `422` sur `code`. |
| POST | `/auth/logout` | auth | → `{message}` |
| GET | `/auth/me` | auth | → `User` |
| PUT | `/profile` | auth | `{nom, telephone, gouvernorat, address, latitude, longitude}`. Un prestataire peut aussi envoyer `{specialite, description, experience_annees, certifications, tarif_horaire, disponibilites, categorie_service_id}` → `User` |
| POST | `/profile/photo` | auth | multipart `photo` (image ≤ 2 Mo) → `User` |
| PUT | `/profile/password` | auth | `{current_password, password, password_confirmation}` → `{message}` |
| PATCH | `/prestataire/availability` | prestataire | `{is_available}` → `User` |

Un utilisateur bloqué reçoit `403` sur toute route authentifiée. Un blocage temporaire expiré est levé automatiquement.

Les codes (vérification et réinitialisation) expirent après 15 minutes et sont annulés après 5 codes faux. Les routes `verify-email`, `resend-verification`, `forgot-password`, `verify-reset-code` et `reset-password` sont limitées à 10 requêtes par minute (`429`).

Les emails partent par l’API Brevo (`MAIL_MAILER=brevo`, clé dans `BREVO_API_KEY`). Si l’envoi échoue, la route répond `503 {message}`, sauf l’inscription qui crée quand même le compte et renvoie `email_sent: false`.

## 3. Catégories
| GET | `/categories` | public | → `Categorie[]` |
|---|---|---|---|
| POST | `/admin/categories` | admin | `{nom, description?, nom_ar?, description_ar?, nom_en?, description_en?, icone?}` (`nom` = français) → `201 Categorie` |
| PUT | `/admin/categories/{id}` | admin | idem ; un champ de traduction absent garde sa valeur, `null` l'efface → `Categorie` |
| DELETE | `/admin/categories/{id}` | admin | → `{message}`. Renvoie `409` si des prestataires y sont rattachés. |

Page d'accueil publique : `GET /accueil` (public) → `{stats: {prestataires, interventions, note_moyenne, avis, gouvernorats}, categories: Categorie[], top_prestataires: [{id, nom, photo_url, gouvernorat, categorie, specialite, experience_annees, tarif_horaire, note_moyenne, nb_avis}], avis: [{note, commentaire, auteur, gouvernorat, categorie}]}`. Au plus 4 prestataires (les mieux notés) et 3 avis (note ≥ 4). Aucune donnée personnelle : ni email, ni téléphone, ni adresse ; l'auteur d'un avis est affiché « Prénom N. ».

Pages publiques des services (référencement), mêmes règles de confidentialité :
- `GET /services` (public) → `[{id, slug, nom, icone, description, prestataires, tarif_min, note_moyenne}]`.
- `GET /services/{slug}?gouvernorat=` (public) → `{service: {id, slug, nom, icone, description}, gouvernorat, stats: {prestataires, disponibles, note_moyenne, avis, interventions, tarif_min, tarif_median, tarif_max}, gouvernorats: [{nom, prestataires}], prestataires: [{id, nom, photo_url, gouvernorat, specialite, experience_annees, tarif_horaire, note_moyenne, nb_avis, disponible}], avis: [{note, commentaire, auteur, gouvernorat, date}], autres_services: [{id, slug, nom, icone}]}`. Au plus 12 prestataires validés et non bloqués (les mieux notés) et 6 avis (note ≥ 4). `note_moyenne` est pondérée par le nombre d'avis. `gouvernorats` liste toutes les villes du service, même filtré. Slug inconnu : `404` ; gouvernorat inconnu : `422`.
- Le `slug` de chaque catégorie est tiré de son nom français (« Électricité » → `electricite`), unique, et suit les changements de nom. Il figure aussi dans `Categorie`.

## 4. Recherche de prestataires (client connecté)
| GET | `/prestataires` | auth | Filtres : `q`, `categorie_id`, `gouvernorat`, `min_note`, `max_tarif`, `disponible=1`, `lat`, `lng`, `sort=recommande\|note\|prix\|distance` (défaut `recommande`) → `PrestataireCard[]`. Seuls les prestataires validés et non bloqués sont renvoyés. |
|---|---|---|---|
| GET | `/prestataires/recommandations` | auth | `lat?`, `lng?`, `categorie_id?`, `besoin?` (texte libre, 300 caractères max) → 6 meilleurs `PrestataireCard[]`, classés par le service IA avec leurs `raisons`. Service injoignable : formule locale (`source: local`). |
| GET | `/prestataires/{id}` | auth | → `User` + `prestataire` + `evaluations: Evaluation[]` |

Score de recommandation : `0.5·(note/5) + 0.3·(1 − min(distance,50)/50) + 0.2·(1 − tarif/tarifMax)`.
Si la position est inconnue, la distance utilise le gouvernorat du client (même gouvernorat = 0 km, sinon 50 km).
Un prestataire sans avis a une note par défaut de 3.

## 5. Rendez-vous
| GET | `/rendez-vous` | auth | `?status=`. Le client voit ses rendez-vous, le prestataire ceux qui lui sont adressés, l'admin tous. Tri par date décroissante → `RendezVous[]` |
|---|---|---|---|
| GET | `/rendez-vous/{id}` | participant/admin | → `RendezVous` |
| POST | `/rendez-vous` | client | `{prestataire_id, categorie_service_id, date (≥ aujourd'hui), heure?, address, latitude?, longitude?, description}` → `201 RendezVous`. Si le prestataire est indisponible, non validé ou bloqué : `422 {message: "Prestataire indisponible"}`. |
| POST | `/rendez-vous/{id}/annuler` | client propriétaire | uniquement depuis `en_attente` ou `accepte` → `RendezVous` |
| POST | `/rendez-vous/{id}/accepter` | prestataire | `{heure?}`, uniquement depuis `en_attente` → `RendezVous` |
| POST | `/rendez-vous/{id}/refuser` | prestataire | `{motif?}`, uniquement depuis `en_attente` → `RendezVous` |
| PATCH | `/rendez-vous/{id}/horaire` | prestataire | `{heure, date?}`, uniquement si `accepte` → `RendezVous` |
| POST | `/rendez-vous/{id}/terminer` | prestataire | uniquement si `accepte` → `RendezVous` |
| POST | `/rendez-vous/{id}/facture` | prestataire | `{montant > 0, details?}`, uniquement si `termine`. Le statut passe à `facture` → `201 Facture` |

Une transition interdite renvoie `409 {message}`. Chaque transition crée une Notification pour l'autre partie.

## 6. Factures et paiements
| GET | `/factures` | auth | filtré selon le rôle, avec `rendez_vous` (+ `categorie`, `client`, `prestataire`) → `Facture[]` |
|---|---|---|---|
| GET | `/factures/{id}` | participant/admin | → `Facture` avec `paiements` |
| GET | `/factures/{id}/pdf` | participant/admin | → fichier `application/pdf` (`facture-FAC-2026-0001.pdf`) |
| POST | `/factures/{id}/payer` | client | `{mode: en_ligne\|especes, card_number?, card_name?, expiry?, cvv?}` |
| POST | `/factures/{id}/confirmer-especes` | prestataire | uniquement si `statut_paiement = en_attente` → `Facture` (`payee`) |
| POST | `/factures/{id}/encaisser-especes` | prestataire | espèces reçues sur place, si la facture n'est pas payée → `Facture` (`payee`, `especes`). Une déclaration en attente devient le paiement `valide` (pas de doublon). Déjà payée : `409` |
| POST | `/factures/{id}/refuser-especes` | prestataire | espèces déclarées mais non reçues, si `en_attente` → `Facture` (`non_payee`), paiement `refuse`, client notifié |
| POST | `/factures/{id}/annuler-especes` | client | retire sa déclaration, si `en_attente` → `Facture` (`non_payee`), paiement `annule`, prestataire notifié |

### TVA
| GET | `/taux-tva` | public | `[{id, libelle, taux, par_defaut, categories_count}]` (taux en %) |
|---|---|---|---|
| POST | `/admin/taux-tva` | admin | `{libelle, taux: 0..100, par_defaut?}`. Un seul taux par défaut : en cocher un autre retire l'ancien |
| PUT | `/admin/taux-tva/{id}` | admin | idem. Retirer « par défaut » sans en choisir un autre : `422` |
| DELETE | `/admin/taux-tva/{id}` | admin | taux par défaut : `409`. Ses services repassent au taux par défaut |

- Chaque catégorie a un `taux_tva_id` (null = taux par défaut). `CategorieResource` expose `taux_tva_id` et `taux_tva` (taux effectif).
- `POST /rendez-vous/{id}/facture` : `montant` saisi = **HT**. Le serveur calcule `montant_tva = HT × taux / 100` et `montant_ttc = HT + TVA` (arrondis à 2 décimales) avec le taux du service, puis **copie le taux sur la facture** : modifier un taux ne change jamais une facture émise.
- `Facture` : `montant_ht`, `taux_tva`, `montant_tva`, `montant_ttc` ; `montant` = TTC (montant à payer, utilisé par les paiements et les revenus). Factures antérieures à la TVA : taux 0, HT = TTC.
- `/admin/dashboard` ajoute `chiffre_affaires_ht` et `tva_collectee` (factures payées).

Comportement de `/factures/{id}/payer` :
- `en_ligne` : paiement simulé. La carte doit avoir 16 chiffres, `expiry` au format MM/AA et `cvv` 3 chiffres. Une carte finissant par `0000` est refusée (`402`, paiement enregistré `refuse`). Sinon la facture passe à `payee`.
- `especes` : la facture passe à `en_attente` et le paiement est enregistré `en_attente`.
- Statuts d'un paiement : `en_attente`, `valide`, `refuse`, `annule`.
- Facture déjà payée : `409 "Facture déjà payée"`.

### Prestataire recommandé (`is_recommended`)
Calculé par le serveur à chaque requête (`App\Services\PrestataireRecommande`), jamais par le frontend. Vrai seulement si **les trois** conditions sont réunies :
- distance client ↔ prestataire **≤ 8 km** (Haversine sur les coordonnées GPS : `?lat&lng` du navigateur, sinon l'adresse du compte ; position inconnue ⇒ faux) ;
- **≥ 10 rendez-vous acceptés** (statuts `accepte`, `termine`, `facture` ; refusés, annulés et en attente exclus) ;
- note moyenne **= 5/5** (au moins un avis).

Champs `is_recommended` et `rdv_acceptes` sur `GET /prestataires`, `GET /prestataires/recommandations` (prestataires recommandés en premier, l'ordre choisi est conservé dans chaque groupe) et `GET /prestataires/{id}` (accepte aussi `?lat&lng`, renvoie `distance_km`).

## 7. Tableaux de bord et statistiques
| GET | `/client/dashboard` | client | `{interventions_terminees, categories_actives, rdv_en_cours, factures_impayees, prochain_rdv: RendezVous\|null, progression}` (progression de 0 à 100) |
|---|---|---|---|
| GET | `/prestataire/dashboard` | prestataire | `{revenus_jour, revenus_hier, revenus_semaine, revenus_semaine_derniere, jobs_termines_semaine, note_moyenne, nb_avis, demandes_en_attente, interventions_du_jour: RendezVous[], prochaine_intervention: RendezVous\|null}` |
| GET | `/prestataire/revenus` | prestataire | `{total, mois_courant, mois_dernier, evolution_pct, mensuel: [{mois:"2026-01", label:"Jan 2026", total}]}` (6 derniers mois). Les revenus correspondent aux factures **payées**, datées par `paid_at`. |
| GET | `/prestataire/calendrier` | prestataire | `?from=YYYY-MM-DD&to=YYYY-MM-DD`, statuts `accepte`, `termine` et `facture` → `RendezVous[]` |
| GET | `/admin/dashboard` | admin | `{clients_inscrits, prestataires_actifs, prestataires_en_attente, total_rdv, moyenne_evaluations, nb_avis, litiges_ouverts, chiffre_affaires, statuts: [{status, count}], rdv_par_mois: [{label, total}]}` |
| GET | `/admin/export` | admin | `?type=statistiques\|utilisateurs\|prestataires\|rendez_vous\|factures\|litiges\|tout&format=csv\|xlsx&du?=AAAA-MM-JJ&au?=AAAA-MM-JJ` → fichier téléchargé (`housefix-<type>-<date>.<format>`). En-têtes et libellés dans la langue `Accept-Language`. CSV : UTF-8 avec BOM, séparateur `;` (`,` en anglais), un seul tableau. Excel : une feuille par jeu de données (`tout` = toutes, Excel uniquement, sinon `422`), en-tête figé, filtres, de droite à gauche en arabe. La période filtre rendez-vous, factures, litiges, inscriptions et statistiques. Contient des données personnelles. |

## 8. Évaluations
| GET | `/evaluations` | auth | évaluations données (client), reçues (prestataire) ou toutes (admin) → `Evaluation[]` |
|---|---|---|---|
| POST | `/evaluations` | client | `{rendez_vous_id, note 1..5, commentaire?}`. Le rendez-vous doit être `termine` ou `facture` et ne compter qu'une évaluation (`409` sinon). Recalcule `note_moyenne` et `nb_avis` → `201 Evaluation` |
| PUT | `/evaluations/{id}` | client auteur | `{note, commentaire?}` → `Evaluation` |
| POST | `/evaluations/{id}/repondre` | prestataire concerné | `{reponse}` → `Evaluation` |
| DELETE | `/admin/evaluations/{id}` | admin | modération → `{message}` |

## 9. Messagerie
| GET | `/conversations` | auth | → `Conversation[]` (tri par `updated_at` décroissant) |
|---|---|---|---|
| POST | `/conversations` | client/prestataire | `{user_id}` : trouve ou crée la conversation client↔prestataire → `Conversation` |
| GET | `/conversations/{id}/messages` | participant | → `Message[]` (ordre chronologique). Marque comme lus les messages reçus. |
| POST | `/conversations/{id}/messages` | participant | `{content}` → `201 Message` |

## 10. Litiges
| GET | `/litiges` | auth | litiges où l'utilisateur est déclarant ou cible, tous pour l'admin → `Litige[]` |
|---|---|---|---|
| POST | `/litiges` | client/prestataire | `{rendez_vous_id, sujet, description}`. La cible est l'autre partie du rendez-vous → `201 Litige` |
| PATCH | `/admin/litiges/{id}` | admin | `{statut, reponse_admin?}`. Renseigne `traite_par` et `traite_le` et notifie les deux parties → `Litige` |

## 11. Notifications
| GET | `/notifications` | auth | → `{items: Notification[] (50 dernières), non_lues: n}` |
|---|---|---|---|
| POST | `/notifications/{id}/lu` | auth | → `{message}` |
| POST | `/notifications/lire-tout` | auth | → `{message}` |

## 12. Administration des utilisateurs
| GET | `/admin/users` | admin | `?role=&q=` → `User[]` |
|---|---|---|---|
| GET | `/admin/prestataires` | admin | → `User[]` (avec `prestataire`) |
| GET | `/admin/validations` | admin | prestataires `en_attente` → `User[]` |
| POST | `/admin/prestataires/{id}/valider` | admin | → `User` |
| POST | `/admin/prestataires/{id}/refuser` | admin | `{motif?}` → `User` |
| POST | `/admin/users/{id}/bloquer` | admin | `{type: temporaire\|definitif, jusqu_au? (date, requis si temporaire), motif?}`. Révoque les jetons de l'utilisateur → `User` |
| POST | `/admin/users/{id}/debloquer` | admin | → `User` |
| DELETE | `/admin/users/{id}` | admin | → `{message}`. Un admin ne peut pas se supprimer lui-même. |

## 13. Comptes de démonstration (seeders)
Tous les mots de passe : `password`.

| Rôle | Email |
|---|---|
| Admin | `admin@housefix.tn` (Mohamed Admin) |
| Client | `client@housefix.tn` (Mohamed Ayari) |
| Client | `amira@housefix.tn` (Amira Chaabane, Sousse), mot de passe `Amira@2026` |
| Prestataire | `prestataire@housefix.tn` (Mohamed Ayari2, Plomberie) |
| Prestataire | `ahmed@housefix.tn` (Ahmed Landolsi, Menuiserie) |
| Prestataire en attente | `nouveau@housefix.tn` |

Gouvernorats (24) : Ariana, Béja, Ben Arous, Bizerte, Gabès, Gafsa, Jendouba, Kairouan, Kasserine, Kébili, Le Kef, Mahdia, La Manouba, Médenine, Monastir, Nabeul, Sfax, Sidi Bouzid, Siliana, Sousse, Tataouine, Tozeur, Tunis, Zaghouan.
