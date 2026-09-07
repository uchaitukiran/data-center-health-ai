"""
Database access and schema manager for Data Center Health AI.
Uses SQLite for robust zero-dependency persistence of real-time telemetry and incident alerts.
"""

import sqlite3
import json
import time
from pathlib import Path
from typing import List, Dict, Any, Optional

from config.config import DATA_DIR
from config.logging_config import logger

DB_FILE = DATA_DIR / "datacenter.db"

def get_connection() -> sqlite3.Connection:
    """Returns a SQLite connection with row factory enabled."""
    conn = sqlite3.connect(str(DB_FILE))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes tables for nodes, telemetry streams, and incident alert history."""
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Server Nodes Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS server_nodes (
            node_id TEXT PRIMARY KEY,
            rack_id TEXT NOT NULL,
            status TEXT DEFAULT 'NORMAL',
            current_risk_score REAL DEFAULT 0.0,
            last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 2. Telemetry History
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS telemetry_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            node_id TEXT NOT NULL,
            timestamp REAL NOT NULL,
            risk_score REAL NOT NULL,
            is_anomaly INTEGER NOT NULL,
            metrics_json TEXT NOT NULL
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_telemetry_node ON telemetry_history(node_id, timestamp)")

    # 3. Incident Alerts & Root Cause Analysis
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS incident_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            node_id TEXT NOT NULL,
            rack_id TEXT NOT NULL,
            timestamp REAL NOT NULL,
            risk_score REAL NOT NULL,
            severity TEXT NOT NULL,
            probable_culprit TEXT,
            root_cause_summary TEXT,
            recommended_action TEXT,
            acknowledged INTEGER DEFAULT 0
        )
    """)

    conn.commit()
    conn.close()
    logger.info(f"Initialized database schemas at {DB_FILE}")

def record_telemetry(node_id: str, risk_score: float, is_anomaly: bool, metrics: Dict[str, Any]):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO telemetry_history (node_id, timestamp, risk_score, is_anomaly, metrics_json)
        VALUES (?, ?, ?, ?, ?)
    """, (node_id, time.time(), risk_score, int(is_anomaly), json.dumps(metrics)))

    # Update node current status
    severity = "CRITICAL" if risk_score >= 70.0 else ("WARNING" if risk_score >= 40.0 else "NORMAL")
    cursor.execute("""
        UPDATE server_nodes SET current_risk_score = ?, status = ?, last_heartbeat = CURRENT_TIMESTAMP
        WHERE node_id = ?
    """, (risk_score, severity, node_id))
    conn.commit()
    conn.close()

def record_alert(
    node_id: str,
    rack_id: str,
    risk_score: float,
    severity: str,
    rca: Dict[str, Any]
) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO incident_alerts (
            node_id, rack_id, timestamp, risk_score, severity,
            probable_culprit, root_cause_summary, recommended_action
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        node_id, rack_id, time.time(), risk_score, severity,
        rca.get("probable_culprit", "Unknown"),
        rca.get("root_cause_summary", "Anomaly detected"),
        rca.get("recommended_action", "Investigate server")
    ))
    alert_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return alert_id

def get_recent_alerts(limit: int = 20) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM incident_alerts ORDER BY timestamp DESC LIMIT ?
    """, (limit,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def get_telemetry_history(node_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT timestamp, risk_score, is_anomaly, metrics_json
        FROM telemetry_history
        WHERE node_id = ?
        ORDER BY timestamp DESC LIMIT ?
    """, (node_id, limit))
    rows = []
    for r in cursor.fetchall():
        d = dict(r)
        d["metrics"] = json.loads(d.pop("metrics_json", "{}"))
        rows.append(d)
    conn.close()
    return rows[::-1]

# Bootstrap database on import
init_db()
