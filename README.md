<div align="center">

# Data Center Health AI (AIOps 3D Digital Twin)
### Enterprise Server Failure Prediction with Classical ML, Deep Learning (LSTM-AE), GenAI Root Cause Analysis (Groq Llama-3.3-70B), and a Real-time Three.js 3D Dashboard.

[![Python 3.10](https://img.shields.io/badge/Python-3.10-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.14-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)](https://pytorch.org/)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-1.7-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![Groq](https://img.shields.io/badge/Groq-Llama--3.3--70B-F55036?style=for-the-badge&logo=openai&logoColor=white)](https://groq.com/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

</div>

---

## 📌 Executive Overview

**Data Center Health AI** is an end-to-end AIOps platform designed for mission-critical cloud and enterprise infrastructure. It continuously monitors 38 real-world telemetry vital signs (CPU execution modes, memory page faults, disk queue depths, TCP retransmissions, chassis temperatures) across data center server nodes, detects subtle degradation patterns hours before catastrophic downtime, synthesizes plain-English Root Cause Analysis (RCA) via **Groq Llama-3.3-70B**, and projects real-time rack risk states into an interactive **Three.js 3D Digital Twin**.

---

## 🏛️ 5-Layer Production Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        1. DATA SOURCES LAYER                           │
│  Server Machine Dataset (SMD) - 38 metrics × 28 servers × 5 weeks       │
│  System Event Logs (loghub: BGL & HDFS error traces)                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      2. DATA PROCESSING LAYER                          │
│  Zero-Leakage Scalers (StandardScaler fit on normal baseline)          │
│  Sliding Windows: 60-step Sequence Windows & 152-dim Summary Vectors   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          3. AI ENGINE LAYER                            │
│  Empirical Multi-Model Tournament (.pkl serialized candidate models):  │
│  - Isolation Forest  - One-Class SVM  - LOF Novelty  - PCA Residuals  │
│  - Deep Sequence-to-Sequence LSTM Autoencoder (PyTorch)                │
│  Champion Model Selection (High PA-F1, Low False Alarm Rate, <10ms SLA)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    4. GENAI RCA & API SERVING LAYER                    │
│  Groq API (Llama-3.3-70B) Autonomous Incident Triage with Cache        │
│  Flask REST API + Low-Latency WebSocket Stream (/ws/telemetry)         │
│  SQLite / PostgreSQL Telemetry & Incident Audit Trail                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      5. 3D DIGITAL TWIN PRESENTATION                   │
│  Three.js Interactive Server Room with OrbitControls                   │
│  Dynamic Mesh Illumination: Green (<40) | Orange (40-70) | Red (>70)   │
│  Raycaster Click-to-Inspect Telemetry Gauges & LLM Triage Cards        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🏆 Multi-Model Benchmark & Champion Selection

We conducted a head-to-head empirical tournament on the Server Machine Dataset (`machine-1-1`, 28,479 points, labeled ground-truth anomalies). Every candidate model was serialized to `.pkl` format under `artifacts/models/`:

| Candidate Model | PA-F1 Score | Standard F1 | Precision | Recall | PR-AUC | Latency (ms) | Artifact File |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Isolation Forest (Champion)** | **0.8548** | **0.3083** | **0.4215** | **0.2435** | **0.4805** | **0.018 ms** | `IsolationForest_machine-1-1.pkl` |
| **LSTM Autoencoder** | 0.8120 | 0.2850 | 0.3800 | 0.2300 | 0.4420 | 0.940 ms | `LSTMAutoencoder_machine-1-1.pkl` |
| **PCADetector** | 0.3380 | 0.0360 | 0.0510 | 0.0186 | 0.6113 | 0.004 ms | `PCADetector_machine-1-1.pkl` |
| **Local Outlier Factor (LOF)** | 0.3370 | 0.0366 | 0.0520 | 0.0189 | 0.4328 | 0.061 ms | `LocalOutlierFactor_machine-1-1.pkl` |
| **One-Class SVM** | 0.3165 | 0.3165 | 0.1880 | 1.0000 | 0.7028 | 0.102 ms | `OneClassSVM_machine-1-1.pkl` |

> 📖 **Full Engineering Report**: Read the complete mathematical rationale and trade-off analysis in [`docs/MODEL_COMPARISON_AND_SELECTION.md`](docs/MODEL_COMPARISON_AND_SELECTION.md).

---

## 🚀 Quickstart Guide

### 1. Prerequisites & Virtual Environment
```powershell
# Clone the repository
git clone https://github.com/uchaitukiran/data-center-health-ai.git
cd data-center-health-ai

# Activate Python 3.10 virtual environment
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment
Set your Groq API key in `.env`:
```env
GROQ_API_KEY=your_groq_api_key_here
PORT=8000
HOST=0.0.0.0
```

### 3. Run Automated Dataset Ingestion & Model Training
```powershell
# 1. Download SMD traces & loghub samples
python -m src.pipeline.downloader

# 2. Run multi-model tournament, calibrate thresholds, and select champion
python -m src.ml.trainer
```

### 4. Launch the Web Application & 3D Dashboard
```powershell
python -m src.api.app
```
Open **[http://localhost:8000](http://localhost:8000)** in any modern web browser.

---

## 🧪 Automated Testing
Run the test suite covering feature engineering, model scoring, and REST API contracts:
```powershell
pytest tests/ -v
```

---

## 🐳 Docker & Cloud Deployment (Render)

This repository includes a production multi-stage `Dockerfile` and slim cloud dependencies (`requirements-render.txt`):

```bash
# Build Docker image
docker build -t datacenter-health-ai .

# Run container
docker run -p 8000:8000 --env-file .env datacenter-health-ai
```

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
