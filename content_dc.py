# -*- coding: utf-8 -*-
"""Content for the Data Center Health AI architecture design document.
Simple, clear English. Structure consumed by generate_body.py.

Block types: p (paragraph), bullets, callout, table, code, figure, quote, h2, h3
"""

DOC_TITLE = "Data Center Health AI - Project Architecture Design"
DOC_AUTHOR = "Chaitanya Kiran"
DOC_SUBJECT = "AIOps portfolio project: server failure prediction with ML, LSTM, LLM and a Three.js 3D dashboard"

# ---------------- Section 1 ----------------
S1_TITLE = "1. Project Overview"
S1_PARAS = [
    ("Data Center Health AI is an end-to-end AIOps system that watches the vital signs of servers and "
     "predicts failures before they happen. It reads time-series metrics such as CPU load, memory usage, "
     "disk activity and network throughput, learns what a healthy server looks like, and raises an early "
     "warning when the pattern starts to drift. A large language model then explains the warning in plain "
     "English, so an engineer can act in minutes instead of hours. Everything is presented on a live 3D "
     "server-room dashboard built with Three.js, where every rack glows green, orange or red based on its "
     "risk score."),
    ("This project sits in the AIOps (Artificial Intelligence for IT Operations) space, one of the fastest "
     "growing areas for AI engineering jobs in IT companies. Every cloud provider, bank and startup runs "
     "data centers or pays for them, and every one of them wants fewer surprises at 3 a.m. Recruiters "
     "recognize the problem immediately, because it maps directly to observability and monitoring products "
     "they already know. Compared with a generic dashboard project, this one combines classical ML, deep "
     "learning, LLM reasoning and real-time 3D visualization in a single system, which makes it very hard "
     "for other candidates to copy."),
    ("For your portfolio, this project is the IT-domain sibling of your Predictive Maintenance engine "
     "project. The engine project proves you can work with industrial sensor data; this one proves you can "
     "apply the same skill set to pure IT infrastructure, which is exactly what startup AI teams do every "
     "day. Together they tell a clear story: an engineer who turns messy machine data into early warnings "
     "and beautiful, decision-ready interfaces."),
]
S1_CALLOUTS = [
    ("38 × 28", "metrics per server × servers in the SMD dataset"),
    ("5 weeks", "of continuous recordings with failure labels"),
    ("3 models", "Isolation Forest + LSTM Autoencoder + LLM analyzer"),
]
S1_LEARN = [
    ("<b>Time-series anomaly detection</b> - find abnormal patterns in streaming metrics, the core AIOps skill."),
    ("<b>Deep learning that means something</b> - an LSTM Autoencoder trained on a real labeled dataset."),
    ("<b>LLM integration</b> - turn raw error logs into human-readable root-cause summaries with the Groq API."),
    ("<b>Real-time engineering</b> - WebSocket streaming, live dashboards and scheduled inference."),
    ("<b>Production habits</b> - Docker, a slim cloud deployment and a results-first README."),
]

# ---------------- Section 2 ----------------
S2_TITLE = "2. System Architecture"
S2_PARAS = [
    ("The system follows the same proven pattern as your Predictive Maintenance project: data flows up "
     "through five clean layers, and each layer can be built and tested on its own. Metrics and logs enter "
     "at the bottom, get cleaned and windowed, pass through the three-model AI engine, and leave as a "
     "simple risk score with a root-cause note. A Flask REST API with WebSocket support serves predictions "
     "to the browser, while PostgreSQL keeps the history so you can prove the system caught failures in "
     "the past. Keeping the layers separate matters when you deploy: a slim API container can run on a "
     "small cloud instance even when heavy training happened offline."),
]
S2_FIG_CAPTION = "Figure 1: Data Center Health AI - five-layer system architecture"
S2_FLOW = ("Reading the diagram from top to bottom is also the order in which you will build it. Start with the "
           "dataset and feature windows, add the Isolation Forest baseline, then the LSTM Autoencoder, then the "
           "LLM log analyzer, and only then wire up the API and the 3D dashboard. Each arrow is a simple contract: "
           "a NumPy window goes in, a JSON prediction comes out. If a layer breaks, you always know which contract "
           "failed.")
S2_TABLE_CAPTION = "Table 1: Architecture components and their jobs"
S2_TABLE_HEAD = ["Layer", "Component", "Technology", "What it does"]
S2_TABLE_ROWS = [
    ["Data sources", "Server metrics + logs", "SMD dataset, loghub", "Raw sensor time-series and system event logs"],
    ["Processing", "Features + log parser", "pandas, NumPy", "Cleaning, normalization, sliding windows, log templates"],
    ["AI engine", "IF + LSTM-AE + LLM", "scikit-learn, PyTorch, Groq", "Anomaly scoring, sequence detection, root-cause text"],
    ["API layer", "REST + WebSocket", "Flask, PostgreSQL", "Serves predictions, stores history, pushes live updates"],
    ["Presentation", "3D dashboard", "Three.js, Docker", "Server-room view with live rack health and alerts"],
]
S2_TABLE_WIDTHS = [0.16, 0.24, 0.24, 0.36]

# ---------------- Section 3 ----------------
S3_TITLE = "3. Dataset - Links and Details"
S3_PARAS = [
    ("The main dataset is the Server Machine Dataset (SMD), published by Tsinghua University with the "
     "OmniAnomaly research paper. It contains five weeks of production recordings from internet-company "
     "servers, with 38 metrics per machine such as CPU, memory, disk and network counters. Best of all, "
     "every test window already has an anomaly label, so you can compute honest precision and recall "
     "numbers instead of guessing. The dataset is small enough to train on a laptop, which keeps your "
     "iteration loop fast."),
    ("For the log side of the project, use the loghub collection. It hosts real event logs from HPC and "
     "cloud systems such as BGL and HDFS, with ready-made templates parsed by researchers. You only need "
     "one log file to make the LLM analyzer shine: feed raw error lines to the Groq API and let it "
     "summarize what happened and which component is likely to blame. Azure public VM traces are an "
     "optional third source if you want extra CPU patterns for demo purposes."),
]
S3_TABLE_CAPTION = "Table 2: Download links (all free and verified)"
S3_TABLE_HEAD = ["Dataset", "What you get", "Link"]
S3_TABLE_ROWS = [
    ["Server Machine Dataset (SMD)", "38 metrics × 28 servers, 5 weeks, labeled anomalies",
     "github.com/NetManAIOps/OmniAnomaly"],
    ["Loghub (BGL, HDFS and more)", "Real system logs with parse templates for the LLM analyzer",
     "github.com/logpai/loghub"],
    ["Azure Public VM Traces", "Optional extra CPU-utilization traces from Azure VMs",
     "github.com/Azure/AzurePublicDataset"],
]
S3_TABLE_WIDTHS = [0.30, 0.40, 0.30]
S3_STEPS = [
    "Download SMD from the OmniAnomaly GitHub page (the data lives in the ServerMachineDataset folder).",
    "Pick 3 to 5 machines first - train on machine 1-1, and keep 1-2 and 2-1 for testing.",
    "Build sliding windows of 60 time steps for training and 120 steps for the live demo stream.",
    "Normalize each metric with a scaler fitted on training data only, then save the scaler for the API.",
    "Keep the anomaly labels aside; they are only used for evaluation, never during training.",
]

# ---------------- Section 4 ----------------
S4_TITLE = "4. AI Models and Training Plan"
S4_PARAS = [
    ("Use three models in increasing order of complexity, exactly like a real ML team would. The Isolation "
     "Forest is your day-one baseline: it trains in seconds on tabular windows and gives you a working "
     "end-to-end demo immediately. The LSTM Autoencoder is the star of the project - you train it only on "
     "normal data, it learns the rhythm of a healthy server, and when reconstruction error spikes you know "
     "something abnormal is happening. Finally, the LLM log analyzer does not detect anything by itself; "
     "it reads the raw log lines around a detected anomaly and returns a short root-cause explanation "
     "through the Groq API, the same skill you already used in your RAG chatbot."),
    ("Evaluate every model on the labeled test machines and report precision, recall and F1 score. "
     "Precision answers: when the system cries wolf, how often is it right? Recall answers: of all real "
     "failures, how many did it catch? For an operations product, recall matters more, because a missed "
     "failure costs far more than a false alarm. Tune the anomaly threshold on a validation split, never "
     "on the test set, and save one confusion-matrix image for your README - recruiters love seeing it."),
]
S4_TABLE_CAPTION = "Table 3: Model plan (targets to print in your README)"
S4_TABLE_HEAD = ["Model", "Input", "Output", "Library", "Target"]
S4_TABLE_ROWS = [
    ["Isolation Forest", "Feature window (flat vector)", "Anomaly score 0-1", "scikit-learn", "F1 ≥ 0.80"],
    ["LSTM Autoencoder", "Sequence window (60 × 38)", "Reconstruction error", "PyTorch", "F1 ≥ 0.87"],
    ["LLM Log Analyzer", "Raw log lines + anomaly context", "Root-cause summary text", "Groq API", "Human review"],
]
S4_TABLE_WIDTHS = [0.20, 0.26, 0.22, 0.16, 0.16]
S4_TIPS = [
    "The data is highly imbalanced - anomalies are rare, so accuracy is a useless metric here; always print precision, recall and F1.",
    "Pick the anomaly threshold as a percentile of validation reconstruction error (for example the 99th percentile), then freeze it.",
    "Batch LLM calls with a small cache so the demo stays fast and your free Groq quota lasts.",
    "Save every model with joblib or torch.save into an artifacts folder, exactly like your engine project.",
]

# ---------------- Section 5 ----------------
S5_TITLE = "5. 3D Dashboard Design"
S5_PARAS = [
    ("The dashboard is your signature layer, and the good news is that you do not need a downloaded 3D "
     "model to make it look great. A server room reads instantly as rows of racks: simple BoxGeometry "
     "towers with a dark metal material, small emissive unit lights per server, and a soft floor with a "
     "grid. Each rack gets a status color driven by the live risk score - green below 40, orange from 40 "
     "to 70, red above 70 - and a short pulse animation when the level changes. Clicking a rack opens a "
     "side panel with live gauges, the anomaly timeline and the LLM root-cause note, which turns the "
     "scene from decoration into a genuine operations tool."),
    ("Data reaches the scene through a WebSocket pushed by the Flask API every few seconds, so racks "
     "change color while you watch, exactly like the live engine view you already built. Use OrbitControls "
     "so recruiters can drag and zoom the room themselves in the demo video. If you want a photoreal "
     "hero shot, drop a free GLTF model into the scene with GLTFLoader and keep the coded racks for the "
     "interactive part - the links below are all free-to-download sources."),
]
S5_TABLE_CAPTION = "Table 4: Free 3D model sources for the server room"
S5_TABLE_HEAD = ["Source", "What you find", "Link"]
S5_TABLE_ROWS = [
    ["Sketchfab - server room", "Downloadable GLTF/GLB scenes (check CC license on each model)",
     "sketchfab.com/search?features=downloadable&q=server+room"],
    ["Sketchfab - server rack", "Single racks and network cabinets for close-up shots",
     "sketchfab.com/search?features=downloadable&q=server+rack"],
    ["Poly Pizza", "Low-poly free models, fast to load, great for stylized rooms",
     "poly.pizza"],
]
S5_TABLE_WIDTHS = [0.24, 0.42, 0.34]
S5_CODE_LABEL = "Loading a model in Three.js"
S5_CODE = [
    "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';",
    "",
    "const loader = new GLTFLoader();",
    "loader.load('models/server_room.glb', (gltf) => {",
    "    scene.add(gltf.scene);          // place the room",
    "    tagRacks(gltf.scene);           // attach risk data to each rack",
    "});",
]
S5_TIP = ("License tip: on Sketchfab every model shows its license (CC0, CC-BY, CC-BY-SA). Prefer CC0 for zero "
          "worries; for CC-BY simply credit the artist in your README. Avoid models marked Editorial Use Only.")

# ---------------- Section 6 ----------------
S6_TITLE = "6. Tech Stack and Project Structure"
S6_PARAS = [
    ("The stack is deliberately close to your engine project so most of your skills transfer on day one: "
     "Python and pandas for data work, scikit-learn and PyTorch for models, Flask for the API, PostgreSQL "
     "for storage, Three.js for the 3D view, and Docker for deployment. The one lesson from your Render "
     "deployment is baked in here: keep a slim requirements file for the cloud that excludes heavy "
     "training libraries such as PyTorch, because the free tier only has about 512 MB of memory. Train "
     "locally, export the fitted models to the artifacts folder, and let the cloud container only load "
     "and serve them."),
]
S6_TABLE_CAPTION = "Table 5: Tech stack at a glance"
S6_TABLE_HEAD = ["Layer", "Tools"]
S6_TABLE_ROWS = [
    ["Data processing", "Python 3.10, pandas, NumPy, scikit-learn preprocessing"],
    ["Models", "scikit-learn (Isolation Forest), PyTorch (LSTM-AE), Groq API (LLM)"],
    ["API + storage", "Flask, Flask-CORS, WebSocket (flask-sock), PostgreSQL or SQLite"],
    ["3D dashboard", "Three.js, OrbitControls, GLTFLoader, vanilla JS or Vite"],
    ["Deployment", "Docker, gunicorn, Render free tier (slim requirements)"],
]
S6_TABLE_WIDTHS = [0.30, 0.70]
S6_CODE_LABEL = "Project structure"
S6_CODE = [
    "data-center-health-ai/",
    "|-- artifacts/            trained models + scaler (.pkl, .pt)",
    "|-- data/                 SMD files, log samples (gitignored)",
    "|-- notebooks/            01_eda, 02_baseline_if, 03_lstm_ae",
    "|-- src/",
    "|   |-- api/              app.py, websocket.py",
    "|   |-- ml/               if_model.py, lstm_ae.py, llm_logs.py",
    "|   |-- pipeline/         feature_engine.py, inference.py",
    "|   +-- database/         db.py, models.py",
    "|-- webapp/",
    "|   |-- index.html        Three.js dashboard",
    "|   +-- js/               scene.js, racks.js, live.js",
    "|-- Dockerfile",
    "|-- requirements.txt",
    "+-- requirements-render.txt   slim set for cloud",
]
S6_DEPLOY = ("Cloud deployment recipe: train locally, commit only the small artifacts, and give Render a "
             "requirements-render.txt that contains just Flask, pandas, NumPy, scikit-learn, joblib, "
             "psycopg2-binary, gunicorn and flask-sock. Bind the port with the shell form "
             "CMD gunicorn -b 0.0.0.0:${PORT:-8000} app:app so the $PORT variable actually expands, and keep "
             "PyTorch out of the container - the API only needs joblib and the exported weights.")

# ---------------- Section 7 ----------------
S7_TITLE = "7. Four-Week Build Plan"
S7_PARAS = [
    ("Four focused weeks is enough if you keep the MVP mindset: a boring working system first, a "
     "beautiful one second. Week one is pure data - download SMD, explore a few machines, build the "
     "window pipeline and train the Isolation Forest so something end-to-end already runs. Week two "
     "belongs to the LSTM Autoencoder and the honest metrics table. Week three wires the Flask API, "
     "WebSocket stream and the first version of the 3D room. Week four adds the LLM log analyzer, the "
     "demo GIF, the README, Docker and the Render deployment. If a week slips, cut features from the "
     "end of the list, never the evaluation step - the metrics table is what makes recruiters trust the "
     "project."),
]
S7_TABLE_CAPTION = "Table 6: Week-by-week plan with clear deliverables"
S7_TABLE_HEAD = ["Week", "Goal", "You finish with"]
S7_TABLE_ROWS = [
    ["Week 1", "Data + baseline", "Windows pipeline, EDA notebook, Isolation Forest score on machine 1-1"],
    ["Week 2", "Deep model", "Trained LSTM Autoencoder, precision / recall / F1 table, confusion matrix"],
    ["Week 3", "API + 3D room", "Flask + WebSocket live, Three.js racks changing color with risk score"],
    ["Week 4", "LLM + ship it", "Groq root-cause panel, demo GIF, README, Docker, live Render link"],
]
S7_TABLE_WIDTHS = [0.12, 0.22, 0.66]

# ---------------- Section 8 ----------------
S8_TITLE = "8. Resume Lines and GitHub Checklist"
S8_PARAS = [
    ("When the project ships, add it to your resume with lines that lead with numbers and outcomes, not "
     "tools. Pick the two or three lines below that match the job you are applying to, and keep the "
     "metrics exactly as measured in your README. Recruiters skim for verbs and results, so start each "
     "line with Built, Trained, Reduced or Designed, and let the linked demo do the convincing."),
]
S8_BULLETS = [
    "Built an end-to-end AIOps system that predicts server failures from 38 live metrics, cutting warning time to minutes before crash on labeled SMD test machines.",
    "Trained an LSTM Autoencoder anomaly detector (PyTorch) that reached F1 of X.XX, beating an Isolation Forest baseline by X.XX on precision.",
    "Integrated the Groq LLM API to convert raw system logs into root-cause summaries, reducing incident triage steps for on-call engineers.",
    "Designed a real-time Three.js 3D server-room dashboard with WebSocket updates, where rack health colors and alerts update live for every machine.",
    "Shipped the service with Docker on Render using a slim inference-only image under 800 MB, with REST + WebSocket endpoints and PostgreSQL history.",
]
S8_CHECK = [
    "Public repo with a README that opens with the demo GIF and a one-line value statement.",
    "Results table (precision, recall, F1 per model) near the top of the README.",
    "Architecture diagram (Figure 1 of this document) embedded in the README.",
    "Dockerfile + requirements-render.txt committed, live demo link on Render in the README header.",
    "Clean commit history with meaningful messages - recruiters do read them.",
]
S8_CLOSE = ("With this project live next to your Predictive Maintenance engine and your RAG talking-head "
            "avatar, your portfolio covers industrial AI, IT operations AI and generative AI - three "
            "domains, one consistent style, and a 3D signature that nobody else in the applicant pile will "
            "have. That is the story you tell in interviews, one project at a time.")
