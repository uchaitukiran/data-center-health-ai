"""
Real-time WebSocket Telemetry Streamer
Simulates live data center operational telemetry from SMD test streams,
performing continuous inference and broadcasting dynamic rack states to the 3D dashboard.
"""

import time
import json
import numpy as np
from typing import Dict, Any, List
from flask_sock import Sock

from config.config import RAW_DATA_DIR, SEQUENCE_WINDOW_SIZE
from config.logging_config import logger
from src.ml.model_registry import inference_engine
from src.llm.rca_engine import rca_engine
from src.database.db import record_telemetry, record_alert

# Server Rack Mapping in Data Center Floorplan
SERVER_RACKS = [
    {"rack_id": "RACK-01", "node_id": "machine-1-1", "name": "Compute Cluster Alpha"},
    {"rack_id": "RACK-02", "node_id": "machine-1-2", "name": "Compute Cluster Beta"},
    {"rack_id": "RACK-03", "node_id": "machine-2-1", "name": "Storage SAN Node 1"},
    {"rack_id": "RACK-04", "node_id": "machine-3-1", "name": "Database Primary Replica"},
    {"rack_id": "RACK-05", "node_id": "machine-1-1-sim", "name": "AI Inference Worker 01"},
    {"rack_id": "RACK-06", "node_id": "machine-1-2-sim", "name": "AI Inference Worker 02"},
    {"rack_id": "RACK-07", "node_id": "machine-2-1-sim", "name": "High-Speed Gateway 01"},
    {"rack_id": "RACK-08", "node_id": "machine-3-1-sim", "name": "High-Speed Gateway 02"},
]

# Sample loghub snippets for simulated alert triggers
SAMPLE_CRITICAL_LOGS = [
    "kernel: [ 2451.928103] EDAC MC0: 1 CE memory read error on CPU_SrcID#0_Ha#0_Chan#0_DIMM#0",
    "systemd-journald: [WARNING] IO latency exceeded 1250ms on device /dev/nvme0n1p2",
    "jvm-runtime: [SEVERE] java.lang.OutOfMemoryError: Java heap space during parallel GC evacuation pause"
]

class TelemetryStreamSimulator:
    """Manages playback of SMD real-world traces to stream realistic data center telemetry."""

    def __init__(self):
        self.stream_cache: Dict[str, np.ndarray] = {}
        self.pointers: Dict[str, int] = {}
        self._preload_traces()

    def _preload_traces(self):
        for server in SERVER_RACKS:
            base_node = server["node_id"].replace("-sim", "")
            test_path = RAW_DATA_DIR / "test" / f"{base_node}.txt"
            if test_path.exists() and base_node not in self.stream_cache:
                try:
                    data = np.loadtxt(test_path, delimiter=",")
                    self.stream_cache[base_node] = data
                    self.pointers[server["node_id"]] = 0
                    logger.info(f"[Simulator] Preloaded {len(data)} test frames for {base_node}")
                except Exception as e:
                    logger.warning(f"Failed to preload {base_node}: {e}")

    def get_next_frame(self) -> Dict[str, Any]:
        """Generates the next synchronized telemetry state for all racks."""
        rack_states = []
        critical_count = 0
        warning_count = 0
        healthy_count = 0
        total_risk = 0.0
        active_alert = None

        for idx, server in enumerate(SERVER_RACKS):
            node_id = server["node_id"]
            base_node = node_id.replace("-sim", "")
            rack_id = server["rack_id"]

            if base_node in self.stream_cache:
                data = self.stream_cache[base_node]
                # Stagger pointer per rack so anomalies happen dynamically
                ptr = (self.pointers.get(node_id, 0) + idx * 80) % (len(data) - SEQUENCE_WINDOW_SIZE)
                window = data[ptr : ptr + SEQUENCE_WINDOW_SIZE]
                self.pointers[node_id] = ptr + 1

                # Real-time score with champion model
                res = inference_engine.score_telemetry(window)
                risk = res["risk_score"]
                severity = res["severity"]
                anomalous_sensors = res["anomalous_sensors"]

                # Extract primary metrics
                curr = window[-1]
                cpu_util = float(np.clip(curr[0] * 100.0, 5.0, 99.0))
                mem_util = float(np.clip(curr[12] * 100.0, 10.0, 98.0))
                disk_io = float(np.clip(curr[19] * 50.0, 2.0, 450.0))
                temp_c = float(np.clip(28.0 + (risk / 100.0) * 45.0, 24.0, 85.0))
            else:
                # Synthetic healthy fallback
                risk = 12.0
                severity = "NORMAL"
                anomalous_sensors = []
                cpu_util, mem_util, disk_io, temp_c = 25.0, 40.0, 15.0, 28.5

            total_risk += risk

            if severity == "CRITICAL":
                critical_count += 1
                color = "#dc3545"  # Red
                if active_alert is None:
                    rca = rca_engine.analyze_incident(
                        machine_id=node_id,
                        risk_score=risk,
                        severity=severity,
                        anomalous_sensors=anomalous_sensors,
                        recent_log_snippets=SAMPLE_CRITICAL_LOGS
                    )
                    record_alert(node_id, rack_id, risk, severity, rca)
                    active_alert = {
                        "rack_id": rack_id,
                        "node_id": node_id,
                        "risk_score": risk,
                        "severity": severity,
                        "rca": rca
                    }
            elif severity == "WARNING":
                warning_count += 1
                color = "#fd7e14"  # Orange
            else:
                healthy_count += 1
                color = "#28a745"  # Green

            rack_states.append({
                "rack_id": rack_id,
                "node_id": node_id,
                "name": server["name"],
                "risk_score": risk,
                "severity": severity,
                "color": color,
                "cpu_util": round(cpu_util, 1),
                "mem_util": round(mem_util, 1),
                "disk_io": round(disk_io, 1),
                "temp_c": round(temp_c, 1),
                "anomalous_sensors": anomalous_sensors
            })

        avg_risk = round(total_risk / max(len(SERVER_RACKS), 1), 1)

        return {
            "timestamp": time.time(),
            "global_stats": {
                "total_racks": len(SERVER_RACKS),
                "healthy": healthy_count,
                "warning": warning_count,
                "critical": critical_count,
                "avg_risk": avg_risk,
                "champion_model": inference_engine.model.name if inference_engine.model else "Champion"
            },
            "racks": rack_states,
            "active_alert": active_alert
        }

simulator = TelemetryStreamSimulator()

def register_websocket(sock: Sock):
    """Registers WebSocket endpoint /ws/telemetry on the Flask app."""
    @sock.route("/ws/telemetry")
    def telemetry_socket(ws):
        logger.info("[WebSocket] New 3D dashboard client connected.")
        try:
            while True:
                frame = simulator.get_next_frame()
                ws.send(json.dumps(frame))
                time.sleep(1.2)  # Push every 1.2 seconds
        except Exception as e:
            logger.info(f"[WebSocket] Client disconnected: {e}")
