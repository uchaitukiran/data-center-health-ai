"""
PCA Reconstruction Anomaly Detector
Linear subspace projection model measuring reconstruction error across correlated sensors.
"""

import numpy as np
from sklearn.decomposition import PCA
from typing import Optional, Dict, Any

from src.ml.base_model import BaseAnomalyModel
from config.logging_config import logger

class PCADetector(BaseAnomalyModel):
    """
    Subspace baseline measuring Mahalanobis / Euclidean reconstruction residuals.
    """

    def __init__(self, n_components: float = 0.95):
        super().__init__(name="PCADetector")
        self.n_components = n_components
        self.pca: Optional[PCA] = None

    def fit(self, X: np.ndarray, y: Optional[np.ndarray] = None) -> "PCADetector":
        logger.info(f"[PCA] Fitting PCA explaining {self.n_components*100}% variance on {len(X)} samples...")
        self.pca = PCA(n_components=self.n_components, random_state=42)
        self.pca.fit(X)
        self.is_fitted = True

        logger.info(f"[PCA] Retained {self.pca.n_components_} principal components out of {X.shape[1]} features.")

        train_scores = self.predict_score(X)
        self.threshold = float(np.percentile(train_scores, 98.0))
        self.metadata = {
            "n_components_retained": int(self.pca.n_components_),
            "explained_variance_ratio": float(np.sum(self.pca.explained_variance_ratio_)),
            "initial_threshold": self.threshold
        }
        return self

    def predict_score(self, X: np.ndarray) -> np.ndarray:
        if not self.is_fitted or self.pca is None:
            raise RuntimeError("PCA model is not fitted yet.")

        # Project to subspace and reconstruct
        X_projected = self.pca.transform(X)
        X_reconstructed = self.pca.inverse_transform(X_projected)

        # Mean Squared Reconstruction Error per sample
        mse = np.mean(np.square(X - X_reconstructed), axis=1)
        norm_scores = (mse - mse.min()) / (mse.max() - mse.min() + 1e-8)
        return norm_scores
