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

        # Compute training baseline scores to calibrate initial threshold
        train_scores = self.predict_score(X)
        self.threshold = float(np.percentile(train_scores, 98.0))
        self.metadata = {
            "n_estimators": self.n_estimators,
            "max_samples": self.max_samples,
            "contamination": self.contamination,
            "initial_threshold": self.threshold
        }
        logger.info(f"[IsolationForest] Fitted successfully. Baseline threshold: {self.threshold:.5f}")
        return self

    def predict_score(self, X: np.ndarray) -> np.ndarray:
        """
        Calculates normalized continuous anomaly score in range [0, 1].
        scikit-learn decision_function returns negative values for outliers,
        so score = -decision_function(X), then min-max normalized.
        """
        if not self.is_fitted or self.model is None:
            raise RuntimeError("IsolationForest model is not fitted yet.")

        # decision_function: lower is more anomalous
        raw_scores = -self.model.decision_function(X)
        # Shift and scale to [0, 1] approximately
        # Typical raw_scores range from -0.2 (normal) to 0.4+ (anomalies)
        norm_scores = (raw_scores - raw_scores.min()) / (raw_scores.max() - raw_scores.min() + 1e-8)
        return norm_scores
