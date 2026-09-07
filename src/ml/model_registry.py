"""
Production Model Registry & Live Inference Engine
Loads the selected Champion Model and preprocessor to perform real-time scoring.
"""

import json
import time
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Optional
import joblib

from config.config import BEST_MODEL_DIR, SCALERS_DIR, SENSOR_METRIC_COUNT
from config.logging_config import logger
from src.ml.base_model import BaseAnomalyModel

# Standard Sensor Names for SMD (38 metrics: CPU, Memory, Disk, Network)
SMD_SENSOR_NAMES = [
    "CPU_Utilization_Pct", "CPU_User_Pct", "CPU_System_Pct", "CPU_Wait_IO_Pct",
    "CPU_SoftIRQ_Pct", "CPU_Interrupts_Sec", "Context_Switches_Sec", "Processes_Running",
    "Processes_Blocked", "Load_Average_1m", "Load_Average_5m", "Load_Average_15m",
    "Memory_Used_Pct", "Memory_Free_MB", "Memory_Cached_MB", "Memory_Buffers_MB",
    "Memory_Swap_Used_Pct", "Memory_Page_Faults_Sec", "Disk_Read_IOPS", "Disk_Write_IOPS",
    "Disk_Read_KB_Sec", "Disk_Write_KB_Sec", "Disk_Queue_Depth", "Disk_Await_Time_MS",
    "Disk_Space_Used_Pct", "Net_In_Packets_Sec", "Net_Out_Packets_Sec", "Net_In_KB_Sec",
    "Net_Out_KB_Sec", "Net_Drop_In_Sec", "Net_Drop_Out_Sec", "Net_TCP_Active_Opens",
    "Net_TCP_Passive_Opens", "Net_TCP_Retrans_Sec", "Net_TCP_Curr_Estab", "Temperature_Chassis_C",
    "Fan_Speed_RPM", "Power_Supply_Draw_Watts"
]

class ProductionInferenceEngine:
    """
    Production-grade inference engine using the selected Champion Model.
    """

    def __init__(self, machine_id: str = "machine-1-1"):
        self.machine_id = machine_id
        self.model: Optional[BaseAnomalyModel] = None
        self.scaler: Optional[Any] = None
        self.metadata: Dict[str, Any] = {}
        self.load_champion_artifacts()

    def load_champion_artifacts(self):
        """Loads champion model, scaler, and metadata from disk."""
        model_path = BEST_MODEL_DIR / "champion_model.pkl"
        scaler_path = SCALERS_DIR / f"scaler_{self.machine_id}.joblib"
        meta_path = BEST_MODEL_DIR / "model_metadata.json"

        if model_path.exists():
            self.model = joblib.load(model_path)
            logger.info(f"[InferenceEngine] Loaded champion model: {self.model.name}")
        else:
            logger.warning(f"[InferenceEngine] Champion model not found at {model_path}. Run trainer first.")

        if scaler_path.exists():
            self.scaler = joblib.load(scaler_path)
            logger.info(f"[InferenceEngine] Loaded feature scaler for {self.machine_id}")
        else:
            logger.warning(f"[InferenceEngine] Scaler not found at {scaler_path}")

        if meta_path.exists():
            with open(meta_path, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)

    def score_telemetry(self, raw_features_window: np.ndarray) -> Dict[str, Any]:
        """
        Scores a sliding window of sensor metrics (e.g. 60x38 or current sensor vector).
        
        Args:
            raw_features_window: 2D array of shape (window_size, 38) or 1D array of shape (38,)
            
        Returns:
            Dict containing risk_score (0-100), is_anomaly, severity, anomalous_sensors, latency.
        """
        if self.model is None:
            # Fallback if training not yet completed
            return {
                "risk_score": 15.0,
                "is_anomaly": False,
                "severity": "NORMAL",
                "anomalous_sensors": [],
                "latency_ms": 0.5,
                "model_name": "Uninitialized"
            }

        t0 = time.time()
        raw_arr = np.array(raw_features_window, dtype=np.float32)

        # Standardize features
        if self.scaler is not None:
            if raw_arr.ndim == 1:
                scaled_arr = self.scaler.transform(raw_arr.reshape(1, -1))[0]
            else:
                scaled_arr = self.scaler.transform(raw_arr)
        else:
            scaled_arr = raw_arr

        # Determine feature format for model
        if hasattr(self.model, "input_dim") and self.model.name == "LSTMAutoencoder":
            # Sequence model: ensure (1, seq_len, 38)
            if scaled_arr.ndim == 1:
                seq_input = np.repeat(scaled_arr.reshape(1, 1, -1), 60, axis=1)
            else:
                seq_input = scaled_arr.reshape(1, scaled_arr.shape[0], scaled_arr.shape[1])
            risk = float(self.model.calculate_risk_score(seq_input)[0])
            is_anomaly = bool(risk >= 50.0)
        else:
            # Tabular model: create summary feature vector (152,) or pad
            if scaled_arr.ndim == 2:
                current_val = scaled_arr[-1]
                mean_val = np.mean(scaled_arr, axis=0)
                std_val = np.std(scaled_arr, axis=0)
                spread_val = np.max(scaled_arr, axis=0) - np.min(scaled_arr, axis=0)
                tab_input = np.concatenate([current_val, mean_val, std_val, spread_val]).reshape(1, -1)
            else:
                # 1D single point fallback
                tab_input = np.concatenate([scaled_arr, scaled_arr, np.zeros_like(scaled_arr), np.zeros_like(scaled_arr)]).reshape(1, -1)

            risk = float(self.model.calculate_risk_score(tab_input)[0])
            is_anomaly = bool(risk >= 50.0)

        latency_ms = (time.time() - t0) * 1000.0

        # Severity categorization
        if risk >= 70.0:
            severity = "CRITICAL"
        elif risk >= 40.0:
            severity = "WARNING"
        else:
            severity = "NORMAL"

        # Identify top anomalous sensor deviations
        latest_vals = scaled_arr[-1] if scaled_arr.ndim == 2 else scaled_arr
        z_scores = np.abs(latest_vals)
        top_indices = np.argsort(z_scores)[::-1][:3]
        anomalous_sensors = [
            SMD_SENSOR_NAMES[idx] for idx in top_indices if idx < len(SMD_SENSOR_NAMES) and z_scores[idx] > 1.5
        ]

        return {
            "risk_score": round(risk, 1),
            "is_anomaly": is_anomaly,
            "severity": severity,
            "anomalous_sensors": anomalous_sensors,
            "latency_ms": round(latency_ms, 2),
            "model_name": self.model.name,
            "timestamp": time.time()
        }

# Global singleton
inference_engine = ProductionInferenceEngine()
