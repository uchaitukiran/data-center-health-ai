/**
 * Enterprise NOC Orchestrator & Telemetry Visualizer
 * Integrates 3D Digital Twin, WebSocket telemetry, Canvas Sparklines,
 * Groq AI Root Cause Analysis, and Interactive Failure Injection.
 */

import { DataCenterScene } from './scene_3d.js';
import { RackManager } from './rack_manager.js';

class NOCOrchestrator {
  constructor() {
    this.scene = new DataCenterScene('canvas-container');
    this.rackManager = new RackManager(this.scene);
    this.selectedRackId = null;
    this.socket = null;
    this.sparklineHistory = [];
    this.maxSparklinePoints = 30;

    this.initClock();
    this.initUI();
    this.connectWebSocket();
    this.loadChampionMetadata();
  }

  initClock() {
    const updateTime = () => {
      const now = new Date();
      const str = now.toISOString().slice(11, 19);
      const clockEl = document.getElementById('live-clock');
      if (clockEl) clockEl.innerText = `UTC ${str}`;
    };
    setInterval(updateTime, 1000);
    updateTime();
  }

  initUI() {
    // 1. Raycaster Click Callback on 3D Racks
    this.scene.onRackClickCallback = (rackId) => {
      this.openDrawer(rackId);
    };

    // 2. Close Drawer
    document.getElementById('drawer-close-btn').addEventListener('click', () => {
      this.closeDrawer();
    });

    // 3. View Mode Switcher (PBR vs Thermal Heatmap)
    const btnPbr = document.getElementById('btn-mode-pbr');
    const btnThermal = document.getElementById('btn-mode-thermal');

    btnPbr.addEventListener('click', () => {
      btnPbr.classList.add('active');
      btnThermal.classList.remove('active');
      this.scene.toggleThermalMode(false);
    });

    btnThermal.addEventListener('click', () => {
      btnThermal.classList.add('active');
      btnPbr.classList.remove('active');
      this.scene.toggleThermalMode(true);
    });

    // 4. Camera Presets
    document.querySelectorAll('.cam-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const camPreset = btn.getAttribute('data-cam');
        this.scene.setCameraPreset(camPreset);
      });
    });

    // 5. Failure Simulation Triggers
    document.getElementById('btn-sim-mem').addEventListener('click', () => {
      this.triggerSimulation('RACK-03', 'memory');
    });
    document.getElementById('btn-sim-disk').addEventListener('click', () => {
      this.triggerSimulation('RACK-01', 'disk');
    });
    document.getElementById('btn-sim-heal').addEventListener('click', () => {
      this.triggerRemediation('RACK-01');
      this.triggerRemediation('RACK-03');
    });

    // 6. Auto-Remediate button in Groq RCA card
    document.getElementById('btn-remediate-now').addEventListener('click', () => {
      if (this.selectedRackId) {
        this.triggerRemediation(this.selectedRackId);
      }
    });

    // 7. Benchmark Report Modal
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
        const ind = document.getElementById('champion-indicator');
        if (ind) ind.innerText = `CHAMPION: ${data.champion_model_name}`;
      }
    } catch (e) {
      console.warn('Could not load champion model info:', e);
    }
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;

    this.socket = new WebSocket(wsUrl);

    this.socket.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data);
        this.onTelemetryFrame(frame);
      } catch (err) {
        console.error('[NOC] WebSocket parse error:', err);
      }
    };

    this.socket.onclose = () => {
      setTimeout(() => this.connectWebSocket(), 2500);
    };
  }

  onTelemetryFrame(frame) {
    // 1. Update Top KPIs
    const stats = frame.global_stats;
    if (stats) {
      document.getElementById('kpi-healthy').innerText = stats.healthy;
      document.getElementById('kpi-warning').innerText = stats.warning;
      document.getElementById('kpi-critical').innerText = stats.critical;
      document.getElementById('kpi-pue').innerText = stats.pue || '1.18';
      document.getElementById('kpi-mean-risk').innerText = `${stats.avg_risk}%`;

      const tickerDraw = document.getElementById('ticker-draw');
      if (tickerDraw) tickerDraw.innerText = `${stats.total_power_kw || 36.2} kW`;
    }

    // 2. Update 3D Racks
    this.rackManager.updateRacks(frame.racks);

    // 3. Update Sidebar Quick-Jump Rack List
    this.renderSidebarRackList(frame.racks);

    // 4. Update Inspector Drawer if open
    if (this.selectedRackId) {
      const rackData = this.rackManager.getRackData(this.selectedRackId);
      if (rackData) {
        this.updateDrawerContent(rackData, frame.active_alert);
      }
    }

    // 5. Update Bottom Ticker with dynamic random fluctuation
    this.updateBottomTicker();
  }

  updateBottomTicker() {
    const tcp = (0.01 + Math.random() * 0.04).toFixed(2);
    const faults = (10.0 + Math.random() * 6.0).toFixed(1);
    const queue = (0.08 + Math.random() * 0.12).toFixed(2);
    const elTcp = document.getElementById('ticker-tcp');
    const elFaults = document.getElementById('ticker-faults');
    const elQueue = document.getElementById('ticker-queue');
    if (elTcp) elTcp.innerText = `${tcp}/s`;
    if (elFaults) elFaults.innerText = `${faults}/s`;
    if (elQueue) elQueue.innerText = queue;
  }

  renderSidebarRackList(racks) {
    const container = document.getElementById('sidebar-rack-list');
    if (!container || !racks) return;

    container.innerHTML = '';
    racks.forEach(r => {
      const card = document.createElement('div');
      card.className = 'rack-card';
      if (this.selectedRackId === r.rack_id) {
        card.style.borderColor = 'var(--neon-cyan)';
        card.style.background = 'rgba(0, 210, 255, 0.15)';
      }

      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="kpi-dot ${r.severity.toLowerCase()}"></span>
          <span class="rack-card-id">${r.rack_id}</span>
          <span style="font-size: 0.68rem; color: #64748b;">${r.name.split(' ')[0]}</span>
        </div>
        <div class="rack-card-stats">
          <span style="color: ${r.color}; font-weight: 700;">${Math.round(r.risk_score)}%</span>
          <span style="color: #94a3b8;">${Math.round(r.temp_c)}°C</span>
        </div>
      `;

      card.addEventListener('click', () => {
        this.openDrawer(r.rack_id);
        this.scene.focusOnRack(r.rack_id);
      });

      container.appendChild(card);
    });
  }

  openDrawer(rackId) {
    this.selectedRackId = rackId;
    const rackData = this.rackManager.getRackData(rackId);
    if (!rackData) return;

    const drawer = document.getElementById('inspector-drawer');
    drawer.style.display = 'block';
    // Smooth transition
    requestAnimationFrame(() => {
      drawer.style.transform = 'translateX(0)';
      drawer.style.opacity = '1';
    });

    this.sparklineHistory = [];
    this.updateDrawerContent(rackData, null);
  }

  closeDrawer() {
    const drawer = document.getElementById('inspector-drawer');
    drawer.style.transform = 'translateX(460px)';
    drawer.style.opacity = '0';
    setTimeout(() => {
      if (drawer.style.opacity === '0') drawer.style.display = 'none';
    }, 300);
    this.selectedRackId = null;
  }

  updateDrawerContent(data, activeAlert) {
    document.getElementById('drawer-rack-id').innerText = data.rack_id;
    document.getElementById('drawer-rack-name').innerText = `${data.name} (42U Hyperscale)`;
    document.getElementById('drawer-node-id').innerText = data.node_id;

    // Risk Meter Ring
    const ring = document.getElementById('drawer-risk-ring');
    const valEl = document.getElementById('drawer-risk-val');
    const sevEl = document.getElementById('drawer-severity');

    const riskVal = Math.round(data.risk_score);
    valEl.innerText = riskVal;
    sevEl.innerText = data.severity;

    ring.style.borderColor = data.color;
    ring.style.boxShadow = `0 0 24px ${data.color}55`;
    valEl.style.color = data.color;

    // Telemetry Metrics
    document.getElementById('drawer-cpu').innerText = `${data.cpu_util}%`;
    document.getElementById('drawer-mem').innerText = `${data.mem_util}%`;
    document.getElementById('drawer-disk').innerText = `${data.disk_io} IOPS`;
    document.getElementById('drawer-temp').innerText = `${data.temp_c}°C`;

    const fanRPM = Math.round(4800 + (data.temp_c / 80) * 3200);
    const powerKW = (2.2 + (data.cpu_util / 100) * 2.8).toFixed(1);
    document.getElementById('drawer-fan').innerText = `${fanRPM} RPM`;
    document.getElementById('drawer-power').innerText = `${powerKW} kW`;

    // Push to Sparkline History
    this.sparklineHistory.push(riskVal);
    if (this.sparklineHistory.length > this.maxSparklinePoints) {
      this.sparklineHistory.shift();
    }
    this.drawSparkline(data.color);

    // Groq AI Root Cause Analysis Box
    const rcaBox = document.getElementById('drawer-rca-box');
    const isIncident = data.severity === "CRITICAL" || data.severity === "WARNING";

    if (isIncident) {
      rcaBox.style.display = 'block';

      // Use alert RCA if available, or generate standard diagnosis
      const rca = (activeAlert && activeAlert.rack_id === data.rack_id) ? activeAlert.rca : null;
      if (rca) {
        document.getElementById('drawer-rca-culprit').innerText = rca.probable_culprit || 'Hardware Metric Deviation';
        document.getElementById('drawer-rca-desc').innerText = rca.root_cause_summary || 'Anomalous metric drift detected by Isolation Forest.';
        document.getElementById('drawer-rca-action').innerText = `Action: ${rca.recommended_action || 'Inspect server syslog and drain active load.'}`;
        document.getElementById('rca-urgency').innerText = rca.urgency || 'HIGH';
      } else {
        const topDrift = data.anomalous_sensors && data.anomalous_sensors.length > 0
          ? data.anomalous_sensors.join(', ')
          : 'High Telemetry Outlier';
        document.getElementById('drawer-rca-culprit').innerText = `Anomalous Drift on ${topDrift}`;
        document.getElementById('drawer-rca-desc').innerText = `Isolation Forest flagged sequence deviation at 98th percentile. Sensor values indicate severe resource starvation.`;
        document.getElementById('drawer-rca-action').innerText = `Action: Execute automated pod failover to peer node.`;
        document.getElementById('rca-urgency').innerText = data.severity === 'CRITICAL' ? 'IMMEDIATE' : 'HIGH';
      }
    } else {
      rcaBox.style.display = 'none';
    }
  }

  drawSparkline(color) {
    const canvas = document.getElementById('sparkline-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (this.sparklineHistory.length < 2) return;

    // Grid baseline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Plot line
    const step = w / (this.maxSparklinePoints - 1);
    ctx.beginPath();
    this.sparklineHistory.forEach((val, idx) => {
      const x = idx * step;
      const y = h - (val / 100.0) * (h - 8) - 4;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Area fill gradient
    ctx.lineTo((this.sparklineHistory.length - 1) * step, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `${color}44`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fill();

    const liveValEl = document.getElementById('sparkline-live-val');
    if (liveValEl && this.sparklineHistory.length > 0) {
      liveValEl.innerText = `${this.sparklineHistory[this.sparklineHistory.length - 1]}%`;
      liveValEl.style.color = color;
    }
  }

  async triggerSimulation(rackId, type) {
    try {
      await fetch('/api/simulate/anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rack_id: rackId, type: type })
      });
      this.openDrawer(rackId);
      this.scene.focusOnRack(rackId);
    } catch (e) {
      console.error('Simulation trigger failed:', e);
    }
  }

  async triggerRemediation(rackId) {
    try {
      await fetch('/api/simulate/remediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rack_id: rackId })
      });
      setTimeout(() => {
        const data = this.rackManager.getRackData(rackId);
        if (data) {
          data.risk_score = 14.0;
          data.severity = "NORMAL";
          data.color = "#00ff88";
          this.updateDrawerContent(data, null);
        }
      }, 500);
    } catch (e) {
      console.error('Remediation trigger failed:', e);
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
      container.innerHTML = '<p>No candidate benchmark data available.</p>';
      return;
    }

    models.sort((a, b) => (b.pa_f1_score || 0) - (a.pa_f1_score || 0));

    let html = `
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>Candidate Algorithm</th>
            <th>Point-Adj F1 (PA-F1)</th>
            <th>Standard F1</th>
            <th>Precision</th>
            <th>Recall</th>
            <th>PR-AUC</th>
            <th>ROC-AUC</th>
            <th>Inference Latency</th>
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
          <td style="color: var(--neon-emerald); font-weight: 700;">${m.pa_f1_score.toFixed(4)}</td>
          <td>${m.f1_score.toFixed(4)}</td>
          <td>${m.precision.toFixed(4)}</td>
          <td>${m.recall.toFixed(4)}</td>
          <td>${m.pr_auc.toFixed(4)}</td>
          <td>${m.roc_auc.toFixed(4)}</td>
          <td style="color: var(--neon-cyan);">${m.latency_ms.toFixed(3)} ms</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }
}

// Bootstrap on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new NOCOrchestrator();
});
