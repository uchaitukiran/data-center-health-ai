"""
One-Class Support Vector Machine (OC-SVM) Anomaly Detector
Fits a non-linear maximum margin hyperplane (RBF kernel) enclosing the nominal feature distribution.
"""

import numpy as np
from sklearn.svm import OneClassSVM
from typing import Optional, Dict, Any

from src.ml.base_model import BaseAnomalyModel
from config.logging_config import logger

class OneClassSVMDetector(BaseAnomalyModel):
    """
    Production OC-SVM detector with RBF kernel and adaptive gamma/nu tuning.
    """

    def __init__(
        self,
        kernel: str = "rbf",
        nu: float = 0.03,
        gamma: str = "scale"
    ):
        super().__init__(name="OneClassSVM")
        self.kernel = kernel
        self.nu = nu
        self.gamma = gamma
        self.model: Optional[OneClassSVM] = None

    def fit(self, X: np.ndarray, y: Optional[np.ndarray] = None) -> "OneClassSVMDetector":
        # OC-SVM can be computationally heavy on huge datasets; subsample if > 15,000
        if len(X) > 15000:
            indices = np.random.RandomState(42).choice(len(X), size=15000, replace=False)
            X_sub = X[indices]
        else:
            X_sub = X

        logger.info(f"[OneClassSVM] Training with nu={self.nu}, kernel={self.kernel} on {len(X_sub)} samples...")
        self.model = OneClassSVM(kernel=self.kernel, nu=self.nu, gamma=self.gamma)
        self.model.fit(X_sub)
        self.is_fitted = True

        train_scores = self.predict_score(X_sub)
        self.threshold = float(np.percentile(train_scores, 98.0))
        self.metadata = {
            "kernel": self.kernel,
            "nu": self.nu,
            "gamma": self.gamma,
            "initial_threshold": self.threshold
        }
        logger.info(f"[OneClassSVM] Fitted successfully. Baseline threshold: {self.threshold:.5f}")
        return self

    def predict_score(self, X: np.ndarray) -> np.ndarray:
        if not self.is_fitted or self.model is None:
            raise RuntimeError("OneClassSVM model is not fitted yet.")

        # decision_function: signed distance to the separating hyperplane. Negative = outlier.
        raw_dist = -self.model.decision_function(X)
        norm_scores = (raw_dist - raw_dist.min()) / (raw_dist.max() - raw_dist.min() + 1e-8)
        return norm_scores
