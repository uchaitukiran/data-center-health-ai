"""
Isolation Forest Anomaly Detector
Ensemble tree-based partitioner isolating anomalous data points via path lengths.
"""

import numpy as np
from sklearn.ensemble import IsolationForest
from typing import Optional, Dict, Any

from src.ml.base_model import BaseAnomalyModel
from config.config import RANDOM_STATE, CONTAMINATION_ESTIMATE
from config.logging_config import logger

class IsolationForestDetector(BaseAnomalyModel):
    """
    Production-ready Isolation Forest with score normalization and threshold tuning.
    """

    def __init__(
        self,
        n_estimators: int = 150,
        max_samples: float = 0.8,
        contamination: float = CONTAMINATION_ESTIMATE,
        random_state: int = RANDOM_STATE
    ):
        super().__init__(name="IsolationForest")
        self.n_estimators = n_estimators
        self.max_samples = max_samples
        self.contamination = contamination
        self.random_state = random_state
        self.model: Optional[IsolationForest] = None
        self.score_min: float = -0.3
        self.score_max: float = 0.5

    def fit(self, X: np.ndarray, y: Optional[np.ndarray] = None) -> "IsolationForestDetector":
        logger.info(
            f"[IsolationForest] Training on {X.shape[0]} samples (features={X.shape[1]})..."
        )
        self.model = IsolationForest(
            n_estimators=self.n_estimators,
            max_samples=self.max_samples,
            contamination=self.contamination,
            random_state=self.random_state,
            n_jobs=-1
        )
        self.model.fit(X)
        self.is_fitted = True

        raw_train = -self.model.decision_function(X)
        self.score_min = float(raw_train.min())
        self.score_max = float(raw_train.max())

        # Compute training baseline scores to calibrate initial threshold
        train_scores = self.predict_score(X)
        self.threshold = float(np.percentile(train_scores, 98.0))
        self.metadata = {
            "n_estimators": self.n_estimators,
            "max_samples": self.max_samples,
            "contamination": self.contamination,
            "initial_threshold": self.threshold,
            "score_min": self.score_min,
            "score_max": self.score_max
        }
        logger.info(f"[IsolationForest] Fitted successfully. Baseline threshold: {self.threshold:.5f}")
        return self

    def predict_score(self, X: np.ndarray) -> np.ndarray:
        """
        Calculates normalized continuous anomaly score in range [0, 1].
        scikit-learn decision_function returns negative values for outliers,
        so score = -decision_function(X), calibrated against baseline distribution.
        """
        if not self.is_fitted or self.model is None:
            raise RuntimeError("IsolationForest model is not fitted yet.")

        # decision_function: lower is more anomalous
        raw_scores = -self.model.decision_function(X)
        score_min = getattr(self, "score_min", -0.3)
        score_max = getattr(self, "score_max", 0.5)
        denom = (score_max - score_min) if (score_max - score_min) > 1e-6 else 1.0
        norm_scores = np.clip((raw_scores - score_min) / denom, 0.0, 1.0)
        return norm_scores

