"""
main.py — FastAPI application for the TriageDesk ML service.

Endpoints:
  GET  /health    — liveness + model readiness check
  POST /predict   — run text classification inference

The Node.js API is the only caller. This service is NOT exposed to the frontend.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException

from .schemas import PredictRequest, PredictResponse, HealthResponse
from .predictor import predictor


# ── Lifespan ──────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the model once at startup; clean up on shutdown."""
    predictor.load()
    yield
    # Nothing to clean up for a stateless in-memory model


# ── App ───────────────────────────────────────────────────────

app = FastAPI(
    title="TriageDesk ML Service",
    description="Internal text classification service. Not exposed to the public internet.",
    version="1.0.0",
    lifespan=lifespan,
    # Disable the interactive docs in production to reduce attack surface
    docs_url="/docs",
    redoc_url="/redoc",
)


# ── Routes ────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["ops"])
def health() -> HealthResponse:
    """
    Spec §6.4: Always returns HTTP 200.
    The Node.js API calls this to determine whether to show 'degraded' in its
    own health check.
    """
    return HealthResponse(
        status="ok",
        model_loaded=predictor.is_loaded,
        model_version=predictor.version if predictor.is_loaded else None,
    )


@app.post("/predict", response_model=PredictResponse, tags=["inference"])
def predict(request: PredictRequest) -> PredictResponse:
    """
    Classify the given text and return a category prediction.

    Spec §8.9: The Node.js API enforces a 3-second timeout on this call.
    If the model is not loaded (no training artifact), returns 503.
    """
    if not predictor.is_loaded:
        raise HTTPException(
            status_code=503,
            detail=(
                "Model is not loaded. The ML service cannot serve predictions. "
                "Run the training script and ensure MODEL_PATH points to the artifact."
            ),
        )

    try:
        result = predictor.predict(request.text)
        return PredictResponse(**result)
    except Exception as exc:
        # Log the exception server-side; return a generic 500 to the caller
        print(f"[ERROR] Prediction failed: {exc}")
        raise HTTPException(status_code=500, detail="Prediction failed due to an internal error.")
