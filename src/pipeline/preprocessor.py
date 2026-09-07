"""
Enterprise Preprocessor & Feature Engineering Pipeline
Handles data cleaning, normalization (zero data leakage), sliding windows,
and train/validation/test split for SMD time-series metrics.
"""

import numpy as np
import pandas as pd
from pathlib import Path
from typing import Tuple, Dict, Any, Optional
import joblib
from sklearn.preprocessing import StandardScaler, MinMaxScaler

from config.config import (
    RAW_DATA_DIR,
    PROCESSED_DATA_DIR,
    SCALERS_DIR,
    SEQUENCE_WINDOW_SIZE,
    RANDOM_STATE
)
from config.logging_config import logger

class SMDPipeline:
    """
    Production-grade ETL & feature generator for Server Machine Dataset (SMD).
    Ensures strict separation between train and test splits to eliminate data leakage.
    """

    def __init__(self, machine_id: str = "machine-1-1", window_size: int = SEQUENCE_WINDOW_SIZE):
        self.machine_id = machine_id
        self.window_size = window_size
        self.scaler: Optional[StandardScaler] = None
        self.scaler_path = SCALERS_DIR / f"scaler_{self.machine_id}.joblib"

    def load_raw_data(self) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Loads raw train, test, and test_label files for the machine.
        
        Returns:
            Tuple of (train_raw, test_raw, test_labels)
        """
        train_path = RAW_DATA_DIR / "train" / f"{self.machine_id}.txt"
        test_path = RAW_DATA_DIR / "test" / f"{self.machine_id}.txt"
        label_path = RAW_DATA_DIR / "test_label" / f"{self.machine_id}.txt"

        if not train_path.exists() or not test_path.exists() or not label_path.exists():
            raise FileNotFoundError(
                f"Missing dataset files for {self.machine_id}. Ensure downloader has run."
            )

        # SMD files are comma-separated 38-dim floats
        train_raw = np.loadtxt(train_path, delimiter=",")
        test_raw = np.loadtxt(test_path, delimiter=",")
        test_labels = np.loadtxt(label_path, delimiter=",").astype(int)

        logger.info(
            f"Loaded {self.machine_id} - Train shape: {train_raw.shape}, "
            f"Test shape: {test_raw.shape}, Anomaly labels: {test_labels.sum()} "
            f"({test_labels.mean()*100:.2f}%)"
        )
        return train_raw, test_raw, test_labels

    def fit_transform_scaler(self, train_raw: np.ndarray, test_raw: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Fits StandardScaler strictly on normal training data and transforms both train and test.
        Persists the fitted scaler for live production inference.
        """
        # Replace NaNs or Infs if any exist
        train_raw = np.nan_to_num(train_raw, nan=0.0, posinf=1.0, neginf=-1.0)
        test_raw = np.nan_to_num(test_raw, nan=0.0, posinf=1.0, neginf=-1.0)

        self.scaler = StandardScaler()
        train_scaled = self.scaler.fit_transform(train_raw)
        test_scaled = self.scaler.transform(test_raw)

        # Save scaler
        joblib.dump(self.scaler, self.scaler_path)
        logger.info(f"Fitted and saved scaler to {self.scaler_path}")
        return train_scaled, test_scaled

    def load_scaler(self) -> StandardScaler:
        """Loads fitted scaler from disk for real-time inference."""
        if not self.scaler_path.exists():
            raise FileNotFoundError(f"Fitted scaler not found at {self.scaler_path}")
        self.scaler = joblib.load(self.scaler_path)
        return self.scaler

    def create_sequence_windows(
        self, data: np.ndarray, labels: Optional[np.ndarray] = None, step: int = 1
    ) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """
        Generates 3D sliding sequence windows for LSTM Autoencoders.
        
        Args:
            data: 2D array (T, D)
            labels: 1D binary labels (T,) or None
            step: Stride between windows
            
        Returns:
            X_windows: Shape (N, window_size, D)
            y_windows: Shape (N,) where label = 1 if anomaly occurs at the target point
        """
        n_samples, n_features = data.shape
        X_list = []
        y_list = []

        for i in range(0, n_samples - self.window_size + 1, step):
            X_list.append(data[i : i + self.window_size])
            if labels is not None:
                # Flag window as anomaly if the terminal point is an anomaly
                y_list.append(labels[i + self.window_size - 1])

        X_windows = np.array(X_list, dtype=np.float32)
        y_windows = np.array(y_list, dtype=np.int32) if labels is not None else None

        return X_windows, y_windows

    def create_tabular_features(
        self, data: np.ndarray, labels: Optional[np.ndarray] = None, step: int = 1
    ) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """
        Engineers tabular summary features from sliding windows for classical ML models:
        (Isolation Forest, One-Class SVM, LOF).
        
        Features per window:
        - Current sensor values (38 features)
        - Window Mean (38 features)
        - Window Standard Deviation (38 features)
        - Window Max - Min spread (38 features)
        Total = 152 engineered features capturing both state and momentum.
        """
        n_samples, n_features = data.shape
        X_feats = []
        y_feats = []

        for i in range(0, n_samples - self.window_size + 1, step):
            window = data[i : i + self.window_size]
            current_val = window[-1]
            mean_val = np.mean(window, axis=0)
            std_val = np.std(window, axis=0)
            spread_val = np.max(window, axis=0) - np.min(window, axis=0)

            # Combined feature vector: (152,)
            feat_vec = np.concatenate([current_val, mean_val, std_val, spread_val])
            X_feats.append(feat_vec)

            if labels is not None:
                y_feats.append(labels[i + self.window_size - 1])

        X_tabular = np.array(X_feats, dtype=np.float32)
        y_tabular = np.array(y_feats, dtype=np.int32) if labels is not None else None

        return X_tabular, y_tabular

    def prepare_all_splits(self, val_ratio: float = 0.15) -> Dict[str, Any]:
        """
        Full orchestration: loads, scales, windows, and prepares validation split.
        
        Returns:
            Dictionary containing both tabular and sequence datasets ready for training.
        """
        train_raw, test_raw, test_labels = self.load_raw_data()
        train_scaled, test_scaled = self.fit_transform_scaler(train_raw, test_raw)

        # Train / Validation Split on train data (strictly healthy normal telemetry)
        val_size = int(len(train_scaled) * val_ratio)
        train_split = train_scaled[:-val_size]
        val_split = train_scaled[-val_size:]

        # 1. Tabular datasets
        X_train_tab, _ = self.create_tabular_features(train_split)
        X_val_tab, _ = self.create_tabular_features(val_split)
        X_test_tab, y_test = self.create_tabular_features(test_scaled, test_labels)

        # 2. Sequence datasets (for LSTM Autoencoder)
        X_train_seq, _ = self.create_sequence_windows(train_split)
        X_val_seq, _ = self.create_sequence_windows(val_split)
        X_test_seq, _ = self.create_sequence_windows(test_scaled, test_labels)

        logger.info(
            f"Preprocessed splits ready for {self.machine_id}:\n"
            f"  - Tabular Train: {X_train_tab.shape}, Val: {X_val_tab.shape}, Test: {X_test_tab.shape}\n"
            f"  - Sequence Train: {X_train_seq.shape}, Val: {X_val_seq.shape}, Test: {X_test_seq.shape}\n"
            f"  - Test Anomaly Ratio: {y_test.mean()*100:.2f}% ({y_test.sum()}/{len(y_test)})"
        )

        return {
            "machine_id": self.machine_id,
            "X_train_tab": X_train_tab,
            "X_val_tab": X_val_tab,
            "X_test_tab": X_test_tab,
            "X_train_seq": X_train_seq,
            "X_val_seq": X_val_seq,
            "X_test_seq": X_test_seq,
            "y_test": y_test,
            "test_scaled_raw": test_scaled,
            "test_labels_raw": test_labels
        }
