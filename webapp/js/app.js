/**
 * Main Application Orchestrator
 * Connects 3D Scene, WebSocket Stream, UI Inspector Drawer, and Model Benchmark Modal.
 */

import { DataCenterScene } from './scene_3d.js';
import { RackManager } from './rack_manager.js';

class App {
  constructor() {
    this.scene = new DataCenterScene('canvas-container');
    this.rackManager = new RackManager(this.scene);
    this.selectedRackId = null;
    this.socket = null;

    this.initUI();
    this.connectWebSocket();
    this.loadChampionMetadata();
  }

  initUI() {
    // Click on 3D Rack callback
    this.scene.onRackClickCallback = (rackId) => {
      this.selectedRackId = rackId;
      this.renderDrawer(rackId);
    };

    // Close Drawer
    document.getElementById('drawer-close-btn').addEventListener('click', () => {
      document.getElementById('inspector-drawer').style.display = 'none';
      this.selectedRackId = null;
    });

    // Reset Camera Button
    document.getElementById('btn-reset-cam').addEventListener('click', () => {
      this.scene.resetCamera();
    });

    // Benchmark Report Modal
    const modal = document.getElementById('benchmark-modal');
    document.getElementById('btn-benchmark-report').addEventListener('click', () => {
      this.openBenchmarkModal();
    });
    document.getElementById('modal-close-btn').addEventListener('click', () => {
      modal.style.display = 'none';
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }

  async loadChampionMetadata() {
    try {
      const res = await fetch('/api/models/champion');
      if (res.ok) {
        const data = await res.json();
        document.getElementById('champion-badge').innerText = `CHAMPION: ${data.champion_model_name}`;
      }
    } catch (e) {
      console.warn('Could not fetch champion model info:', e);
    }
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;

    console.log(`[App] Connecting to WebSocket telemetry stream: ${wsUrl}`);
    this.socket = new WebSocket(wsUrl);

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onTelemetryFrame(data);
      } catch (err) {
        console.error('[App] Failed to parse WebSocket frame:', err);
      }
    };

    this.socket.onclose = () => {
      console.warn('[App] WebSocket closed. Reconnecting in 3s...');
      setTimeout(() => this.connectWebSocket(), 3000);
    };

    this.socket.onerror = (err) => {
      console.error('[App] WebSocket error:', err);
    };
  }

  onTelemetryFrame(frame) {
    // 1. Update Top Navbar Global Stats
    const stats = frame.global_stats;
    if (stats) {
      document.getElementById('stat-healthy').innerText = stats.healthy;
      document.getElementById('stat-warning').innerText = stats.warning;
      document.getElementById('stat-critical').innerText = stats.critical;
      document.getElementById('stat-mean-risk').innerText = `${stats.avg_risk}%`;
      if (stats.champion_model) {
        document.getElementById('champion-badge').innerText = `CHAMPION: ${stats.champion_model}`;
      }
    }

    // 2. Update 3D Rack Emissive Colors
    this.rackManager.updateRacks(frame.racks);

    // 3. Update Side Inspector if a rack is currently selected
    if (this.selectedRackId) {
      this.renderDrawer(this.selectedRackId);
    }
  }

  renderDrawer(rackId) {
    const data = this.rackManager.getRackData(rackId);
    if (!data) return;

    const drawer = document.getElementById('inspector-drawer');
    drawer.style.display = 'block';

    document.getElementById('drawer-rack-id').innerText = data.rack_id;
    document.getElementById('drawer-node-name').innerText = `${data.name} (${data.node_id})`;

    const circle = document.getElementById('drawer-risk-circle');
    const riskVal = document.getElementById('drawer-risk-val');
    const severityLabel = document.getElementById('drawer-severity');

    riskVal.innerText = Math.round(data.risk_score);
    severityLabel.innerText = data.severity;

    // Update risk circle color & glow
    circle.style.borderColor = data.color;
    circle.style.boxShadow = `0 0 25px ${data.color}55`;
    riskVal.style.color = data.color;

    // Metrics
    document.getElementById('drawer-cpu').innerText = `${data.cpu_util}%`;
    document.getElementById('drawer-mem').innerText = `${data.mem_util}%`;
    document.getElementById('drawer-disk').innerText = `${data.disk_io} IOPS`;
    document.getElementById('drawer-temp').innerText = `${data.temp_c}°C`;

    // RCA Diagnosis Card
    const rcaBox = document.getElementById('drawer-rca-box');
    if (data.severity === "CRITICAL" || data.severity === "WARNING") {
      rcaBox.style.display = 'block';
      document.getElementById('drawer-rca-text').innerText = 
        `Anomaly detected on ${data.anomalous_sensors.join(', ') || 'System Load'}. Pattern indicates operational stress.`;
      document.getElementById('drawer-rca-action').innerText = 
        `Action: Initiate telemetry diagnostic trace on ${data.node_id}.`;
    } else {
      rcaBox.style.display = 'none';
    }
  }

  async openBenchmarkModal() {
    const modal = document.getElementById('benchmark-modal');
    modal.style.display = 'flex';

    try {
      const [modelsRes, reportRes] = await Promise.all([
        fetch('/api/models'),
        fetch('/api/report')
      ]);

      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        this.renderBenchmarkTable(modelsData.models);
      }

      if (reportRes.ok) {
        const reportData = await reportRes.json();
        document.getElementById('technical-report-content').innerText = reportData.report_markdown;
      }
    } catch (e) {
      console.error('Failed to load benchmark data:', e);
    }
  }

  renderBenchmarkTable(models) {
    const container = document.getElementById('benchmark-table-container');
    if (!models || models.length === 0) {
      container.innerHTML = '<p>No candidate benchmark data available yet.</p>';
      return;
    }

    // Sort by PA-F1 score descending
    models.sort((a, b) => (b.pa_f1_score || 0) - (a.pa_f1_score || 0));
    const championName = models[0].model_name;

    let html = `
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>Candidate Model</th>
            <th>Point-Adj F1 (PA-F1)</th>
            <th>Standard F1</th>
            <th>Precision</th>
            <th>Recall</th>
            <th>PR-AUC</th>
            <th>ROC-AUC</th>
            <th>Latency (ms)</th>
          </tr>
        </thead>
        <tbody>
    `;

    models.forEach((m, idx) => {
      const isChamp = idx === 0;
      html += `
        <tr class="${isChamp ? 'champion-row' : ''}">
          <td>
            <strong>${m.model_name}</strong>
            ${isChamp ? '<span class="champion-tag">CHAMPION</span>' : ''}
          </td>
          <td style="color: var(--neon-green); font-weight: 700;">${m.pa_f1_score.toFixed(4)}</td>
          <td>${m.f1_score.toFixed(4)}</td>
          <td>${m.precision.toFixed(4)}</td>
          <td>${m.recall.toFixed(4)}</td>
          <td>${m.pr_auc.toFixed(4)}</td>
          <td>${m.roc_auc.toFixed(4)}</td>
          <td>${m.latency_ms.toFixed(3)} ms</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }
}

// Instantiate on load
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
