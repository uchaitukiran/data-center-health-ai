"""
Unit and integration tests for Flask REST API endpoints.
"""

import pytest
import json
from src.api.app import create_app

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_health_endpoint(client):
    """Verify GET /api/health."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["status"] == "healthy"
    assert "champion_model" in data

def test_predict_endpoint(client):
    """Verify POST /api/predict accepts telemetry window and returns scoring structure."""
    dummy_window = [[0.5] * 38 for _ in range(60)]
    payload = {
        "machine_id": "machine-1-1",
        "rack_id": "RACK-01",
        "window": dummy_window
    }
    res = client.post("/api/predict", data=json.dumps(payload), content_type="application/json")
    assert res.status_code == 200
    data = json.loads(res.data)
    assert "prediction" in data
    assert "risk_score" in data["prediction"]
    assert 0.0 <= data["prediction"]["risk_score"] <= 100.0
