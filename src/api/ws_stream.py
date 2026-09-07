"""
Real-time WebSocket Telemetry Streamer with Interactive AIOps Simulation
Simulates live data center operational telemetry from SMD test streams,
performing continuous inference, supporting interactive failure injection/auto-remediation,
and broadcasting dynamic rack states to the 3D dashboard.
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
    {"rack_id": "RACK-01", "node_id": "machine-1-1", "name": "Compute Cluster Alpha", "aisle": "Aisle 1", "u_height": "42U"},
    {"rack_id": "RACK-02", "node_id": "machine-1-2", "name": "Compute Cluster Beta", "aisle": "Aisle 1", "u_height": "42U"},
    {"rack_id": "RACK-03", "node_id": "machine-2-1", "name": "Storage SAN Node 1", "aisle": "Aisle 1", "u_height": "42U"},
    {"rack_id": "RACK-04", "node_id": "machine-3-1", "name": "Database Primary Replica", "aisle": "Aisle 1", "u_height": "42U"},
    {"rack_id": "RACK-05", "node_id": "machine-1-1-sim", "name": "AI Inference Worker 01", "aisle": "Aisle 2", "u_height": "42U"},
    {"rack_id": "RACK-06", "node_id": "machine-1-2-sim", "name": "AI Inference Worker 02", "aisle": "Aisle 2", "u_height": "42U"},
    {"rack_id": "RACK-07", "node_id": "machine-2-1-sim", "name": "High-Speed Gateway 01", "aisle": "Aisle 2", "u_height": "42U"},
    {"rack_id": "RACK-08", "node_id": "machine-3-1-sim", "name": "High-Speed Gateway 02", "aisle": "Aisle 2", "u_height": "42U"},
]

SAMPLE_CRITICAL_LOGS = {
    "memory": [
        "jvm-runtime: [SEVERE] java.lang.OutOfMemoryError: Java heap space during parallel GC evacuation pause",
        "kernel: [oom-killer] Out of memory: Kill process 19284 (mysqld) score 852 or sacrifice child",
        "systemd[1]: worker-pool.service: Main process exited, code=killed, status=9/KILL"
    ],
    "disk": [
        "kernel: [ 2451.928103] nvme0n1: I/O command timeout, reset controller",
        "systemd-journald: [WARNING] IO latency exceeded 1850ms on device /dev/nvme0n1p2",
        "smartd[822]: Device: /dev/nvme0n1, 14 currently unreadable (pending) sectors"
    ],
    "cpu": [
        "kernel: [ 1042.881200] watchdog: BUG: soft lockup - CPU#4 stuck for 26s! [kworker/u16:2:4812]",
        "thermald[612]: Critical temperature reached on CPU Core 0: 92C, throttling engaged",
        "syslog: CPU throttle duration exceeded 4500ms in last 10s reporting window"
    ]
}

class TelemetryStreamSimulator:
    """Manages playback of SMD real-world traces to stream realistic data center telemetry."""

    def __init__(self):
        self.stream_cache: Dict[str, np.ndarray] = {}
        self.pointers: Dict[str, int] = {}
        self.injected_anomalies: Dict[str, Dict[str, Any]] = {}
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

    def inject_simulation(self, rack_id: str, anomaly_type: str):
        """Manually injects an operational failure into a specific rack for demo triage."""
        logger.info(f"[Simulator] Injecting failure '{anomaly_type}' into {rack_id}")
        self.injected_anomalies[rack_id] = {
            "type": anomaly_type,
            "injected_at": time.time(),
            "active": True
        }

    def remediate_rack(self, rack_id: str):
        """Clears simulated anomalies and restores rack to nominal baseline."""
        logger.info(f"[Simulator] Remediating rack {rack_id}")
        if rack_id in self.injected_anomalies:
            del self.injected_anomalies[rack_id]

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

            # Check if this rack has an active simulated anomaly
            sim_anomaly = self.injected_anomalies.get(rack_id)

            if base_node in self.stream_cache:
                data = self.stream_cache[base_node]
                ptr = (self.pointers.get(node_id, 0) + idx * 80) % (len(data) - SEQUENCE_WINDOW_SIZE)
                window = np.copy(data[ptr : ptr + SEQUENCE_WINDOW_SIZE])
                self.pointers[node_id] = ptr + 1

                # Apply synthetic anomaly injection if triggered
                if sim_anomaly and sim_anomaly.get("active"):
                    atype = sim_anomaly.get("type", "memory")
                    if atype == "memory":
                        window[-1, 12] = 0.96  # High memory used
                        window[-1, 17] = 450.0 # High page faults
                    elif atype == "disk":
                        window[-1, 19] = 850.0 # Extreme write IOPS
                        window[-1, 23] = 95.0  # High await time
                    elif atype == "cpu":
                        window[-1, 0] = 0.98   # 98% CPU util
                        window[-1, 35] = 88.0  # High temp

                res = inference_engine.score_telemetry(window)
                risk = res["risk_score"]
                severity = res["severity"]
                anomalous_sensors = res["anomalous_sensors"]

                # Overwrite risk if simulated
                if sim_anomaly:
                    risk = 88.5 if sim_anomaly["type"] != "memory" else 68.0
                    severity = "CRITICAL" if risk >= 70.0 else "WARNING"
                    anomalous_sensors = ["Memory_Used_Pct", "Memory_Page_Faults_Sec"] if sim_anomaly["type"] == "memory" else ["Disk_Write_IOPS", "Disk_Await_Time_MS"]

                curr = window[-1]
                cpu_util = float(np.clip(curr[0] * 100.0, 8.0, 99.0))
                mem_util = float(np.clip(curr[12] * 100.0, 15.0, 98.0))
                disk_io = float(np.clip(curr[19] * 50.0, 5.0, 850.0))
                temp_c = float(np.clip(28.0 + (risk / 100.0) * 45.0, 24.0, 88.0))
            else:
                risk = 12.0
                severity = "NORMAL"
                anomalous_sensors = []
                cpu_util, mem_util, disk_io, temp_c = 25.0, 40.0, 15.0, 28.5

            total_risk += risk

            if severity == "CRITICAL":
                critical_count += 1
                color = "#ff385c"  # Crimson Neon
                log_category = sim_anomaly.get("type", "memory") if sim_anomaly else "disk"
                logs = SAMPLE_CRITICAL_LOGS.get(log_category, SAMPLE_CRITICAL_LOGS["memory"])
                
                if active_alert is None:
                    rca = rca_engine.analyze_incident(
                        machine_id=node_id,
                        risk_score=risk,
                        severity=severity,
                        anomalous_sensors=anomalous_sensors,
                        recent_log_snippets=logs
                    )
                    record_alert(node_id, rack_id, risk, severity, rca)
                    active_alert = {
                        "rack_id": rack_id,
                        "node_id": node_id,
                        "name": server["name"],
                        "risk_score": risk,
                        "severity": severity,
                        "rca": rca
                    }
            elif severity == "WARNING":
                warning_count += 1
                color = "#ffb700"  # Cyber Amber
            else:
                healthy_count += 1
                color = "#00ff88"  # Emerald Neon

            rack_states.append({
                "rack_id": rack_id,
                "node_id": node_id,
                "name": server["name"],
                "aisle": server["aisle"],
                "u_height": server["u_height"],
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
                "pue": 1.18, # Power Usage Effectiveness (MNC Datacenter Standard)
                "total_power_kw": round(32.4 + (avg_risk / 100.0) * 14.2, 1),
                "champion_model": inference_engine.model.name if inference_engine.model else "IsolationForest"
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
                time.sleep(1.0)  # Smooth 1 Hz telemetry refresh
        except Exception as e:
            logger.info(f"[WebSocket] Client disconnected: {e}")
