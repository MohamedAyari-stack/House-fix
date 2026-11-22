"""Turns (client, need, candidate) into normalized features in [0, 1] plus the raw values used in explanations."""

import math
from dataclasses import dataclass

from .schemas import Candidate, ClientContext
from .text import similarities

FEATURES = [
    "pertinence",     # need / category matches the profile
    "qualite",        # Bayesian average rating
    "confiance",      # how many reviews back the rating
    "proximite",      # distance to the client
    "prix",           # cheaper than the other candidates
    "fiabilite",      # share of accepted jobs carried through
    "experience",     # years in the trade
    "affinite",       # the client's own past experience with this prestataire / trade
    "disponibilite",  # currently accepting requests
]

NEUTRAL = 0.5
DISTANCE_MAX_KM = 50.0
EXPERIENCE_MAX = 15
# Bayesian rating: a prestataire starts with PRIOR_COUNT virtual reviews at PRIOR_MEAN.
PRIOR_MEAN = 3.8
PRIOR_COUNT = 3


@dataclass
class Row:
    candidate: Candidate
    values: dict[str, float]
    distance_km: float | None
    note_bayes: float
    taux_reussite: float | None


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def profile_text(c: Candidate) -> str:
    # The category is repeated so it weighs more than a long free description.
    return " ".join(filter(None, [c.categorie, c.categorie, c.specialite, c.description, c.certifications]))


def build(
    client: ClientContext,
    besoin: str | None,
    categorie: str | None,
    candidates: list[Candidate],
    tarif_reference: float | None = None,
) -> list[Row]:
    """tarif_reference: typical hourly rate to compare with (median of the candidates when omitted)."""
    need = " ".join(filter(None, [besoin, categorie]))
    sims = similarities(need, [profile_text(c) for c in candidates])

    if tarif_reference is None:
        tarif_reference = median([c.tarif_horaire for c in candidates if c.tarif_horaire > 0])

    rows = []
    for i, c in enumerate(candidates):
        # Proximity: exact distance when both positions are known, otherwise same gouvernorat or not.
        distance = None
        if None not in (client.latitude, client.longitude, c.latitude, c.longitude):
            distance = round(haversine(client.latitude, client.longitude, c.latitude, c.longitude), 1)
            proximite = 1 - min(distance, DISTANCE_MAX_KM) / DISTANCE_MAX_KM
        elif client.gouvernorat and c.gouvernorat:
            proximite = 0.8 if client.gouvernorat == c.gouvernorat else 0.2
        else:
            proximite = NEUTRAL

        note_bayes = (PRIOR_MEAN * PRIOR_COUNT + c.note_moyenne * c.nb_avis) / (PRIOR_COUNT + c.nb_avis)

        # 0.5 at the reference rate, 1 at half of it or less, 0 at 1.5x or more.
        prix = NEUTRAL
        if c.tarif_horaire > 0 and tarif_reference:
            prix = min(1.0, max(0.0, 0.5 + (tarif_reference - c.tarif_horaire) / tarif_reference))

        # Laplace-smoothed completion rate: new prestataires start around 2/3, not at 0 or 1.
        s = c.stats
        decided = s.termines + s.refuses
        fiabilite = (s.termines + 2) / (decided + 3)
        taux = s.termines / decided if decided else None

        rows.append(Row(
            candidate=c,
            values={
                "pertinence": sims[i] if sims else NEUTRAL,
                "qualite": note_bayes / 5,
                "confiance": 1 - math.exp(-c.nb_avis / 5),
                "proximite": proximite,
                "prix": prix,
                "fiabilite": fiabilite,
                "experience": min(c.experience_annees, EXPERIENCE_MAX) / EXPERIENCE_MAX,
                "affinite": affinity(client, c),
                "disponibilite": 1.0 if c.is_available else 0.0,
            },
            distance_km=distance,
            note_bayes=note_bayes,
            taux_reussite=taux,
        ))
    return rows


def median(values: list[float]) -> float | None:
    if not values:
        return None
    s = sorted(values)
    mid = len(s) // 2
    return s[mid] if len(s) % 2 else (s[mid - 1] + s[mid]) / 2


def affinity(client: ClientContext, c: Candidate) -> float:
    """1 = the client was happy with this prestataire, 0 = unhappy, 0.5 = no history."""
    own = [b for b in client.historique if b.prestataire_id == c.id]
    rated = [b.note for b in own if b.note is not None]
    if rated:
        return min(1.0, max(0.0, (sum(rated) / len(rated) - 1) / 4))
    if own:
        return 0.7  # booked before without complaint
    if c.categorie and any(b.categorie == c.categorie for b in client.historique):
        return 0.6  # trade the client already uses
    return NEUTRAL
