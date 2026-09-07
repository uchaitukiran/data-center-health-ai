"""
Database access and schema manager for Data Center Health AI.
Supports dual-engine architecture:
- PostgreSQL (Production / TimescaleDB enterprise data center deployments via DATABASE_URL)
- SQLite (Transparent zero-dependency fallback at data/datacenter.db for local runtime)
"""

import os
import json
import time
import sqlite3
from pathlib import Path
from typing import List, Dict, Any, Optional

from config.config import DATA_DIR
from config.logging_config import logger

DB_FILE = DATA_DIR / "datacenter.db"
DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")

# Determine active backend
IS_POSTGRES = False
ENGINE = None

if DATABASE_URL and (DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgres://")):
    try:
        from sqlalchemy import create_engine, text
        # Normalise postgres:// scheme for SQLAlchemy 2.0+
        clean_url = DATABASE_URL
        if clean_url.startswith("postgres://"):
            clean_url = clean_url.replace("postgres://", "postgresql://", 1)
        ENGINE = create_engine(clean_url, pool_pre_ping=True, pool_size=5)
        # Test connection
        with ENGINE.connect() as conn:
            conn.execute(text("SELECT 1"))
        IS_POSTGRES = True
        logger.info(f"Connected to enterprise PostgreSQL database: {clean_url.split('@')[-1]}")
    except Exception as e:
        logger.warning(f"Failed connecting to PostgreSQL ({e}); falling back to local SQLite at {DB_FILE}")
        IS_POSTGRES = False
        ENGINE = None

def get_connection():
    """Returns an active SQLite connection with row factory enabled."""
    conn = sqlite3.connect(str(DB_FILE))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes tables for nodes, telemetry streams, incident alerts, and model benchmarks."""
    if IS_POSTGRES and ENGINE is not None:
        _init_postgres()
    else:
        _init_sqlite()

def _init_sqlite():
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

    # 4. Model Benchmark Audit Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS model_benchmark_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_name TEXT NOT NULL,
            machine_id TEXT NOT NULL,
            timestamp REAL NOT NULL,
            pa_f1_score REAL NOT NULL,
            f1_score REAL NOT NULL,
            precision REAL NOT NULL,
            recall REAL NOT NULL,
            pr_auc REAL NOT NULL,
            false_alarm_rate REAL NOT NULL,
            latency_ms REAL NOT NULL,
            is_champion INTEGER NOT NULL,
            hyperparameters_json TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()
    logger.info(f"Initialized SQLite database schemas at {DB_FILE}")

def _init_postgres():
    from sqlalchemy import text
    with ENGINE.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS server_nodes (
                node_id VARCHAR(64) PRIMARY KEY,
                rack_id VARCHAR(64) NOT NULL,
                status VARCHAR(32) DEFAULT 'NORMAL',
                current_risk_score DOUBLE PRECISION DEFAULT 0.0,
                last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS telemetry_history (
                id SERIAL PRIMARY KEY,
                node_id VARCHAR(64) NOT NULL,
                timestamp DOUBLE PRECISION NOT NULL,
                risk_score DOUBLE PRECISION NOT NULL,
                is_anomaly INTEGER NOT NULL,
                metrics_json TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_pg_telemetry_node ON telemetry_history(node_id, timestamp);
            CREATE TABLE IF NOT EXISTS incident_alerts (
                id SERIAL PRIMARY KEY,
                node_id VARCHAR(64) NOT NULL,
                rack_id VARCHAR(64) NOT NULL,
                timestamp DOUBLE PRECISION NOT NULL,
                risk_score DOUBLE PRECISION NOT NULL,
                severity VARCHAR(32) NOT NULL,
                probable_culprit TEXT,
                root_cause_summary TEXT,
                recommended_action TEXT,
                acknowledged INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS model_benchmark_audit (
                id SERIAL PRIMARY KEY,
                model_name VARCHAR(64) NOT NULL,
                machine_id VARCHAR(64) NOT NULL,
                timestamp DOUBLE PRECISION NOT NULL,
                pa_f1_score DOUBLE PRECISION NOT NULL,
                f1_score DOUBLE PRECISION NOT NULL,
                precision DOUBLE PRECISION NOT NULL,
                recall DOUBLE PRECISION NOT NULL,
                pr_auc DOUBLE PRECISION NOT NULL,
                false_alarm_rate DOUBLE PRECISION NOT NULL,
                latency_ms DOUBLE PRECISION NOT NULL,
                is_champion INTEGER NOT NULL,
                hyperparameters_json TEXT NOT NULL
            );
        """))
        conn.commit()
    logger.info("Initialized PostgreSQL production tables and indices.")

def record_telemetry(node_id: str, risk_score: float, is_anomaly: bool, metrics: Dict[str, Any]):
    """Records a live telemetry sample into the active database."""
    t_now = time.time()
    metrics_str = json.dumps(metrics)
    severity = "CRITICAL" if risk_score >= 70.0 else ("WARNING" if risk_score >= 40.0 else "NORMAL")

    if IS_POSTGRES and ENGINE is not None:
        from sqlalchemy import text
        with ENGINE.connect() as conn:
            conn.execute(text("""
                INSERT INTO telemetry_history (node_id, timestamp, risk_score, is_anomaly, metrics_json)
                VALUES (:node_id, :timestamp, :risk_score, :is_anomaly, :metrics_json)
            """), {
                "node_id": node_id, "timestamp": t_now, "risk_score": risk_score,
                "is_anomaly": int(is_anomaly), "metrics_json": metrics_str
            })
            conn.execute(text("""
                INSERT INTO server_nodes (node_id, rack_id, status, current_risk_score, last_heartbeat)
                VALUES (:node_id, 'RACK-01', :status, :risk_score, CURRENT_TIMESTAMP)
                ON CONFLICT (node_id) DO UPDATE SET
                    current_risk_score = EXCLUDED.current_risk_score,
                    status = EXCLUDED.status,
                    last_heartbeat = CURRENT_TIMESTAMP
            """), {"node_id": node_id, "status": severity, "risk_score": risk_score})
            conn.commit()
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO telemetry_history (node_id, timestamp, risk_score, is_anomaly, metrics_json)
            VALUES (?, ?, ?, ?, ?)
        """, (node_id, t_now, risk_score, int(is_anomaly), metrics_str))
        cursor.execute("""
            INSERT INTO server_nodes (node_id, rack_id, status, current_risk_score, last_heartbeat)
            VALUES (?, 'RACK-01', ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(node_id) DO UPDATE SET
                current_risk_score = excluded.current_risk_score,
                status = excluded.status,
                last_heartbeat = CURRENT_TIMESTAMP
        """, (node_id, severity, risk_score))
        conn.commit()
        conn.close()

def record_alert(
    node_id: str,
    rack_id: str,
    risk_score: float,
    severity: str,
    rca: Dict[str, Any]
) -> int:
    """Records an incident triage alert in the database."""
    t_now = time.time()
    culprit = rca.get("probable_culprit", "Unknown")
    summary = rca.get("root_cause_summary", "Anomaly detected")
    action = rca.get("recommended_action", "Investigate server")

    if IS_POSTGRES and ENGINE is not None:
        from sqlalchemy import text
        with ENGINE.connect() as conn:
            res = conn.execute(text("""
                INSERT INTO incident_alerts (
                    node_id, rack_id, timestamp, risk_score, severity,
                    probable_culprit, root_cause_summary, recommended_action
                )
                VALUES (:node_id, :rack_id, :timestamp, :risk_score, :severity, :culprit, :summary, :action)
                RETURNING id
            """), {
                "node_id": node_id, "rack_id": rack_id, "timestamp": t_now,
                "risk_score": risk_score, "severity": severity,
                "culprit": culprit, "summary": summary, "action": action
            })
            alert_id = res.scalar()
            conn.commit()
            return int(alert_id)
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO incident_alerts (
                node_id, rack_id, timestamp, risk_score, severity,
                probable_culprit, root_cause_summary, recommended_action
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (node_id, rack_id, t_now, risk_score, severity, culprit, summary, action))
        alert_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return alert_id

def record_benchmark_run(
    model_name: str,
    machine_id: str,
    metrics: Dict[str, Any],
    is_champion: bool,
    hyperparameters: Dict[str, Any]
):
    """Persists model benchmark evaluation runs to audit history."""
    t_now = time.time()
    hp_json = json.dumps(hyperparameters)

    if IS_POSTGRES and ENGINE is not None:
        from sqlalchemy import text
        with ENGINE.connect() as conn:
            conn.execute(text("""
                INSERT INTO model_benchmark_audit (
                    model_name, machine_id, timestamp, pa_f1_score, f1_score,
                    precision, recall, pr_auc, false_alarm_rate, latency_ms,
                    is_champion, hyperparameters_json
                ) VALUES (
                    :model_name, :machine_id, :timestamp, :pa_f1, :f1,
                    :precision, :recall, :pr_auc, :far, :latency_ms,
                    :is_champion, :hp_json
                )
            """), {
                "model_name": model_name, "machine_id": machine_id, "timestamp": t_now,
                "pa_f1": metrics.get("pa_f1_score", 0.0),
                "f1": metrics.get("f1_score", 0.0),
                "precision": metrics.get("precision", 0.0),
                "recall": metrics.get("recall", 0.0),
                "pr_auc": metrics.get("pr_auc", 0.0),
                "far": metrics.get("false_alarm_rate", 0.0),
                "latency_ms": metrics.get("latency_ms", 0.0),
                "is_champion": int(is_champion),
                "hp_json": hp_json
            })
            conn.commit()
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO model_benchmark_audit (
                model_name, machine_id, timestamp, pa_f1_score, f1_score,
                precision, recall, pr_auc, false_alarm_rate, latency_ms,
                is_champion, hyperparameters_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            model_name, machine_id, t_now,
            metrics.get("pa_f1_score", 0.0),
            metrics.get("f1_score", 0.0),
            metrics.get("precision", 0.0),
            metrics.get("recall", 0.0),
            metrics.get("pr_auc", 0.0),
            metrics.get("false_alarm_rate", 0.0),
            metrics.get("latency_ms", 0.0),
            int(is_champion),
            hp_json
        ))
        conn.commit()
        conn.close()

def get_recent_alerts(limit: int = 20) -> List[Dict[str, Any]]:
    if IS_POSTGRES and ENGINE is not None:
        from sqlalchemy import text
        with ENGINE.connect() as conn:
            result = conn.execute(text("SELECT * FROM incident_alerts ORDER BY timestamp DESC LIMIT :limit"), {"limit": limit})
            return [dict(r._mapping) for r in result]
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM incident_alerts ORDER BY timestamp DESC LIMIT ?", (limit,))
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return rows

def get_telemetry_history(node_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    if IS_POSTGRES and ENGINE is not None:
        from sqlalchemy import text
        with ENGINE.connect() as conn:
            result = conn.execute(text("""
                SELECT timestamp, risk_score, is_anomaly, metrics_json
                FROM telemetry_history
                WHERE node_id = :node_id
                ORDER BY timestamp DESC LIMIT :limit
            """), {"node_id": node_id, "limit": limit})
            rows = []
            for r in result:
                d = dict(r._mapping)
                d["metrics"] = json.loads(d.pop("metrics_json", "{}"))
                rows.append(d)
            return rows[::-1]
    else:
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
