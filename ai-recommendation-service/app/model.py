"""Explainable ranker: a logistic model over the features of app.features.

score = sigmoid(bias + Σ wᵢ·xᵢ) ≈ probability that the rendez-vous goes well.
It starts with expert weights; once enough history exists, /train fits a logistic
regression and shrinks it toward the expert weights (the more samples, the more the
learned weights count), so a small or noisy history cannot produce absurd rankings.
Each feature's contribution wᵢ·(xᵢ − 0.5) is turned into the French "why" shown to the client.
"""

import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score

from .features import FEATURES, NEUTRAL, Row

EXPERT_WEIGHTS: dict[str, float] = {
    # An explicit need must outweigh proximity + past satisfaction with another trade
    # (without a need this feature is neutral, so it changes nothing).
    "pertinence": 5.0,
    "qualite": 2.5,
    "confiance": 0.8,
    "proximite": 1.8,
    "prix": 1.0,
    "fiabilite": 1.5,
    "experience": 0.5,
    "affinite": 1.2,
    "disponibilite": 2.0,
}

MIN_SAMPLES = 30
MIN_PER_CLASS = 5
# Shrinkage strength: with SHRINK samples, learned and expert weights count equally.
SHRINK = 60
MAX_REASONS = 3


def neutral_bias(weights: dict[str, float]) -> float:
    """Bias that puts an all-neutral candidate at a score of 0.5."""
    return -sum(w * NEUTRAL for w in weights.values())


class Ranker:
    def __init__(self, path: Path):
        self.path = path
        self.weights = dict(EXPERT_WEIGHTS)
        self.bias = neutral_bias(self.weights)
        self.kind = "expert"
        self.samples = 0
        self.accuracy: float | None = None
        self.trained_at: str | None = None
        self.load()

    # ---------- persistence ----------
    def load(self) -> None:
        if not self.path.exists():
            return
        data = json.loads(self.path.read_text(encoding="utf-8"))
        self.weights = {f: float(data["weights"].get(f, EXPERT_WEIGHTS[f])) for f in FEATURES}
        self.bias = float(data["bias"])
        self.kind = data.get("kind", "appris")
        self.samples = int(data.get("samples", 0))
        self.accuracy = data.get("accuracy")
        self.trained_at = data.get("trained_at")

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.info(), indent=2, ensure_ascii=False), encoding="utf-8")

    def info(self) -> dict:
        return {
            "kind": self.kind,
            "weights": {k: round(v, 4) for k, v in self.weights.items()},
            "bias": round(self.bias, 4),
            "samples": self.samples,
            "accuracy": self.accuracy,
            "trained_at": self.trained_at,
        }

    # ---------- scoring ----------
    def score(self, row: Row) -> float:
        z = self.bias + sum(self.weights[f] * row.values[f] for f in FEATURES)
        return 1 / (1 + math.exp(-z))

    def contributions(self, row: Row) -> dict[str, float]:
        return {f: self.weights[f] * (row.values[f] - NEUTRAL) for f in FEATURES}

    def reasons(self, row: Row, langue: str = "fr") -> list[str]:
        ranked = sorted(self.contributions(row).items(), key=lambda kv: kv[1], reverse=True)
        out = [text for f, c in ranked if c > 0.05 and (text := explain(f, row, langue))]
        return out[:MAX_REASONS] or [TEXTS[langue]["default"]]

    # ---------- training ----------
    def train(self, rows: list[Row], labels: list[int]) -> tuple[bool, str]:
        n = len(rows)
        positives = sum(labels)
        negatives = n - positives
        if n < MIN_SAMPLES or min(positives, negatives) < MIN_PER_CLASS:
            return False, (
                f"Historique insuffisant ({n} rendez-vous, {positives} réussis, {negatives} échoués) : "
                f"il en faut au moins {MIN_SAMPLES}, dont {MIN_PER_CLASS} de chaque sorte. Les poids experts restent utilisés."
            )

        x = np.array([[r.values[f] for f in FEATURES] for r in rows])
        y = np.array(labels)
        clf = LogisticRegression(C=1.0, class_weight="balanced", max_iter=1000)
        folds = min(5, positives, negatives)
        self.accuracy = round(float(cross_val_score(clf, x, y, cv=folds).mean()), 3)
        clf.fit(x, y)

        # Shrink toward the expert weights: alpha → 1 as the history grows.
        alpha = n / (n + SHRINK)
        learned = dict(zip(FEATURES, clf.coef_[0]))
        self.weights = {f: alpha * learned[f] + (1 - alpha) * EXPERT_WEIGHTS[f] for f in FEATURES}
        self.bias = alpha * float(clf.intercept_[0]) + (1 - alpha) * neutral_bias(EXPERT_WEIGHTS)
        self.kind = "appris"
        self.samples = n
        self.trained_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        self.save()
        return True, f"Modèle entraîné sur {n} rendez-vous (précision en validation croisée : {self.accuracy:.0%})."

    def reset(self) -> None:
        """Back to the expert weights (deletes the trained model)."""
        self.weights = dict(EXPERT_WEIGHTS)
        self.bias = neutral_bias(self.weights)
        self.kind, self.samples, self.accuracy, self.trained_at = "expert", 0, None, None
        if self.path.exists():
            self.path.unlink()


# Explanation templates per language ("raisons" shown on the client's cards).
TEXTS: dict[str, dict[str, str]] = {
    "fr": {
        "default": "Profil validé par l'équipe DarFix",
        "pertinence": "Correspond à votre besoin",
        "qualite": "Très bien noté : {note}/5 ({avis} avis)",
        "confiance": "Recommandé par {avis} clients",
        "distance": "À {km} km de chez vous",
        "gouvernorat": "Intervient dans votre gouvernorat ({gouvernorat})",
        "prix": "Tarif avantageux : {tarif} DT/h",
        "fiabilite": "Fiable : {taux} % des interventions menées à terme",
        "experience": "{ans} ans d'expérience",
        "satisfait": "Vous avez déjà été satisfait de ses services",
        "habitue": "Spécialiste d'un service que vous utilisez déjà",
    },
    "ar": {
        "default": "ملف صادق عليه فريق DarFix",
        "pertinence": "يتوافق مع حاجتك",
        "qualite": "تقييم ممتاز: {note}/5 (التقييمات: {avis})",
        "confiance": "أوصى به {avis} من الحرفاء",
        "distance": "على بعد {km} كم منك",
        "gouvernorat": "يتدخّل في ولايتك ({gouvernorat})",
        "prix": "تعريفة مناسبة: {tarif} د.ت/س",
        "fiabilite": "موثوق: {taux} % من التدخّلات أُنجزت",
        "experience": "سنوات الخبرة: {ans}",
        "satisfait": "سبق أن كنت راضيًا عن خدماته",
        "habitue": "مختص في خدمة تستعملها من قبل",
    },
    "en": {
        "default": "Profile approved by the DarFix team",
        "pertinence": "Matches your need",
        "qualite": "Highly rated: {note}/5 ({avis} {reviews})",
        "confiance": "Recommended by {avis} clients",
        "distance": "{km} km from you",
        "gouvernorat": "Works in your governorate ({gouvernorat})",
        "prix": "Good rate: {tarif} TND/h",
        "fiabilite": "Reliable: {taux}% of jobs completed",
        "experience": "{ans} {years} of experience",
        "satisfait": "You were happy with this provider before",
        "habitue": "Specialist in a service you already use",
    },
}

GOUVERNORATS_AR = {
    "Ariana": "أريانة", "Béja": "باجة", "Ben Arous": "بن عروس", "Bizerte": "بنزرت", "Gabès": "قابس",
    "Gafsa": "قفصة", "Jendouba": "جندوبة", "Kairouan": "القيروان", "Kasserine": "القصرين", "Kébili": "قبلي",
    "Le Kef": "الكاف", "Mahdia": "المهدية", "La Manouba": "منوبة", "Médenine": "مدنين", "Monastir": "المنستير",
    "Nabeul": "نابل", "Sfax": "صفاقس", "Sidi Bouzid": "سيدي بوزيد", "Siliana": "سليانة", "Sousse": "سوسة",
    "Tataouine": "تطاوين", "Tozeur": "توزر", "Tunis": "تونس", "Zaghouan": "زغوان",
}


def decimal(x: float, langue: str = "fr", digits: int = 1) -> str:
    """4.9 -> "4,9" in French and Tunisian Arabic, "4.9" in English."""
    text = f"{x:.{digits}f}"
    return text if langue == "en" else text.replace(".", ",")


def explain(feature: str, row: Row, langue: str = "fr") -> str | None:
    """Sentence, in the requested language, for a feature that pushed this candidate up."""
    t = TEXTS.get(langue, TEXTS["fr"])
    c = row.candidate
    v = row.values[feature]
    match feature:
        case "pertinence" if v >= 0.6:
            return t["pertinence"]
        case "qualite" if c.nb_avis > 0:
            # Only the English template has a {reviews} word that agrees with the count.
            return t["qualite"].format(note=decimal(c.note_moyenne, langue), avis=c.nb_avis, reviews="review" if c.nb_avis == 1 else "reviews")
        case "confiance" if c.nb_avis >= 3:
            return t["confiance"].format(avis=c.nb_avis)
        case "proximite":
            if row.distance_km is not None:
                return t["distance"].format(km=decimal(row.distance_km, langue))
            if c.gouvernorat:
                nom = GOUVERNORATS_AR.get(c.gouvernorat, c.gouvernorat) if langue == "ar" else c.gouvernorat
                return t["gouvernorat"].format(gouvernorat=nom)
            return None
        case "prix" if c.tarif_horaire > 0:
            return t["prix"].format(tarif=f"{c.tarif_horaire:.0f}")
        case "fiabilite" if row.taux_reussite is not None:
            return t["fiabilite"].format(taux=round(row.taux_reussite * 100))
        case "experience" if c.experience_annees > 0:
            return t["experience"].format(ans=c.experience_annees, years="year" if c.experience_annees == 1 else "years")
        case "affinite" if v >= 0.75:
            return t["satisfait"]
        case "affinite" if v >= 0.6:
            return t["habitue"]
    # "disponibilite" is not explained: nearly every candidate is available, so it says nothing distinctive.
    return None
