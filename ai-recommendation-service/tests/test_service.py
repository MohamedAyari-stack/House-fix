import random

import pytest
from fastapi.testclient import TestClient

from app import main
from app.model import EXPERT_WEIGHTS, Ranker


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "ranker", Ranker(tmp_path / "ranker.json"))
    monkeypatch.setattr(main, "API_KEY", None)
    return TestClient(main.app)


def pro(id, categorie, **kw):
    base = {
        "id": id, "categorie": categorie, "specialite": None, "description": None, "gouvernorat": "Tunis",
        "note_moyenne": 4.5, "nb_avis": 10, "tarif_horaire": 40, "experience_annees": 5, "is_available": True,
        "stats": {"termines": 8, "refuses": 1, "acceptes": 0},
    }
    return base | kw


PLOMBIER = pro(1, "Plomberie", specialite="Plombier", description="Fuites, chauffe-eau, sanitaires et canalisations")
ELECTRICIEN = pro(2, "Électricité", specialite="Électricien", description="Tableaux électriques et dépannage")
SERRURIER = pro(3, "Serrurerie", specialite="Serrurier", description="Ouverture de porte, changement de serrure")


def ids(response):
    return [r["id"] for r in response.json()["recommendations"]]


def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["model"]["kind"] == "expert"


def test_the_need_text_decides_the_trade(client):
    for need, expected in [("fuite sous l'évier", 1), ("mon disjoncteur saute", 2), ("je suis bloqué dehors, clé perdue", 3)]:
        res = client.post("/recommend", json={"besoin": need, "candidates": [PLOMBIER, ELECTRICIEN, SERRURIER]})
        assert res.status_code == 200
        assert ids(res)[0] == expected, need
        assert "Correspond à votre besoin" in res.json()["recommendations"][0]["raisons"]


def test_the_need_beats_a_nearby_favourite_of_another_trade(client):
    # The client loves a plumber who lives next door, but asks for air conditioning.
    plombier = pro(1, "Plomberie", specialite="Plombier", description="Fuites et sanitaires",
                   latitude=36.806, longitude=10.181, note_moyenne=5.0, nb_avis=20)
    frigoriste = pro(2, "Climatisation", specialite="Frigoriste", description="Installation et entretien de climatiseurs",
                     latitude=36.86, longitude=10.25, note_moyenne=4.2, nb_avis=4)
    ctx = {"latitude": 36.80, "longitude": 10.18, "historique": [{"prestataire_id": 1, "categorie": "Plomberie", "note": 5}]}

    res = client.post("/recommend", json={"client": ctx, "besoin": "la clim ne refroidit plus", "candidates": [plombier, frigoriste]})
    assert ids(res)[0] == 2

    # Without a need, the nearby favourite comes first again.
    assert ids(client.post("/recommend", json={"client": ctx, "candidates": [plombier, frigoriste]}))[0] == 1


def test_bayesian_rating_prefers_many_good_reviews_over_one_perfect_review(client):
    lucky = pro(1, "Plomberie", note_moyenne=5.0, nb_avis=1)
    proven = pro(2, "Plomberie", note_moyenne=4.8, nb_avis=40)
    assert ids(client.post("/recommend", json={"candidates": [lucky, proven]}))[0] == 2


def test_distance_is_computed_and_explained(client):
    near = pro(1, "Plomberie", latitude=36.80, longitude=10.18)
    far = pro(2, "Plomberie", latitude=35.82, longitude=10.63)  # Sousse
    res = client.post("/recommend", json={"client": {"latitude": 36.81, "longitude": 10.17}, "candidates": [far, near]})
    top = res.json()["recommendations"][0]
    assert top["id"] == 1
    assert top["distance_km"] < 3
    assert any(r.startswith("À ") and "km" in r for r in top["raisons"])


def test_unavailable_prestataire_comes_last(client):
    busy = pro(1, "Plomberie", note_moyenne=5.0, nb_avis=50, is_available=False)
    free = pro(2, "Plomberie", note_moyenne=4.0, nb_avis=5)
    assert ids(client.post("/recommend", json={"candidates": [busy, free]})) == [2, 1]


def test_past_satisfaction_is_remembered(client):
    a, b = pro(1, "Plomberie"), pro(2, "Plomberie")
    history = {"historique": [{"prestataire_id": 2, "categorie": "Plomberie", "note": 5}]}
    res = client.post("/recommend", json={"client": history, "candidates": [a, b]})
    assert ids(res)[0] == 2
    assert "Vous avez déjà été satisfait de ses services" in res.json()["recommendations"][0]["raisons"]


def test_top_k_and_reasons_are_limited(client):
    many = [pro(i, "Plomberie") for i in range(1, 11)]
    recs = client.post("/recommend", json={"candidates": many, "top_k": 4}).json()["recommendations"]
    assert len(recs) == 4
    assert all(1 <= len(r["raisons"]) <= 3 for r in recs)


def test_training_needs_enough_history(client):
    samples = [{"candidate": PLOMBIER, "label": 1}] * 5
    body = client.post("/train", json={"samples": samples}).json()
    assert body["trained"] is False
    assert body["model"] == "expert"
    assert body["weights"] == pytest.approx(EXPERT_WEIGHTS)


def test_training_learns_from_history_and_is_saved(client, tmp_path):
    # Synthetic history where reliable prestataires succeed and unreliable ones fail.
    rnd = random.Random(42)
    samples = []
    for i in range(120):
        good = i % 2 == 0
        termines, refuses = (rnd.randint(15, 30), rnd.randint(0, 2)) if good else (rnd.randint(0, 3), rnd.randint(8, 20))
        cand = pro(i, "Plomberie", stats={"termines": termines, "refuses": refuses, "acceptes": 0}, nb_avis=rnd.randint(0, 20))
        samples.append({"candidate": cand, "tarif_reference": 40, "label": int(good)})

    body = client.post("/train", json={"samples": samples}).json()
    assert body["trained"] is True
    assert body["model"] == "appris"
    assert body["accuracy"] > 0.9
    assert body["weights"]["fiabilite"] > EXPERT_WEIGHTS["fiabilite"]  # reliability matters more than the prior said
    assert (tmp_path / "ranker.json").exists()

    assert client.get("/health").json()["model"]["kind"] == "appris"
    assert client.delete("/model").json()["model"]["kind"] == "expert"


def test_api_key_is_enforced_when_configured(client, monkeypatch):
    monkeypatch.setattr(main, "API_KEY", "secret")
    payload = {"candidates": [PLOMBIER]}
    assert client.post("/recommend", json=payload).status_code == 401
    assert client.post("/recommend", json=payload, headers={"X-Api-Key": "secret"}).status_code == 200


def test_reasons_are_given_in_arabic_when_asked(client):
    near = pro(1, "Plomberie", specialite="Plombier", description="Fuites et sanitaires",
               latitude=36.80, longitude=10.18, note_moyenne=4.9, nb_avis=12, gouvernorat="Sousse")
    payload = {"langue": "ar", "besoin": "fuite d'eau", "client": {"latitude": 36.81, "longitude": 10.17}, "candidates": [near]}
    raisons = client.post("/recommend", json=payload).json()["recommendations"][0]["raisons"]

    assert "يتوافق مع حاجتك" in raisons
    assert any(r.startswith("على بعد") and "كم" in r for r in raisons)
    assert not any("Correspond" in r for r in raisons)

    # Without coordinates, the gouvernorat is named in Arabic.
    far = pro(2, "Plomberie", gouvernorat="Sousse")
    ctx = {"gouvernorat": "Sousse"}
    raisons = client.post("/recommend", json={"langue": "ar", "client": ctx, "candidates": [far]}).json()["recommendations"][0]["raisons"]
    assert any("سوسة" in r for r in raisons)


def test_reasons_are_given_in_english_when_asked(client):
    near = pro(1, "Plomberie", specialite="Plombier", description="Fuites et sanitaires",
               latitude=36.80, longitude=10.18, note_moyenne=4.9, nb_avis=12)
    payload = {"langue": "en", "besoin": "fuite d'eau", "client": {"latitude": 36.81, "longitude": 10.17}, "candidates": [near]}
    raisons = client.post("/recommend", json=payload).json()["recommendations"][0]["raisons"]
    assert "Matches your need" in raisons
    assert any(r.endswith("km from you") and "." in r for r in raisons)


def test_unknown_language_is_rejected(client):
    assert client.post("/recommend", json={"langue": "de", "candidates": [PLOMBIER]}).status_code == 422


@pytest.mark.parametrize("need, expected", [
    ("leaking pipe under the sink", 1),
    ("my circuit breaker keeps tripping", 2),
    ("locked out, lost my key", 3),
    ("تسرب الماء تحت المغسلة", 1),
    ("الضوء مقطوع و الديجونكتور يطيح", 2),  # Tunisian: the breaker keeps tripping
    ("ضاع مفتاح الباب", 3),
])
def test_needs_in_english_and_arabic_match_french_profiles(client, need, expected):
    res = client.post("/recommend", json={"besoin": need, "candidates": [PLOMBIER, ELECTRICIEN, SERRURIER]})
    assert ids(res)[0] == expected, need


# The services added to the catalogue, with their catalogue descriptions.
NOUVEAUX = [
    pro(10, "Étanchéité", description="Toits-terrasses, infiltrations d'eau et traitement de l'humidité."),
    pro(11, "Maçonnerie & carrelage", description="Petits travaux de maçonnerie, carrelage, faïence et dalles."),
    pro(12, "Électroménager", description="Réparation de machines à laver, réfrigérateurs, fours et lave-vaisselle."),
    pro(13, "Aluminium & vitrerie", description="Fenêtres et portes en aluminium, baies vitrées et remplacement de vitres."),
    pro(14, "Ferronnerie", description="Grilles de protection, portails, rampes et soudure."),
    pro(15, "Pompes & bâches à eau", description="Surpresseurs, pompes, citernes et bâches à eau."),
    pro(16, "Chauffage & gaz", description="Chauffage central, chaudières, radiateurs et raccordement au gaz."),
    pro(17, "Énergie solaire", description="Chauffe-eau solaires et panneaux photovoltaïques (programmes Prosol)."),
]


@pytest.mark.parametrize("need, expected", [
    ("infiltration d'eau par le toit quand il pleut", 10),
    ("water is coming through the roof", 10),
    ("الماء يدخل من السطح كي تصب المطر", 10),
    ("refaire le carrelage de la cuisine", 11),
    ("retile the bathroom floor", 11),
    ("تبديل الجليز في الكوجينة", 11),
    ("ma machine à laver ne vidange plus", 12),
    ("the fridge stopped cooling food", 12),
    ("الغسالة ما عادش تخدم", 12),
    ("remplacer une vitre cassée de la baie vitrée", 13),
    ("broken glass on my aluminium window", 13),
    ("بلور الشباك مكسور", 13),
    ("poser une grille de protection sur la fenêtre", 14),
    ("weld a new iron gate", 14),
    ("نحب نركب بوابة حديد", 14),
    ("pas de pression d'eau au 2e étage, il faut un surpresseur", 15),
    ("the water pump is not working", 15),
    ("البومبة متاع الماجل طاحت", 15),
    ("la chaudière du chauffage central est en panne", 16),
    ("gas boiler radiators are cold", 16),
    ("الشوفاج ما يسخنش", 16),
    ("installer un chauffe-eau solaire Prosol", 17),
    ("install solar panels on the roof", 17),
    ("نحب نركب سخان شمسي", 17),
])
def test_new_services_are_recognised_in_three_languages(client, need, expected):
    res = client.post("/recommend", json={"besoin": need, "candidates": [PLOMBIER, ELECTRICIEN, SERRURIER, *NOUVEAUX]})
    assert ids(res)[0] == expected, need
