# Service de recommandation IA — DarFix

Microservice Python (FastAPI + scikit-learn) qui classe les prestataires pour un client et **explique chaque recommandation**.
Laravel lui envoie les candidats et le contexte du client ; le service ne lit jamais la base de données.
S'il est arrêté, Laravel revient automatiquement à sa formule locale : l'application continue de fonctionner.

```
Angular ──► Laravel  GET /api/prestataires/recommandations?besoin=…
               │  POST /recommend  {client, besoin, candidates[]}
               ▼
        ai-recommendation-service (port 8100)
               │  {model, recommendations: [{id, score, distance_km, raisons[]}]}
               ▼
        Cartes « Recommandés pour vous » avec score de compatibilité et raisons
```

## Démarrage

```bash
cd ai-recommendation-service
python -m venv .venv                                   # Laragon : C:\laragon\bin\python\python-3.13\python.exe
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --port 8100
```

Côté Laravel (`DarFix/.env`) : `AI_RECO_URL=http://127.0.0.1:8100`. Vérification : `php artisan reco:status`.
Documentation interactive de l'API : http://127.0.0.1:8100/docs

Tests : `.venv\Scripts\python -m pytest`

## Comment le score est calculé

Chaque prestataire est décrit par 9 critères ramenés entre 0 et 1 ([app/features.py](app/features.py)) :

| Critère | Calcul |
|---|---|
| `pertinence` | Similarité entre le besoin décrit (« fuite sous l'évier ») et le profil (métier, spécialité, description) : TF-IDF sur des n-grammes de caractères (3 à 5), qui tolère fautes, pluriels et accents, plus un lexique métier (« disjoncteur » → électricité, « clé » → serrurerie). Neutre sans besoin. |
| `qualite` | Note **bayésienne** : le prestataire part de 3 avis virtuels à 3,8/5, pour qu'un 5/5 sur un seul avis ne batte pas un 4,8/5 sur 40 avis. |
| `confiance` | Nombre d'avis : `1 − e^(−avis/5)`. |
| `proximite` | Distance réelle (formule de Haversine) si les positions sont connues, sinon même gouvernorat ou non. |
| `prix` | Tarif horaire comparé au tarif médian des candidats. |
| `fiabilite` | Taux d'interventions menées à terme parmi les demandes traitées, lissé (Laplace) pour les nouveaux. |
| `experience` | Années d'expérience (plafonnées à 15). |
| `affinite` | Historique du client : déjà satisfait de ce prestataire, déjà client de ce métier, ou mauvaise expérience. |
| `disponibilite` | Accepte actuellement des demandes. |

Le score est un modèle **logistique** : `score = sigmoïde(biais + Σ poidsᵢ × critèreᵢ)`, soit une estimation de la probabilité que l'intervention se passe bien.
La contribution de chaque critère, `poidsᵢ × (critèreᵢ − 0,5)`, donne les **raisons** affichées au client (« Correspond à votre besoin », « À 0,7 km de chez vous », « Très bien noté : 4,8/5 (40 avis) »…).

## Apprentissage

- Au départ, le service utilise des **poids experts** ([app/model.py](app/model.py)).
- `php artisan reco:train` envoie l'historique des rendez-vous terminés : **réussi** (terminé, sans note ≤ 2) ou **échoué** (refusé, ou noté ≤ 2/5).
  Le service entraîne une régression logistique, mesure sa précision en validation croisée, et enregistre le modèle dans `models/ranker.json`.
- Les poids appris sont **rapprochés des poids experts** tant que l'historique est petit (`α = n / (n + 60)`) : peu de données ne peuvent pas produire un classement absurde.
- Il faut au moins 30 rendez-vous, dont 5 réussis et 5 échoués ; sinon les poids experts restent utilisés.
- L'entraînement est planifié chaque lundi à 3 h (`php artisan schedule:work`).

## API

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/health` | État du service et du modèle (poids, nombre d'exemples, précision). |
| POST | `/recommend` | `{langue?: fr\|ar\|en, client, besoin?, categorie?, candidates[], top_k}` → `{model, recommendations[]}`. Les `raisons` sont rédigées dans la `langue` demandée (français par défaut). |
| POST | `/train` | `{samples: [{client, besoin, categorie, candidate, tarif_reference, label}]}` → poids et précision. |
| GET / DELETE | `/model` | Voir le modèle / revenir aux poids experts. |

Si la variable d'environnement `AI_RECO_KEY` est définie, chaque appel doit envoyer l'en-tête `X-Api-Key` (même valeur dans `DarFix/.env`).
