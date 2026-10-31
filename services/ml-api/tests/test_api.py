from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import predictor as predictor_module
from app.main import app

MODEL = Path(__file__).resolve().parent.parent / "models" / "model.pkl"
VALID = {"account", "billing", "cancellation", "delivery", "feedback",
         "order", "refund", "shipping", "technical", "other"}


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(predictor_module, "MODEL_PATH", str(MODEL))
    with TestClient(app) as c:
        yield c


def test_health_reports_model_loaded(client):
    if not MODEL.exists():
        pytest.skip("run training/train.py first")
    body = client.get("/health").json()
    assert body["status"] == "ok" and body["model_loaded"] is True


def test_predict_returns_valid_category(client):
    if not MODEL.exists():
        pytest.skip("run training/train.py first")
    r = client.post("/predict", json={"text": "I was charged twice on my invoice"})
    assert r.status_code == 200
    body = r.json()
    assert body["predicted_category"] in VALID
    assert 0.0 <= body["confidence_score"] <= 1.0


@pytest.mark.parametrize("text", ["", "   "])
def test_predict_rejects_empty_text(client, text):
    assert client.post("/predict", json={"text": text}).status_code == 422


def test_predict_503_when_model_missing(monkeypatch):
    monkeypatch.setattr(predictor_module, "MODEL_PATH", "does/not/exist.pkl")
    with TestClient(app) as c:
        assert c.get("/health").json()["model_loaded"] is False
        assert c.post("/predict", json={"text": "hello"}).status_code == 503


def test_predict_batch_matches_single_predictions(client):
    if not MODEL.exists():
        pytest.skip("run training/train.py first")
    texts = ["I was charged twice on my invoice", "My package never arrived"]
    r = client.post("/predict/batch", json={"texts": texts})
    assert r.status_code == 200
    preds = r.json()["predictions"]
    assert len(preds) == 2
    for text, pred in zip(texts, preds):
        assert pred == client.post("/predict", json={"text": text}).json()


@pytest.mark.parametrize("texts", [[], ["ok", "  "]])
def test_predict_batch_rejects_bad_input(client, texts):
    assert client.post("/predict/batch", json={"texts": texts}).status_code == 422


def test_predict_batch_503_when_model_missing(monkeypatch):
    monkeypatch.setattr(predictor_module, "MODEL_PATH", "does/not/exist.pkl")
    with TestClient(app) as c:
        assert c.post("/predict/batch", json={"texts": ["hello"]}).status_code == 503
