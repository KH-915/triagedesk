"""
predictor.py — Model loading and inference.

This module is a placeholder until the training script (training/train.py)
produces a model artifact. The Predictor class is designed to work with a
scikit-learn Pipeline that has:
  - A TfidfVectorizer as the first step
  - A LogisticRegression classifier as the final step

The model is loaded once at service startup via the lifespan hook in main.py.
All subsequent /predict requests reuse the in-memory pipeline.
"""

import os
import pickle
from pathlib import Path

MODEL_PATH = os.environ.get("MODEL_PATH", "models/model.pkl")
MODEL_VERSION = os.environ.get("MODEL_VERSION", "v0.0.0-placeholder")


class Predictor:
    def __init__(self) -> None:
        self._pipeline = None
        self._version: str = MODEL_VERSION

    # ── Loading ────────────────────────────────────────────────

    def load(self) -> None:
        """
        Load the serialised scikit-learn pipeline from MODEL_PATH.

        If the file does not exist, the predictor stays in an unloaded state.
        The /health endpoint will report model_loaded=False.
        The /predict endpoint will return HTTP 503.

        This is intentional: the service should start without crashing even
        before the first training run has completed.
        """
        model_file = Path(MODEL_PATH)
        if not model_file.exists():
            print(
                f"WARNING: Model file not found at {MODEL_PATH}. "
                "Run services/ml-api/training/train.py first."
            )
            self._pipeline = None
            return

        with open(model_file, "rb") as f:
            self._pipeline = pickle.load(f)

        print(f"Model loaded from {MODEL_PATH} (version: {self._version})")

    # ── Properties ─────────────────────────────────────────────

    @property
    def is_loaded(self) -> bool:
        return self._pipeline is not None

    @property
    def version(self) -> str:
        return self._version

    # ── Inference ──────────────────────────────────────────────

    def predict(self, text: str) -> dict:
        """
        Run inference on the given text.

        Returns a dict compatible with PredictResponse:
          { predicted_category, confidence_score, model_version }

        Raises:
          RuntimeError if the model is not loaded.
        """
        if not self.is_loaded:
            raise RuntimeError(
                "Model is not loaded. Run the training script before serving predictions."
            )

        import numpy as np  # imported lazily to keep startup fast

        # The pipeline exposes predict_proba because LogisticRegression was fit with it
        proba = self._pipeline.predict_proba([text])[0]
        class_idx = int(np.argmax(proba))
        predicted_category: str = self._pipeline.classes_[class_idx]
        confidence_score: float = float(proba[class_idx])

        return {
            "predicted_category": predicted_category,
            "confidence_score": confidence_score,
            "model_version": self._version,
        }


# Singleton — loaded once at startup via main.py lifespan
predictor = Predictor()
