import logging
import sys
from pathlib import Path

def setup_logging(log_level: int = logging.INFO, log_file: str = "app.log") -> logging.Logger:
    """Configures structured enterprise logging with console and file handlers."""
    log_dir = Path("logs")
    log_dir.mkdir(parents=True, exist_ok=True)
    
    logger = logging.getLogger("DataCenterHealthAI")
    logger.setLevel(log_level)
    
    # Avoid duplicate handlers if re-called
    if logger.handlers:
        return logger
        
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] [%(name)s:%(funcName)s:%(lineno)d] - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    # Console Stream Handler
    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(log_level)
    ch.setFormatter(formatter)
    logger.addHandler(ch)
    
    # File Handler
    fh = logging.FileHandler(log_dir / log_file, encoding="utf-8")
    fh.setLevel(log_level)
    fh.setFormatter(formatter)
    logger.addHandler(fh)
    
    return logger

logger = setup_logging()
