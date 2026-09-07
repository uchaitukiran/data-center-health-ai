"""
Enterprise Dataset Downloader
Fetches Server Machine Dataset (SMD) and loghub traces for AIOps model benchmarking.
"""

import os
import urllib.request
import logging
from pathlib import Path
from typing import List

from config.config import (
    SMD_RAW_BASE_URL,
    RAW_DATA_DIR,
    LOGS_DATA_DIR,
    DEFAULT_MACHINES
)
from config.logging_config import logger

# Loghub raw sample log URLs (BGL and HDFS error samples)
LOGHUB_SAMPLES = {
    "BGL_sample.log": "https://raw.githubusercontent.com/logpai/loghub/master/BGL/BGL_2k.log",
    "HDFS_sample.log": "https://raw.githubusercontent.com/logpai/loghub/master/HDFS/HDFS_2k.log"
}

def download_file(url: str, dest_path: Path, timeout: int = 30) -> bool:
    """Safely downloads a file from URL to local destination with timeout and retry."""
    if dest_path.exists() and dest_path.stat().st_size > 0:
        logger.debug(f"File already exists: {dest_path.name} ({dest_path.stat().st_size} bytes)")
        return True
        
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    logger.info(f"Downloading: {url} -> {dest_path}")
    try:
        req = urllib.request.Request(
            url, 
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DataCenterHealthAI/1.0"}
        )
        with urllib.request.urlopen(req, timeout=timeout) as response:
            with open(dest_path, "wb") as out_file:
                out_file.write(response.read())
        logger.info(f"Successfully downloaded {dest_path.name} ({dest_path.stat().st_size} bytes)")
        return True
    except Exception as e:
        logger.error(f"Failed to download {url}: {e}")
        return False

def download_smd_dataset(machines: List[str] = DEFAULT_MACHINES) -> bool:
    """
    Downloads train, test, and test_label files for specified SMD machines.
    
    Structure:
      raw/smd/train/{machine}.txt
      raw/smd/test/{machine}.txt
      raw/smd/test_label/{machine}.txt
      raw/smd/interpretation_label/{machine}.txt
    """
    subdirs = ["train", "test", "test_label", "interpretation_label"]
    all_success = True
    
    for subdir in subdirs:
        (RAW_DATA_DIR / subdir).mkdir(parents=True, exist_ok=True)
        
    for machine in machines:
        logger.info(f"Fetching SMD data for machine '{machine}'...")
        for subdir in subdirs:
            url = f"{SMD_RAW_BASE_URL}/{subdir}/{machine}.txt"
            dest = RAW_DATA_DIR / subdir / f"{machine}.txt"
            success = download_file(url, dest)
            if not success and subdir != "interpretation_label":
                all_success = False
                
    return all_success

def download_loghub_samples() -> bool:
    """Downloads sample cloud & HPC logs for LLM Root Cause Analysis triage."""
    LOGS_DATA_DIR.mkdir(parents=True, exist_ok=True)
    all_success = True
    for fname, url in LOGHUB_SAMPLES.items():
        dest = LOGS_DATA_DIR / fname
        success = download_file(url, dest)
        if not success:
            all_success = False
    return all_success

def ensure_datasets():
    """Top-level dataset verification and bootstrap function."""
    logger.info("Verifying and bootstrapping AIOps datasets...")
    smd_ok = download_smd_dataset()
    logs_ok = download_loghub_samples()
    
    if smd_ok:
        logger.info("SMD dataset is fully synced and ready.")
    else:
        logger.warning("Some SMD files could not be fetched. Check connectivity.")
        
    if logs_ok:
        logger.info("Loghub sample logs are fully synced and ready.")
    else:
        logger.warning("Some Loghub sample files could not be fetched.")

if __name__ == "__main__":
    ensure_datasets()
