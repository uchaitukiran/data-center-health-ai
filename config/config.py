import os
from pathlib import Path
from dotenv import load_dotenv

# Load local environment variables from .env
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# Storage Paths
DATA_DIR = BASE_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw" / "smd"
LOGS_DATA_DIR = DATA_DIR / "raw" / "logs"
PROCESSED_DATA_DIR = DATA_DIR / "processed"

ARTIFACTS_DIR = BASE_DIR / "artifacts"
MODELS_DIR = ARTIFACTS_DIR / "models"
BEST_MODEL_DIR = ARTIFACTS_DIR / "best_model"
SCALERS_DIR = ARTIFACTS_DIR / "scalers"
REPORTS_DIR = ARTIFACTS_DIR / "reports"

# Ensure directories exist
for p in [RAW_DATA_DIR, LOGS_DATA_DIR, PROCESSED_DATA_DIR, MODELS_DIR, BEST_MODEL_DIR, SCALERS_DIR, REPORTS_DIR]:
    p.mkdir(parents=True, exist_ok=True)

# Datasets
SMD_RAW_BASE_URL = "https://raw.githubusercontent.com/NetManAIOps/OmniAnomaly/master/ServerMachineDataset"
DEFAULT_MACHINES = ["machine-1-1", "machine-1-2", "machine-2-1", "machine-3-1"]

# Pipeline Hyperparameters
SEQUENCE_WINDOW_SIZE = 60       # 60 timesteps for sequence modeling (LSTM-AE)
STREAM_WINDOW_SIZE = 120        # 120 timesteps for streaming evaluation
SENSOR_METRIC_COUNT = 38        # 38 sensors in SMD
CONTAMINATION_ESTIMATE = 0.02   # Estimated anomaly ratio in enterprise IT infrastructure
RANDOM_STATE = 42

# Operational Risk Thresholds
RISK_THRESHOLD_WARNING = 40.0   # 40-70: Amber warning
RISK_THRESHOLD_CRITICAL = 70.0  # >70: Critical alert

# LLM & GenAI Settings
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
LLM_CACHE_FILE = ARTIFACTS_DIR / "llm_rca_cache.json"

# Server & Network
PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR}/datacenter.db")
