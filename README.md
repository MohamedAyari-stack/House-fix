<p align="center"><img src="assets/logo/housefix-logo.svg" alt="DarFix" width="260"></p>

# DarFix

Plateforme web de mise en relation entre clients et prestataires de services à domicile
(plomberie, électricité, serrurerie, climatisation, menuiserie…).
Projet de fin d'études, Génie Logiciel, EPI Sousse, 2025/2026, réalisé chez ArabSoft.

| Dossier | Rôle | Technologie |
|---|---|---|
| [`DarFix/`](DarFix/) | API REST (logique métier, base de données) | Laravel 13, PHP 8.4, Sanctum |
| [`housefix-frontend/`](housefix-frontend/) | Interface web (client, prestataire, admin) | Angular 22, TypeScript |
| [`ai-recommendation-service/`](ai-recommendation-service/) | Recommandation IA des prestataires, avec explications | Python 3.13, FastAPI, scikit-learn |
| [`docs/API.md`](docs/API.md) | Contrat d'API : routes, objets JSON, statuts | — |

## Fonctionnalités

**Langues** : français, arabe (mise en page de droite à gauche) et anglais, au choix dans l'en-tête ou les paramètres,
sans recharger la page. Les messages du serveur, les emails et les notifications suivent la langue de chaque utilisateur ;
le besoin décrit pour la recommandation IA peut être écrit dans les trois langues (dialecte tunisien compris).
Seule la facture PDF reste en français.

**Client**
- Inscription et connexion.
- Recherche de prestataires avec filtres : métier, gouvernorat, note, tarif, disponibilité.
- Recommandation par IA : le client décrit son besoin (« fuite sous l'évier »), le service classe les prestataires
  (pertinence, note, distance, prix, fiabilité, historique) et explique chaque choix.
- Consultation des profils et des avis.
- Prise et annulation de rendez-vous, avec suivi du statut.
- Factures : paiement en ligne (simulé) ou en espèces, téléchargement en PDF.
- Évaluations, messagerie, déclaration de litiges et notifications.

**Prestataire**
- Tableau de bord avec revenus du jour et de la semaine, jobs terminés et note.
- Réception des demandes : accepter, refuser, modifier l'horaire, terminer.
- Calendrier des interventions.
- Génération de factures et confirmation des paiements en espèces.
- Suivi des revenus avec un graphique mensuel.
- Réponse aux avis, messagerie, litiges.
- Profil professionnel : tarif, disponibilités, certifications.

**Administrateur**
- Statistiques globales.
- Validation des comptes prestataires.
- Gestion des catégories de services.
- Supervision des rendez-vous.
- Gestion des litiges.
- Blocage temporaire ou définitif et suppression d'utilisateurs.
- Modération des avis.

## Prérequis

- PHP 8.2 ou plus, avec les extensions `pdo_sqlite` (ou `pdo_mysql`), `mbstring`, `openssl`, `fileinfo`, `gd`, `zip` et `intl`.
- Composer 2
- Node.js 20 ou plus, et le CLI Angular (`npm install -g @angular/cli`)

## Démarrage rapide

### 1. Backend Laravel

```bash
cd DarFix
composer install
cp .env.example .env          # sous Windows : copy .env.example .env
php artisan key:generate
php artisan migrate:fresh --seed
php artisan storage:link
php artisan serve             # http://localhost:8000
```

Par défaut, la base est **SQLite** (`database/database.sqlite`), sans aucune installation.

Pour utiliser **MySQL** (XAMPP / phpMyAdmin, comme dans le rapport) :
1. Démarrez MySQL dans XAMPP.
2. Créez la base `housefix` dans phpMyAdmin.
3. Dans `.env`, remplacez le bloc `DB_*` par :
   ```
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=housefix
   DB_USERNAME=root
   DB_PASSWORD=
   ```
4. Relancez `php artisan migrate:fresh --seed`.

Tests automatisés de l'API : `php artisan test`.

### 2. Frontend Angular

```bash
cd housefix-frontend
npm install
ng serve                      # http://localhost:4200
```

L'URL de l'API se règle dans `src/environments/environment.ts` (par défaut `http://localhost:8000/api`).

### 3. Service de recommandation IA (facultatif)

```bash
cd ai-recommendation-service
C:\laragon\bin\python\python-3.13\python.exe -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --port 8100
```

Sans ce service, les recommandations utilisent une formule simple (note, distance, prix).
Détails du modèle : [`ai-recommendation-service/README.md`](ai-recommendation-service/README.md).
`php artisan reco:status` vérifie la connexion ; `php artisan reco:train` entraîne le modèle sur l'historique.

## Comptes de démonstration

Mot de passe pour tous les comptes : **`password`**

| Rôle | Email |
|---|---|
| Administrateur | admin@housefix.tn |
| Client | client@housefix.tn |
| Client | amira@housefix.tn (mot de passe : Amira@2026) |
| Prestataire (Plomberie) | prestataire@housefix.tn |
| Prestataire (Menuiserie) | ahmed@housefix.tn |
| Prestataire en attente de validation | nouveau@housefix.tn |

Paiement en ligne simulé : toute carte de 16 chiffres est acceptée, sauf celles qui se terminent par `0000`, qui sont refusées.

## Architecture

```
Navigateur ──► Angular (vues, services, guards)
                   │  HTTP/JSON + jeton Bearer (Sanctum)
                   ▼
              Laravel API (routes → contrôleurs → modèles Eloquent)
                   │
                   ▼
              Base de données (SQLite / MySQL)
```

- **Modèle** : modèles Eloquent : `User`, `PrestataireProfile`, `CategorieService`, `RendezVous`, `Facture`,
  `Paiement`, `Evaluation`, `Conversation`, `Message`, `Litige`, `AppNotification`.
- **Contrôleur** : `app/Http/Controllers/Api/*`. Validation, autorisation par rôle (middleware `role:`),
  cycle de vie du rendez-vous et notifications.
- **Vue** : composants Angular dans `src/app/pages/{client,prestataire,admin,common}`.

Cycle de vie d'un rendez-vous :

```
en_attente ──accepter──► accepte ──terminer──► termine ──générer facture──► facture
     │                      │
  refuser               annuler (client)
     ▼                      ▼
  refuse            annule_par_client
```

## Auteur

**Mohamed Ayari** — conception et développement de DarFix (API Laravel, application Angular, service de recommandation IA).

Projet de fin d'études (PFE).
