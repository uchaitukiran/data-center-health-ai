"""
MNC-Grade Model Evaluation Suite for AIOps Telemetry
Calculates Precision, Recall, F1, PR-AUC, ROC-AUC, Latency, Point-Adjusted F1,
and generates publication-ready visualization curves.
"""

import time
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
    confusion_matrix,
    precision_recall_curve,
    roc_curve
)

from config.config import REPORTS_DIR
from config.logging_config import logger

def calculate_point_adjusted_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Tuple[float, float, float]:
    """
    Computes Point-Adjusted (PA) Precision, Recall, and F1 (OmniAnomaly benchmark standard).
    In operations monitoring, if an anomaly segment is flagged at any point before catastrophic failure,
    the early warning alert is considered successful for the entire contiguous segment.
    """
    y_true_adj = np.copy(y_true)
    y_pred_adj = np.copy(y_pred)

    in_anomaly = False
    start_idx = 0

    for i in range(len(y_true)):
        if y_true[i] == 1 and not in_anomaly:
            in_anomaly = True
            start_idx = i
        elif y_true[i] == 0 and in_anomaly:
            in_anomaly = False
            # If any prediction in the ground-truth segment was positive, mark entire segment detected
            if np.any(y_pred_adj[start_idx:i] == 1):
                y_pred_adj[start_idx:i] = 1

    if in_anomaly and np.any(y_pred_adj[start_idx:] == 1):
        y_pred_adj[start_idx:] = 1

    p = precision_score(y_true_adj, y_pred_adj, zero_division=0)
    r = recall_score(y_true_adj, y_pred_adj, zero_division=0)
    f1 = f1_score(y_true_adj, y_pred_adj, zero_division=0)
    return float(p), float(r), float(f1)

def evaluate_model(
    model_name: str,
    scores: np.ndarray,
    y_true: np.ndarray,
    threshold: float,
    inference_time_sec: float
) -> Dict[str, Any]:
    """
    Comprehensive evaluation of an anomaly detection model against ground-truth labels.
    """
    y_pred = (scores >= threshold).astype(int)

    # Standard Point-Wise Metrics
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)

    try:
        roc_auc = roc_auc_score(y_true, scores)
    except Exception:
        roc_auc = 0.5

    try:
        pr_auc = average_precision_score(y_true, scores)
    except Exception:
        pr_auc = 0.0

    # Point-Adjusted Operational Metrics
    pa_prec, pa_rec, pa_f1 = calculate_point_adjusted_metrics(y_true, y_pred)

    # Confusion Matrix
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel() if cm.shape == (2, 2) else (0, 0, 0, 0)
    far = fp / (fp + tn + 1e-8)  # False Alarm Rate

    # Average latency per 1,000 samples (ms)
    ms_per_sample = (inference_time_sec / max(len(scores), 1)) * 1000.0

    metrics = {
        "model_name": model_name,
        "precision": round(float(prec), 4),
        "recall": round(float(rec), 4),
        "f1_score": round(float(f1), 4),
        "pa_precision": round(float(pa_prec), 4),
        "pa_recall": round(float(pa_rec), 4),
        "pa_f1_score": round(float(pa_f1), 4),
        "pr_auc": round(float(pr_auc), 4),
        "roc_auc": round(float(roc_auc), 4),
        "false_alarm_rate": round(float(far), 4),
        "true_positives": int(tp),
        "false_positives": int(fp),
        "true_negatives": int(tn),
        "false_negatives": int(fn),
        "threshold": round(float(threshold), 6),
        "latency_ms": round(float(ms_per_sample), 3)
    }

    logger.info(
        f"[{model_name}] Eval: F1={f1:.4f} | PA-F1={pa_f1:.4f} | PR-AUC={pr_auc:.4f} | "
        f"Recall={rec:.4f} | Latency={ms_per_sample:.3f}ms"
    )
    return metrics

def plot_model_comparison(results_df: pd.DataFrame, output_dir: Path = REPORTS_DIR):
    """Generates comparative bar charts of key metrics across candidate models."""
    output_dir.mkdir(parents=True, exist_ok=True)
    sns.set_theme(style="whitegrid", palette="muted")

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle("Data Center Health AI - Candidate Models Benchmark", fontsize=16, fontweight="bold")

    # 1. F1 and PA-F1 Comparison
    df_f1 = results_df[["model_name", "f1_score", "pa_f1_score"]].melt(
        id_vars="model_name", var_name="Metric", value_name="Score"
    )
    sns.barplot(data=df_f1, x="model_name", y="Score", hue="Metric", ax=axes[0, 0], palette=["#2b5c8f", "#17a2b8"])
    axes[0, 0].set_title("Standard F1 vs Point-Adjusted F1 (Operational)", fontweight="bold")
    axes[0, 0].set_ylim(0, 1.05)
    axes[0, 0].tick_params(axis="x", rotation=15)

    # 2. Precision vs Recall
    df_pr = results_df[["model_name", "precision", "recall"]].melt(
        id_vars="model_name", var_name="Metric", value_name="Score"
    )
    sns.barplot(data=df_pr, x="model_name", y="Score", hue="Metric", ax=axes[0, 1], palette=["#28a745", "#dc3545"])
    axes[0, 1].set_title("Precision (No False Alarms) vs Recall (Catch Failures)", fontweight="bold")
    axes[0, 1].set_ylim(0, 1.05)
    axes[0, 1].tick_params(axis="x", rotation=15)

    # 3. PR-AUC & ROC-AUC
    df_auc = results_df[["model_name", "pr_auc", "roc_auc"]].melt(
        id_vars="model_name", var_name="Metric", value_name="Score"
    )
    sns.barplot(data=df_auc, x="model_name", y="Score", hue="Metric", ax=axes[1, 0], palette=["#6f42c1", "#fd7e14"])
    axes[1, 0].set_title("Area Under PR Curve vs ROC-AUC", fontweight="bold")
    axes[1, 0].set_ylim(0, 1.05)
    axes[1, 0].tick_params(axis="x", rotation=15)

    # 4. Latency (ms per sample)
    sns.barplot(data=results_df, x="model_name", y="latency_ms", ax=axes[1, 1], palette="crest")
    axes[1, 1].set_title("Inference Latency (ms / sample) - Lower is Faster", fontweight="bold")
    axes[1, 1].tick_params(axis="x", rotation=15)

    plt.tight_layout()
    chart_path = output_dir / "model_benchmark_comparison.png"
    plt.savefig(chart_path, dpi=200)
    plt.close()
    logger.info(f"Saved model benchmark comparison plot to {chart_path}")
