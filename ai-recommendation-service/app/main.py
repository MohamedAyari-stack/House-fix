"""DarFix AI recommendation service.

Laravel (App\\Services\\AiRecommender) sends the candidates and the client context; this service
ranks them and explains each recommendation. It never reads the database itself.

Run:  .venv/Scripts/python -m uvicorn app.main:app --port 8100
"""

import os
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException

from . import features
from .model import Ranker
from .schemas import (
    Recommendation,
    RecommendRequest,
    RecommendResponse,
    TrainRequest,
    TrainResponse,
)

MODEL_PATH = Path(os.getenv("RANKER_PATH", Path(__file__).resolve().parent.parent / "models" / "ranker.json"))
API_KEY = os.getenv("AI_RECO_KEY")  # optional shared secret with Laravel (header X-Api-Key)

app = FastAPI(title="DarFix — recommandation IA", version="1.0.0")
ranker = Ranker(MODEL_PATH)


def check_key(x_api_key: str | None = Header(default=None)) -> None:
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Clé API invalide.")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": ranker.info()}


@app.post("/recommend", response_model=RecommendResponse, dependencies=[Depends(check_key)])
def recommend(req: RecommendRequest) -> RecommendResponse:
    rows = features.build(req.client, req.besoin, req.categorie, req.candidates)
    scored = sorted(((ranker.score(r), r) for r in rows), key=lambda sr: sr[0], reverse=True)

    return RecommendResponse(
        model=ranker.kind,
        recommendations=[
            Recommendation(
                id=r.candidate.id,
                score=round(s, 4),
                distance_km=r.distance_km,
                raisons=ranker.reasons(r, req.langue),
                features={k: round(v, 3) for k, v in r.values.items()},
            )
            for s, r in scored[: req.top_k]
        ],
    )


@app.post("/train", response_model=TrainResponse, dependencies=[Depends(check_key)])
def train(req: TrainRequest) -> TrainResponse:
    rows = [
        features.build(s.client, s.besoin, s.categorie, [s.candidate], s.tarif_reference)[0]
        for s in req.samples
    ]
    trained, message = ranker.train(rows, [s.label for s in req.samples])
    info = ranker.info()
    return TrainResponse(
        model=ranker.kind,
        trained=trained,
        samples=len(req.samples),
        message=message,
        weights=info["weights"],
        accuracy=info["accuracy"],
    )


@app.get("/model", dependencies=[Depends(check_key)])
def model_info() -> dict:
    return ranker.info()


@app.delete("/model", dependencies=[Depends(check_key)])
def reset_model() -> dict:
    ranker.reset()
    return {"message": "Poids experts rétablis.", "model": ranker.info()}
