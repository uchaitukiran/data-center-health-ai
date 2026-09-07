"""
LSTM Autoencoder Anomaly Detector
Deep sequence-to-sequence reconstruction architecture for high-dimensional server telemetry.
Learns normal temporal signatures and flags failure precursors via reconstruction residual spikes.
"""

import numpy as np
from typing import Optional, Dict, Any
from pathlib import Path
import joblib

try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

from src.ml.base_model import BaseAnomalyModel
from config.config import SEQUENCE_WINDOW_SIZE, SENSOR_METRIC_COUNT
from config.logging_config import logger

if HAS_TORCH:
    class PyTorchLSTMModel(nn.Module):
        """Encoder-Decoder LSTM architecture with bottleneck latent representation."""
        def __init__(self, input_dim: int = SENSOR_METRIC_COUNT, hidden_dim: int = 64, latent_dim: int = 32):
            super().__init__()
            # Encoder
            self.encoder_lstm1 = nn.LSTM(input_dim, hidden_dim, batch_first=True)
            self.encoder_lstm2 = nn.LSTM(hidden_dim, latent_dim, batch_first=True)

            # Decoder
            self.decoder_lstm1 = nn.LSTM(latent_dim, hidden_dim, batch_first=True)
            self.decoder_lstm2 = nn.LSTM(hidden_dim, input_dim, batch_first=True)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            # x shape: (batch_size, seq_len, input_dim)
            seq_len = x.size(1)
            out, (h_n, _) = self.encoder_lstm1(x)
            _, (latent_h, _) = self.encoder_lstm2(out)

            # Repeat latent vector across sequence length
            latent_repeated = latent_h[-1].unsqueeze(1).repeat(1, seq_len, 1)

            out, _ = self.decoder_lstm1(latent_repeated)
            reconstructed, _ = self.decoder_lstm2(out)
            return reconstructed
else:
    PyTorchLSTMModel = None

class LSTMAutoencoderDetector(BaseAnomalyModel):
    """
    Production wrapper for PyTorch LSTM Autoencoder complying with BaseAnomalyModel.
    Can be serialized via joblib / pickle.
    """

    def __init__(
        self,
        input_dim: int = SENSOR_METRIC_COUNT,
        seq_len: int = SEQUENCE_WINDOW_SIZE,
        hidden_dim: int = 64,
        latent_dim: int = 32,
        epochs: int = 8,
        batch_size: int = 128,
        learning_rate: float = 0.001
    ):
        super().__init__(name="LSTMAutoencoder")
        self.input_dim = input_dim
        self.seq_len = seq_len
        self.hidden_dim = hidden_dim
        self.latent_dim = latent_dim
        self.epochs = epochs
        self.batch_size = batch_size
        self.learning_rate = learning_rate
        self.model: Optional[Any] = None
        self.state_dict: Optional[Dict[str, Any]] = None

    def fit(self, X_seq: np.ndarray, y: Optional[np.ndarray] = None) -> "LSTMAutoencoderDetector":
        if not HAS_TORCH:
            raise RuntimeError("PyTorch is required to train LSTMAutoencoder.")

        logger.info(
            f"[LSTM-AE] Training on {X_seq.shape[0]} sequence windows "
            f"(seq_len={self.seq_len}, input_dim={self.input_dim}, epochs={self.epochs})..."
        )
        self.model = PyTorchLSTMModel(
            input_dim=self.input_dim,
            hidden_dim=self.hidden_dim,
            latent_dim=self.latent_dim
        )
        self.model.train()

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(device)

        dataset = TensorDataset(torch.from_numpy(X_seq).float())
        loader = DataLoader(dataset, batch_size=self.batch_size, shuffle=True)

        optimizer = torch.optim.Adam(self.model.parameters(), lr=self.learning_rate)
        criterion = nn.MSELoss()

        for epoch in range(1, self.epochs + 1):
            total_loss = 0.0
            for batch in loader:
                x_batch = batch[0].to(device)
                optimizer.zero_grad()
                pred = self.model(x_batch)
                loss = criterion(pred, x_batch)
                loss.backward()
                optimizer.step()
                total_loss += loss.item() * len(x_batch)

            epoch_loss = total_loss / len(X_seq)
            if epoch % 2 == 0 or epoch == self.epochs:
                logger.info(f"[LSTM-AE] Epoch {epoch}/{self.epochs} - Reconstruction Loss: {epoch_loss:.6f}")

        self.is_fitted = True
        self.model.eval()

        # Cache state_dict for clean pickle persistence
        self.state_dict = {k: v.cpu() for k, v in self.model.state_dict().items()}

        train_scores = self.predict_score(X_seq)
        self.threshold = float(np.percentile(train_scores, 98.0))
        self.metadata = {
            "hidden_dim": self.hidden_dim,
            "latent_dim": self.latent_dim,
            "epochs": self.epochs,
            "final_reconstruction_loss": float(epoch_loss),
            "initial_threshold": self.threshold
        }
        logger.info(f"[LSTM-AE] Fitted successfully. Baseline threshold: {self.threshold:.6f}")
        return self

    def _ensure_model_loaded(self):
        if self.model is None and self.state_dict is not None and HAS_TORCH:
            self.model = PyTorchLSTMModel(
                input_dim=self.input_dim,
                hidden_dim=self.hidden_dim,
                latent_dim=self.latent_dim
            )
            self.model.load_state_dict(self.state_dict)
            self.model.eval()

    def predict_score(self, X_seq: np.ndarray) -> np.ndarray:
        if not self.is_fitted and self.state_dict is None:
            raise RuntimeError("LSTMAutoencoder model is not fitted yet.")

        self._ensure_model_loaded()
        self.model.eval()
        device = next(self.model.parameters()).device

        # Handle 2D tabular fallback by reshaping if needed
        if X_seq.ndim == 2:
            raise ValueError(f"LSTM-AE requires 3D sequence array (N, {self.seq_len}, {self.input_dim}).")

        errors = []
        with torch.no_grad():
            for i in range(0, len(X_seq), self.batch_size):
                batch = torch.from_numpy(X_seq[i : i + self.batch_size]).float().to(device)
                pred = self.model(batch)
                # Mean squared error per sequence
                batch_err = torch.mean(torch.square(pred - batch), dim=(1, 2)).cpu().numpy()
                errors.append(batch_err)

        raw_mse = np.concatenate(errors)
        norm_scores = (raw_mse - raw_mse.min()) / (raw_mse.max() - raw_mse.min() + 1e-8)
        return norm_scores
