from pydantic import BaseModel, Field, field_validator


class PredictRequest(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def text_must_not_be_empty(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("text must not be empty or whitespace-only")
        # Spec OD-05b: truncate to 5000 chars (matches training script)
        return v[:5000]


class PredictBatchRequest(BaseModel):
    # Matches the API's import row cap so one CSV/XLSX upload is one call.
    texts: list[str] = Field(min_length=1, max_length=1000)

    @field_validator("texts")
    @classmethod
    def texts_must_not_be_empty(cls, v: list[str]) -> list[str]:
        if any(not t.strip() for t in v):
            raise ValueError("texts must not contain empty or whitespace-only entries")
        return [t[:5000] for t in v]


class PredictResponse(BaseModel):
    predicted_category: str
    confidence_score: float
    model_version: str


class PredictBatchResponse(BaseModel):
    predictions: list[PredictResponse]


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: str | None
