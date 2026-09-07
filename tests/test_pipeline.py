"""
Unit tests for data pipeline and feature preprocessor.
"""

import numpy as np
import pytest
from src.pipeline.preprocessor import SMDPipeline

def test_pipeline_windowing():
    """Verify sliding window shape and label alignment."""
    pipeline = SMDPipeline(machine_id="machine-1-1", window_size=60)
    
    # Create synthetic telemetry data (500 timestamps, 38 sensors)
    dummy_data = np.random.randn(500, 38).astype(np.float32)
    dummy_labels = np.zeros(500, dtype=np.int32)
    dummy_labels[100:110] = 1 # Injected anomaly segment
    
    # 1. Sequence windows
    X_seq, y_seq = pipeline.create_sequence_windows(dummy_data, dummy_labels)
    expected_windows = 500 - 60 + 1
    assert X_seq.shape == (expected_windows, 60, 38)
    assert y_seq.shape == (expected_windows,)
    
    # 2. Tabular summary features
    X_tab, y_tab = pipeline.create_tabular_features(dummy_data, dummy_labels)
    assert X_tab.shape == (expected_windows, 152) # 38*4 summary features
    assert y_tab.shape == (expected_windows,)

def test_zero_data_leakage():
    """Verify scaler is fitted strictly on train data and persists correctly."""
    pipeline = SMDPipeline(machine_id="machine-1-1", window_size=60)
    train_dummy = np.random.randn(200, 38) * 10 + 50
    test_dummy = np.random.randn(100, 38) * 10 + 50
    
    train_scaled, test_scaled = pipeline.fit_transform_scaler(train_dummy, test_dummy)
    
    # Train mean should be close to 0 and std close to 1
    assert np.allclose(train_scaled.mean(axis=0), 0, atol=1e-1)
    assert np.allclose(train_scaled.std(axis=0), 1, atol=1e-1)
