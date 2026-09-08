# Implementation Plan: Project Backup (PDF/DOC) & Exact Dashboard Replication

The user requested:
1. **Take a full project backup in PDF and DOC format first** covering all work accomplished to date (Data pipeline, ML tournament with 5 models, hyperparameter tuning, Groq LLM RCA, Flask API/WebSocket, and 3D digital twin).
2. **Replicate the new reference dashboard design (`input_file_0.png`)**:
   - Title: **"Data Center Command Center"** with subtitle *"Real-time Monitoring | AI-powered Insights | Reliable Operations"*.
   - Center 3D Viewport: Use `datacente_model/dc with int.glb` with the 2-cluster layout (5 racks on left `R-01`–`R-05`, 5 racks on right `R-06`–`R-10`), using `input_file_1.png` (room interior) and `input_file_2.png` (daylight cityscape sky) as daylight projections/environment.
   - Use **real project values** (champion model `RobustCovariance`, SMD telemetry data, real anomaly risk scores) rather than blind static hardcoding.
   - Bottom 3 cards: `Server Health Distribution` donut, `Risk Trend (Last 24 Hours)` spline, `Recent Alerts` list (`R-09`, `R-08`, `R-03`, `R-12`).
   - Selected Server inspector: `R-09` (Critical), tabs `[Overview] [Metrics] [Logs] [AI Insight]`, gauge `13 / 100`, Resource usage bars, and Groq LLM RCA.
   - Left Sidebar: `Dashboard` active, `Infrastructure`, `Servers`, `Analytics`, `Alerts` (badge 3), `Logs`, `AI Assistant`, `Reports`, `Settings`, and bottom mountain graphic card *"Healthy Infrastructure Builds a Brighter Tomorrow"*.

---

## User Review Required

> [!IMPORTANT]
> **Step 1 is taking the complete project documentation & backup in both PDF and DOCX format** as explicitly requested by the user (*"till now how much we did take backup in pdf or doc 1st, after that start 3d dashboard"*).

---

## Proposed Changes

### 1. Project Documentation & Backup (PDF & DOCX)
Generate a 10-15 page professional technical report:
- `Data_Center_Health_AI_Project_Documentation.pdf`
- `Data_Center_Health_AI_Project_Documentation.docx`
- Covering:
  1. System Architecture & Topology
  2. Dataset: Server Machine Dataset (SMD) with 38 telemetry channels
  3. Machine Learning Tournament: Isolation Forest, Robust Covariance (Champion), LOF, One-Class SVM, LSTM Autoencoder
  4. Hyperparameter Tuning & Evaluation Matrix
  5. GenAI / Groq LLM Root Cause Analysis & Automated Remediation
  6. Backend REST API & WebSocket Streaming
  7. 3D Digital Twin Architecture & WebGL Engine
  8. Codebase Directory Structure & Reproduction Guide

### 2. Assets & Media Preparation
- Copy reference background images to webapp:
  - `webapp/images/interior_room_ref.jpg` (from `media_1788804376164.jpg` / `input_file_1.png`)
  - `webapp/images/daylight_sky_ref.jpg` (from `media_1788804380294.jpg` / `input_file_2.png`)
- Verify `/models/dc with int.glb` is served by Flask.

### 3. Frontend Dashboard (`webapp/index.html` & `webapp/css/style.css`)
- **Header**:
  - Logo: 3D blue cube logo, `DC HEALTH AI`, `Predict • Explain • Visualize • Prevent`
  - Title: `Data Center Command Center`
  - Subtitle: `Real-time Monitoring | AI-powered Insights | Reliable Operations`
  - KPI Cards: Healthy Servers (`24`, 86%), At Risk (`3`, 11%), Critical (`1`, 3%), Total Servers (`28`, 38 Metrics/Server)
  - Status pill: `● System Live - All systems operational`
  - Right controls: ☀️ Sun toggle, 🔔 Bell (3), `CM` Chaitu Maya avatar, Live date/time
- **Sidebar**:
  - `Dashboard` (active blue pill with home icon)
  - Navigation links: `Infrastructure`, `Servers`, `Analytics`, `Alerts` (3), `Logs`, `AI Assistant`, `Reports`, `Settings`
  - Bottom graphic card: Modern mountain vector with *"Healthy Infrastructure Builds a Brighter Tomorrow"*
- **Center 3D Viewport**:
  - Top-left dropdown: `[ 🧊 3D View ▾ ]`
  - Top-right presets: `[Overview] [Left] [Right] [Top] [⛶]`
  - Bottom controls: `🖱️ Rotate | 🔍 Zoom | ✋ Pan | 🔄 Reset View`
- **Bottom 3 Cards**:
  - Card 1: `Server Health Distribution` donut chart (24 Healthy, 3 At Risk, 1 Critical, 28 Total)
  - Card 2: `Risk Trend (Last 24 Hours)` area spline with red peak at 20:40: `Risk: 87% (20:40)`
  - Card 3: `Recent Alerts` list:
    - 🔺 `R-09` High memory usage detected (2 min ago)
    - 🔺 `R-08` Disk I/O above threshold (14 min ago)
    - 🔺 `R-03` CPU usage anomaly (1 hr ago)
    - ℹ️ `R-12` Network latency increased (2 hrs ago)
- **Selected Server Inspector**:
  - Server ID: `R-09` with `< >` controls and `⚠️ Critical` badge
  - Tabs: `[Overview] [Metrics] [Logs] [AI Insight]`
  - Health score circular gauge: `13 / 100` (red)
  - Metrics: Uptime `12 days 4 hrs`, Model Risk `87%`, Predicted Failure `~ 17 minutes`
  - Resource usage: CPU 92%, Memory 78%, Disk I/O 65%, Network 41%
  - AI Insight (LLM): High risk alert, Groq RCA text, recommended actions, and `Ask AI for more details` button
- **Footer**:
  - 5 benefit items: `Real-time Monitoring`, `Early Warnings`, `Faster Incident Response`, `Lower Operational Cost`, `Higher Reliability`
  - Right: `AIOps for a Smarter Tomorrow →`

### 4. 3D Digital Twin Engine (`webapp/js/scene_3d.js`)
- Load `/models/dc with int.glb` directly or seamlessly project the daylight sky (`input_file_2.png`) and room interior projection (`input_file_1.png`).
- Position the two server rack clusters:
  - Cluster 1 (Left): `R-01`, `R-02`, `R-03`, `R-04`, `R-05` (nominal green LEDs).
  - Cluster 2 (Right): `R-06`, `R-07` (green), `R-08` (amber), `R-09` (red glowing critical alert), `R-10` (green).
- Interactive clicking on any rack selects it and updates the right inspector with real telemetry.

---

## Verification Plan
1. **Document Verification**: Confirm `Data_Center_Health_AI_Project_Documentation.pdf` and `.docx` are generated, valid, and contain all project details.
2. **Visual Verification via `browser_subagent`**: Open `http://localhost:8000/`, capture screenshots, and confirm 1-to-1 visual fidelity with `input_file_0.png`.
3. **Interactive Testing**: Test rack clicking (`R-01` to `R-10`), tabs switching, camera presets, and auto-remediation.
