"""
Flask REST API Endpoints for Data Center Health AI
Exposes prediction, telemetry ingestion, incident management, and benchmark reporting.
"""

from flask import Blueprint, jsonify, request
import json
import pandas as pd
from pathlib import Path

from config.config import REPORTS_DIR, BEST_MODEL_DIR, DEFAULT_MACHINES
from config.logging_config import logger
from src.ml.model_registry import inference_engine
from src.llm.rca_engine import rca_engine
from src.database.db import get_recent_alerts, get_telemetry_history, record_alert, record_telemetry

api_bp = Blueprint("api", __name__, url_prefix="/api")

@api_bp.route("/health", methods=["GET"])
def health_check():
    """System health check and runtime status."""
    return jsonify({
        "status": "healthy",
        "service": "Data Center Health AI",
        "champion_model": inference_engine.model.name if inference_engine.model else "Uninitialized",
        "monitored_machines": DEFAULT_MACHINES
    })

@api_bp.route("/models", methods=["GET"])
def get_candidate_models():
    """Returns candidate models comparison table."""
    csv_path = REPORTS_DIR / "model_comparison_table.csv"
    if csv_path.exists():
        df = pd.read_csv(csv_path)
        return jsonify({"models": df.to_dict(orient="records")})
    return jsonify({"models": [], "message": "Benchmark not run yet."})

@api_bp.route("/models/champion", methods=["GET"])
def get_champion_model():
    """Returns current champion model metadata."""
    meta_path = BEST_MODEL_DIR / "model_metadata.json"
    if meta_path.exists():
        with open(meta_path, "r", encoding="utf-8") as f:
            return jsonify(json.load(f))
    return jsonify({"message": "No champion model selected yet."}), 404

@api_bp.route("/report", methods=["GET"])
def get_model_selection_report():
    """Returns the full technical model comparison and selection report."""
    report_path = Path("docs") / "MODEL_COMPARISON_AND_SELECTION.md"
    if report_path.exists():
        with open(report_path, "r", encoding="utf-8") as f:
            content = f.read()
        return jsonify({"report_markdown": content})
    return jsonify({"message": "Report not generated yet."}), 404

@api_bp.route("/predict", methods=["POST"])
def predict():
    """
    Evaluates real-time telemetry array and returns risk score + RCA if anomalous.
    Payload:
      {
        "machine_id": "machine-1-1",
        "rack_id": "RACK-01",
        "window": [[... 38 sensors ...]],
        "recent_logs": ["Optional error string"]
      }
    """
    data = request.get_json(force=True)
    machine_id = data.get("machine_id", "machine-1-1")
    rack_id = data.get("rack_id", "RACK-01")
    window = data.get("window", [])
    recent_logs = data.get("recent_logs", [])

    if not window:
        return jsonify({"error": "Missing 'window' telemetry array."}), 400

    # Score with Champion Model
    score_res = inference_engine.score_telemetry(window)
    risk_score = score_res["risk_score"]
    severity = score_res["severity"]
    anomalous_sensors = score_res["anomalous_sensors"]

    # Record telemetry in database
    record_telemetry(machine_id, risk_score, score_res["is_anomaly"], {"sensors": anomalous_sensors})

    rca_diagnosis = None
    alert_id = None
    # If warning or critical, trigger GenAI Root Cause Analysis
    if severity in ["WARNING", "CRITICAL"]:
        rca_diagnosis = rca_engine.analyze_incident(
            machine_id=machine_id,
            risk_score=risk_score,
            severity=severity,
            anomalous_sensors=anomalous_sensors,
            recent_log_snippets=recent_logs
        )
        alert_id = record_alert(machine_id, rack_id, risk_score, severity, rca_diagnosis)

    return jsonify({
        "machine_id": machine_id,
        "rack_id": rack_id,
        "prediction": score_res,
        "rca_diagnosis": rca_diagnosis,
        "alert_id": alert_id
    })

@api_bp.route("/alerts", methods=["GET"])
def get_alerts():
    """Fetches recent incident alerts."""
    limit = request.args.get("limit", 20, type=int)
    alerts = get_recent_alerts(limit=limit)
    return jsonify({"alerts": alerts})

@api_bp.route("/telemetry/<node_id>", methods=["GET"])
def get_node_telemetry(node_id: str):
    """Fetches historical time-series points for a specific server node."""
    limit = request.args.get("limit", 50, type=int)
    history = get_telemetry_history(node_id, limit=limit)
    return jsonify({"node_id": node_id, "history": history})

@api_bp.route("/simulate/anomaly", methods=["POST"])
def simulate_anomaly():
    """Triggers simulated failure on a rack for live triage demonstration."""
    from src.api.ws_stream import simulator
    data = request.get_json(force=True) or {}
    rack_id = data.get("rack_id", "R-09")
    anomaly_type = data.get("type", "memory")
    simulator.inject_simulation(rack_id, anomaly_type)
    return jsonify({"status": "injected", "rack_id": rack_id, "type": anomaly_type})

@api_bp.route("/simulate/remediate", methods=["POST"])
def simulate_remediate():
    """Remediates simulated anomaly and restores rack to normal health."""
    from src.api.ws_stream import simulator
    data = request.get_json(force=True) or {}
    rack_id = data.get("rack_id", "R-09")
    simulator.remediate_rack(rack_id)
    return jsonify({"status": "remediated", "rack_id": rack_id})
