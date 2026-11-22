"""Request/response contracts shared with Laravel (App\\Services\\AiRecommender)."""

from typing import Literal

from pydantic import BaseModel, Field


class PrestataireStats(BaseModel):
    """Counts of the prestataire's past rendez-vous, by outcome."""

    termines: int = 0  # status termine or facture
    refuses: int = 0
    acceptes: int = 0  # accepted, not finished yet


class Candidate(BaseModel):
    id: int
    categorie: str | None = None
    specialite: str | None = None
    description: str | None = None
    certifications: str | None = None
    gouvernorat: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    note_moyenne: float = 0
    nb_avis: int = 0
    tarif_horaire: float = 0
    experience_annees: int = 0
    is_available: bool = True
    stats: PrestataireStats = Field(default_factory=PrestataireStats)


class PastBooking(BaseModel):
    """One finished rendez-vous of the client, used for the personal-history signal."""

    prestataire_id: int
    categorie: str | None = None
    note: int | None = None  # rating the client gave, if any


class ClientContext(BaseModel):
    gouvernorat: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    historique: list[PastBooking] = Field(default_factory=list)


class RecommendRequest(BaseModel):
    langue: Literal["fr", "ar", "en"] = "fr"  # language of the explanations ("raisons")
    client: ClientContext = Field(default_factory=ClientContext)
    besoin: str | None = Field(default=None, max_length=500, description="Free-text need, e.g. 'fuite sous l'évier'")
    categorie: str | None = None
    candidates: list[Candidate]
    top_k: int = Field(default=6, ge=1, le=50)


class Recommendation(BaseModel):
    id: int
    score: float
    distance_km: float | None
    raisons: list[str]
    features: dict[str, float]


class RecommendResponse(BaseModel):
    model: str  # "expert" (prior weights) or "appris" (trained on history)
    recommendations: list[Recommendation]


class TrainingSample(BaseModel):
    """A past rendez-vous: the context at booking time and whether it went well (label 1) or not (0)."""

    client: ClientContext = Field(default_factory=ClientContext)
    besoin: str | None = None
    categorie: str | None = None
    candidate: Candidate
    tarif_reference: float | None = None  # median hourly rate of the trade at that time
    label: int = Field(ge=0, le=1)


class TrainRequest(BaseModel):
    samples: list[TrainingSample]


class TrainResponse(BaseModel):
    model: str
    trained: bool
    samples: int
    message: str
    weights: dict[str, float]
    accuracy: float | None = None
