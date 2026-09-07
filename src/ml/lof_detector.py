"""
Local Outlier Factor (LOF) Detector
Density-based anomaly detector measuring local density deviation relative to k-nearest neighbors.
Configured for Novelty Detection (scoring unseen production telemetry).
"""

import numpy as np
from sklearn.neighbors import LocalOutlierFactor
from typing import Optional, Dict, Any

from src.ml.base_model import BaseAnomalyModel
from config.config import CONTAMINATION_ESTIMATE
from config.logging_config import logger

class LOFDetector(BaseAnomalyModel):
    """
    Novelty Detection wrapper for Local Outlier Factor with density score scaling.
    """

    def __init__(
        self,
        n_neighbors: int = 35,
        contamination: float = CONTAMINATION_ESTIMATE
    ):
        super().__init__(name="LocalOutlierFactor")
        self.n_neighbors = n_neighbors
        self.contamination = contamination
        self.model: Optional[LocalOutlierFactor] = None

    def fit(self, X: np.ndarray, y: Optional[np.ndarray] = None) -> "LOFDetector":
        # Subsample if large for memory safety in k-d tree
        if len(X) > 12000:
            indices = np.random.RandomState(42).choice(len(X), size=12000, replace=False)
            X_sub = X[indices]
        else:
            X_sub = X

        logger.info(f"[LOF] Training novelty detector with k={self.n_neighbors} on {len(X_sub)} samples...")
        self.model = LocalOutlierFactor(
            n_neighbors=self.n_neighbors,
            contamination=self.contamination,
            novelty=True,
            n_jobs=-1
        )
        self.model.fit(X_sub)
        self.is_fitted = True

        train_scores = self.predict_score(X_sub)
        self.threshold = float(np.percentile(train_scores, 98.0))
        self.metadata = {
            "n_neighbors": self.n_neighbors,
            "contamination": self.contamination,
            "initial_threshold": self.threshold
        }
        logger.info(f"[LOF] Fitted successfully. Baseline threshold: {self.threshold:.5f}")
        return self

    def predict_score(self, X: np.ndarray) -> np.ndarray:
        if not self.is_fitted or self.model is None:
            raise RuntimeError("LOF model is not fitted yet.")

        # decision_function: large negative values correspond to outliers
        raw_scores = -self.model.decision_function(X)
        norm_scores = (raw_scores - raw_scores.min()) / (raw_scores.max() - raw_scores.min() + 1e-8)
        return norm_scores
