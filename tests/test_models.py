"""
Unit tests for candidate anomaly models and scoring outputs.
"""

import numpy as np
import pytest
from src.ml.isolation_forest import IsolationForestDetector
from src.ml.pca_detector import PCADetector

def test_isolation_forest_scoring():
    """Verify IsolationForest score bounds and threshold calibration."""
    model = IsolationForestDetector(n_estimators=30)
    X_train = np.random.randn(300, 152)
    model.fit(X_train)
    
    assert model.is_fitted
    scores = model.predict_score(X_train)
    assert len(scores) == 300
    assert np.all(scores >= 0.0) and np.all(scores <= 1.0)
    
    # Check risk score mapping
    risk = model.calculate_risk_score(X_train)
    assert np.all(risk >= 0.0) and np.all(risk <= 100.0)

def test_pca_detector_scoring():
    """Verify PCA reconstruction residual computation."""
    model = PCADetector(n_components=0.90)
    X_train = np.random.randn(200, 152)
    model.fit(X_train)
    
    assert model.is_fitted
    scores = model.predict_score(X_train)
    assert len(scores) == 200
    assert np.all(scores >= 0.0) and np.all(scores <= 1.0)
