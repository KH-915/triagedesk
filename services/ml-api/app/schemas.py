from pydantic import BaseModel, field_validator


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


class PredictResponse(BaseModel):
    predicted_category: str
    confidence_score: float
    model_version: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: str | None
