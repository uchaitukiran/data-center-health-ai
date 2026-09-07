"""
Hyperparameter Tuning Engine for AIOps Telemetry Models
Performs systematic validation grid search across candidate anomaly models under strict zero-leakage conditions,
optimizing score separation, distribution stability, and operational threshold calibration on validation telemetry.
"""

import time
import numpy as np
from typing import Dict, Any, List, Tuple
from config.logging_config import logger
from src.ml.isolation_forest import IsolationForestDetector
from src.ml.pca_detector import PCADetector
from src.ml.one_class_svm import OneClassSVMDetector
from src.ml.lof_detector import LOFDetector
from src.ml.elliptic_envelope import RobustCovarianceDetector

class HyperparameterTuner:
    """
    Evaluates hyperparameter grids for each anomaly model family on the validation split.
    Uses unsupervised distribution stability, tail isolation, and variance metrics.
    """

    def __init__(self, X_train: np.ndarray, X_val: np.ndarray):
        self.X_train = X_train
        self.X_val = X_val
        self.tuning_history: List[Dict[str, Any]] = []

    def tune_isolation_forest(self) -> Dict[str, Any]:
        """Tuning grid for Isolation Forest."""
        logger.info("[Tuner] Systematic tuning for Isolation Forest...")
        param_grid = [
            {"n_estimators": 100, "max_samples": 0.7, "contamination": 0.02},
            {"n_estimators": 150, "max_samples": 0.8, "contamination": 0.03},
            {"n_estimators": 200, "max_samples": 0.85, "contamination": 0.03},
        ]
        best_params = None
        best_score = -1.0
        best_model = None

        for params in param_grid:
            model = IsolationForestDetector(
                n_estimators=params["n_estimators"],
                max_samples=params["max_samples"],
                contamination=params["contamination"]
            )
            model.fit(self.X_train)
            model.tune_threshold(self.X_val, percentile=98.0)
            val_scores = model.predict_score(self.X_val)

            # Optimization criterion: stable low nominal median (<0.3) and high IQR discrimination
            p25 = np.percentile(val_scores, 25.0)
            p50 = np.median(val_scores)
            p75 = np.percentile(val_scores, 75.0)
            p98 = np.percentile(val_scores, 98.0)
            iqr = p75 - p25

            # Quality metric: reward low nominal median + healthy discrimination spread
            quality_score = (1.0 - p50) * 0.6 + min(iqr * 2.0, 0.4)
            logger.info(f"  IF params={params} -> p50={p50:.4f}, p98={p98:.4f}, iqr={iqr:.4f}, quality={quality_score:.4f}")

            self.tuning_history.append({
                "model_family": "IsolationForest",
                "params": params,
                "p50": p50,
                "p98": p98,
                "score": quality_score
            })

            if quality_score > best_score:
                best_score = quality_score
                best_params = params
                best_model = model

        logger.info(f"[Tuner] Winning Isolation Forest: {best_params} (score={best_score:.4f})")
        return {"best_params": best_params, "best_model": best_model, "score": best_score}

    def tune_pca(self) -> Dict[str, Any]:
        """Tuning grid for PCA Detector."""
        logger.info("[Tuner] Systematic tuning for PCA Detector...")
        param_grid = [
            {"n_components": 0.85},
            {"n_components": 0.90},
            {"n_components": 0.95},
        ]
        best_params = None
        best_score = -1.0
        best_model = None

        for params in param_grid:
            model = PCADetector(n_components=params["n_components"])
            model.fit(self.X_train)
            model.tune_threshold(self.X_val, percentile=98.0)
            val_scores = model.predict_score(self.X_val)

            p50 = np.median(val_scores)
            p98 = np.percentile(val_scores, 98.0)
            var_explained = getattr(model.pca, "explained_variance_ratio_", [1.0]).sum()
            quality_score = var_explained * 0.7 + (1.0 - p50) * 0.3

            logger.info(f"  PCA params={params} -> var_explained={var_explained:.4f}, p50={p50:.4f}, quality={quality_score:.4f}")

            self.tuning_history.append({
                "model_family": "PCADetector",
                "params": params,
                "score": quality_score
            })

            if quality_score > best_score:
                best_score = quality_score
                best_params = params
                best_model = model

        logger.info(f"[Tuner] Winning PCA Detector: {best_params} (score={best_score:.4f})")
        return {"best_params": best_params, "best_model": best_model, "score": best_score}

    def tune_one_class_svm(self) -> Dict[str, Any]:
        """Tuning grid for One-Class SVM."""
        logger.info("[Tuner] Systematic tuning for One-Class SVM...")
        param_grid = [
            {"nu": 0.01, "kernel": "rbf"},
            {"nu": 0.03, "kernel": "rbf"},
            {"nu": 0.05, "kernel": "rbf"},
        ]
        best_params = None
        best_score = -1.0
        best_model = None

        for params in param_grid:
            model = OneClassSVMDetector(nu=params["nu"], kernel=params["kernel"])
            model.fit(self.X_train)
            model.tune_threshold(self.X_val, percentile=98.0)
            val_scores = model.predict_score(self.X_val)

            p50 = np.median(val_scores)
            quality_score = (1.0 - p50)
            logger.info(f"  OC-SVM params={params} -> p50={p50:.4f}, quality={quality_score:.4f}")

            self.tuning_history.append({
                "model_family": "OneClassSVM",
                "params": params,
                "score": quality_score
            })

            if quality_score > best_score:
                best_score = quality_score
                best_params = params
                best_model = model

        logger.info(f"[Tuner] Winning One-Class SVM: {best_params} (score={best_score:.4f})")
        return {"best_params": best_params, "best_model": best_model, "score": best_score}

    def tune_lof(self) -> Dict[str, Any]:
        """Tuning grid for Local Outlier Factor."""
        logger.info("[Tuner] Systematic tuning for LOF...")
        param_grid = [
            {"n_neighbors": 20},
            {"n_neighbors": 35},
            {"n_neighbors": 50},
        ]
        best_params = None
        best_score = -1.0
        best_model = None

        for params in param_grid:
            model = LOFDetector(n_neighbors=params["n_neighbors"])
            model.fit(self.X_train)
            model.tune_threshold(self.X_val, percentile=98.0)
            val_scores = model.predict_score(self.X_val)

            p50 = np.median(val_scores)
            quality_score = (1.0 - p50)
            logger.info(f"  LOF params={params} -> p50={p50:.4f}, quality={quality_score:.4f}")

            self.tuning_history.append({
                "model_family": "LocalOutlierFactor",
                "params": params,
                "score": quality_score
            })

            if quality_score > best_score:
                best_score = quality_score
                best_params = params
                best_model = model

        logger.info(f"[Tuner] Winning LOF: {best_params} (score={best_score:.4f})")
        return {"best_params": best_params, "best_model": best_model, "score": best_score}

    def tune_robust_covariance(self) -> Dict[str, Any]:
        """Tuning grid for Robust Covariance (Elliptic Envelope)."""
        logger.info("[Tuner] Systematic tuning for Robust Covariance...")
        param_grid = [
            {"contamination": 0.02, "support_fraction": 0.85},
            {"contamination": 0.03, "support_fraction": 0.90},
        ]
        best_params = None
        best_score = -1.0
        best_model = None

        for params in param_grid:
            model = RobustCovarianceDetector(
                contamination=params["contamination"],
                support_fraction=params["support_fraction"]
            )
            model.fit(self.X_train)
            model.tune_threshold(self.X_val, percentile=98.0)
            val_scores = model.predict_score(self.X_val)

            p50 = np.median(val_scores)
            quality_score = (1.0 - p50)
            logger.info(f"  RobustCovariance params={params} -> p50={p50:.4f}, quality={quality_score:.4f}")

            self.tuning_history.append({
                "model_family": "RobustCovariance",
                "params": params,
                "score": quality_score
            })

            if quality_score > best_score:
                best_score = quality_score
                best_params = params
                best_model = model

        logger.info(f"[Tuner] Winning Robust Covariance: {best_params} (score={best_score:.4f})")
        return {"best_params": best_params, "best_model": best_model, "score": best_score}
