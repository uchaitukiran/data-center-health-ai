"""
Notebook Executor and Rich Output Injector
Executes 01_eda_and_data_engineering.ipynb and 02_model_benchmarking_and_evaluation.ipynb,
saving all charts, tables, stdout and markdown into the .ipynb files.
"""

import sys
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import json
from pathlib import Path
import nbformat
from nbclient import NotebookClient

def fix_and_execute_notebook(nb_path: Path):
    print(f"Loading {nb_path.name}...")
    with open(nb_path, "r", encoding="utf-8") as f:
        nb = nbformat.read(f, as_version=4)

    # Ensure json is imported in 01
    if "01_eda" in nb_path.name:
        for cell in nb.cells:
            if cell.cell_type == "code" and "SMD_SENSOR_NAMES" in cell.source:
                if "import json" not in cell.source:
                    cell.source = "import json\n" + cell.source

    # Update cell 3 in 02 to use real dataset slices
    if "02_model" in nb_path.name:
        for cell in nb.cells:
            if cell.cell_type == "code" and "inference_engine" in cell.source:
                cell.source = """from src.ml.model_registry import inference_engine

# 1. Score real ground-truth nominal telemetry
df_train = pd.read_csv(project_root / 'data' / 'processed' / 'machine-1-1_train_scaled.csv')
nom_slice = df_train.iloc[:60].values
nom_raw = inference_engine.scaler.inverse_transform(nom_slice)
nominal_score = inference_engine.score_telemetry(nom_raw)

# 2. Score real ground-truth anomaly telemetry segment
df_test = pd.read_csv(project_root / 'data' / 'processed' / 'machine-1-1_test_scaled.csv')
df_labels = pd.read_csv(project_root / 'data' / 'processed' / 'machine-1-1_test_labels.csv')
anom_idx = int(np.where(df_labels.iloc[:, 0].values == 1)[0][0])
anom_slice = df_test.iloc[anom_idx:anom_idx+60].values
anom_raw = inference_engine.scaler.inverse_transform(anom_slice)
anomaly_score = inference_engine.score_telemetry(anom_raw)

print("Nominal Telemetry Scoring:", nominal_score)
print("Anomaly Telemetry Scoring:", anomaly_score)

assert nominal_score['severity'] == 'NORMAL', "Nominal telemetry must be normal!"
assert anomaly_score['risk_score'] >= 50.0, "Anomaly telemetry must trigger elevated risk!"
print("✅ Champion Model Production Scoring Verified Successfully!")"""

    print(f"Executing {nb_path.name}...")
    client = NotebookClient(
        nb,
        timeout=600,
        kernel_name="python3",
        resources={"metadata": {"path": str(nb_path.parent)}}
    )
    client.execute()

    with open(nb_path, "w", encoding="utf-8") as f:
        nbformat.write(nb, f)
    print(f"[SUCCESS] Successfully executed and persisted rich outputs in {nb_path.name}")

if __name__ == "__main__":
    base = Path(__file__).resolve().parent.parent / "notebooks"
    fix_and_execute_notebook(base / "01_eda_and_data_engineering.ipynb")
    fix_and_execute_notebook(base / "02_model_benchmarking_and_evaluation.ipynb")
    print("[ALL NOTEBOOKS EXECUTED AND FULLY POPULATED WITH RICH OUTPUTS]")
