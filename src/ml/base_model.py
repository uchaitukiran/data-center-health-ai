"""
Abstract Base Class for AIOps Anomaly Detectors
Enforces unified API contract across classical ML, density estimators, and deep learning models.
"""

from abc import ABC, abstractmethod
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional
import joblib

from config.logging_config import logger

class BaseAnomalyModel(ABC):
    """
    Standardized contract for all candidate anomaly detection models in Data Center Health AI.
    """

    def __init__(self, name: str, threshold: float = 0.5):
        self.name = name
        self.threshold = threshold
        self.is_fitted = False
        self.metadata: Dict[str, Any] = {}

    @abstractmethod
    def fit(self, X: np.ndarray, y: Optional[np.ndarray] = None) -> "BaseAnomalyModel":
        """Trains the model on normal telemetry data."""
        pass

    @abstractmethod
    def predict_score(self, X: np.ndarray) -> np.ndarray:
        """
        Computes continuous anomaly/reconstruction score for each sample.
        Higher score = higher probability of anomaly / risk.
        Normalized roughly to [0, 1] range for unified risk scoring.
        """
        pass

    def predict(self, X: np.ndarray) -> np.ndarray:
        """
        Outputs binary labels (0 = Normal, 1 = Anomaly) based on calibrated decision threshold.
        """
        scores = self.predict_score(X)
        return (scores >= self.threshold).astype(int)

    def tune_threshold(self, X_val: np.ndarray, percentile: float = 98.0) -> float:
        """
        Calibrates decision threshold dynamically on validation split
        based on target operational percentile (e.g. 98th or 99th percentile of normal errors).
        """
        val_scores = self.predict_score(X_val)
        self.threshold = float(np.percentile(val_scores, percentile))
        logger.info(f"[{self.name}] Calibrated threshold at {percentile}th percentile: {self.threshold:.6f}")
        return self.threshold

    def calculate_risk_score(self, X: np.ndarray) -> np.ndarray:
        """
        Converts continuous anomaly scores to a 0-100 Operations Risk Score.
        0-39: Normal (Green)
        40-69: Warning (Orange)
        70-100: Critical (Red)
        """
        raw_scores = self.predict_score(X)
        # Scaled relative to threshold: threshold maps to ~60 risk
        if self.threshold <= 0:
            risk = np.clip(raw_scores * 100.0, 0.0, 100.0)
        else:
            ratio = raw_scores / (self.threshold + 1e-8)
            # Sigmoidal smooth mapping centering threshold at 60
            risk = 100.0 / (1.0 + np.exp(-3.0 * (ratio - 1.0)))
        return np.round(risk, 2)

    def save(self, file_path: Path):
        """Serializes model instance, parameters, and metadata to .pkl file."""
        file_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, file_path)
        logger.info(f"[{self.name}] Serialized model artifact saved to {file_path}")

    @classmethod
    def load(cls, file_path: Path) -> "BaseAnomalyModel":
        """Loads serialized model artifact from disk."""
        if not file_path.exists():
            raise FileNotFoundError(f"Model artifact not found at {file_path}")
        model = joblib.load(file_path)
        logger.info(f"[{model.name}] Successfully loaded from {file_path}")
        return model
