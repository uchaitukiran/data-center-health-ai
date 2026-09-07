"""
Robust Covariance / Elliptic Envelope Anomaly Detector
Statistical distribution-based detector assuming Gaussian distributed nominal telemetry.
Uses subspace projection to eliminate collinearity followed by FastMCD (Minimum Covariance Determinant).
"""

import numpy as np
from sklearn.covariance import EllipticEnvelope
from sklearn.decomposition import PCA
from typing import Optional, Dict, Any

from src.ml.base_model import BaseAnomalyModel
from config.config import RANDOM_STATE, CONTAMINATION_ESTIMATE
from config.logging_config import logger

class RobustCovarianceDetector(BaseAnomalyModel):
    """
    Robust Covariance (Elliptic Envelope) Estimator for continuous telemetry.
    Computes robust Mahalanobis distance in orthogonal subspace.
    """

    def __init__(
        self,
        contamination: float = CONTAMINATION_ESTIMATE,
        support_fraction: Optional[float] = 0.85,
        n_components: int = 12,
        random_state: int = RANDOM_STATE
    ):
        super().__init__(name="RobustCovariance")
        self.contamination = contamination
        self.support_fraction = support_fraction
        self.n_components = n_components
        self.random_state = random_state
        self.pca: Optional[PCA] = None
        self.model: Optional[EllipticEnvelope] = None
        self.score_min: float = 0.0
        self.score_max: float = 100.0

    def fit(self, X: np.ndarray, y: Optional[np.ndarray] = None) -> "RobustCovarianceDetector":
        n_comps = min(self.n_components, X.shape[1])
        logger.info(
            f"[RobustCovariance] Reducing dimensions to {n_comps} components and fitting FastMCD on {X.shape[0]} samples..."
        )
        self.pca = PCA(n_components=n_comps, random_state=self.random_state)
        X_sub = self.pca.fit_transform(X)

        # Fast subsample for FastMCD if dataset is very large (> 10k samples)
        if len(X_sub) > 10000:
            sample_idx = np.random.RandomState(self.random_state).choice(len(X_sub), size=8000, replace=False)
            X_fit = X_sub[sample_idx]
        else:
            X_fit = X_sub

        self.model = EllipticEnvelope(
            contamination=self.contamination,
            support_fraction=self.support_fraction,
            random_state=self.random_state
        )
        self.model.fit(X_fit)
        self.is_fitted = True

        raw_scores = self.model.mahalanobis(X_sub)
        self.score_min = float(np.percentile(raw_scores, 1.0))
        self.score_max = float(np.percentile(raw_scores, 99.0))
        denom = (self.score_max - self.score_min) if (self.score_max - self.score_min) > 1e-6 else 1.0

        train_norm_scores = np.clip((raw_scores - self.score_min) / denom, 0.0, 1.0)
        self.threshold = float(np.percentile(train_norm_scores, 98.0))
        self.metadata = {
            "contamination": self.contamination,
            "support_fraction": self.support_fraction,
            "n_components": n_comps,
            "score_min": self.score_min,
            "score_max": self.score_max,
            "initial_threshold": self.threshold
        }
        logger.info(f"[RobustCovariance] Fitted successfully. Threshold: {self.threshold:.5f}")
        return self

    def predict_score(self, X: np.ndarray) -> np.ndarray:
        if not self.is_fitted or self.model is None or self.pca is None:
            raise RuntimeError("RobustCovariance model is not fitted yet.")

        X_sub = self.pca.transform(X)
        raw_dist = self.model.mahalanobis(X_sub)
        score_min = getattr(self, "score_min", 0.0)
        score_max = getattr(self, "score_max", 100.0)
        denom = (score_max - score_min) if (score_max - score_min) > 1e-6 else 1.0
        norm_scores = np.clip((raw_dist - score_min) / denom, 0.0, 1.0)
        return norm_scores
