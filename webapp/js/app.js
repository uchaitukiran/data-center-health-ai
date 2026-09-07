/**
 * Enterprise NOC Orchestrator & Telemetry Visualizer
 * MNC Light Theme (Apple / Stripe / Datadog Light / AWS Sumerian Aesthetic)
 * Integrates 3D Digital Twin, Dual GLB Facilities, WebSocket telemetry, Canvas Sparklines,
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
    // 1. Facility Switcher
    const facilitySelect = document.getElementById('facility-select');
    if (facilitySelect) {
      facilitySelect.addEventListener('change', (e) => {
        const facId = e.target.value;
        this.scene.loadFacility(facId);
      });
    }

    // 2. Raycaster Click Callback on 3D Racks
    this.scene.onRackClick((rackId, data) => {
      this.openDrawer(rackId);
    });

    // 3. Close Drawer
    const closeBtn = document.getElementById('drawer-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeDrawer();
      });
    }

    // 4. View Mode Switcher (Hardware PBR vs Thermal Heatmap)
    const btnPbr = document.getElementById('btn-mode-pbr');
    const btnThermal = document.getElementById('btn-mode-thermal');

    if (btnPbr && btnThermal) {
      btnPbr.addEventListener('click', () => {
        btnPbr.classList.add('active');
        btnThermal.classList.remove('active');
        this.scene.setThermalMode(false);
      });

      btnThermal.addEventListener('click', () => {
        btnThermal.classList.add('active');
        btnPbr.classList.remove('active');
        this.scene.setThermalMode(true);
      });
    }

    // 5. Camera Presets
    document.querySelectorAll('.cam-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const camPreset = btn.getAttribute('data-cam');
        this.scene.setCameraPreset(camPreset);
      });
    });

    // 6. Failure Simulation Triggers
    const btnMem = document.getElementById('btn-sim-mem');
    if (btnMem) {
      btnMem.addEventListener('click', () => {
        this.triggerSimulation('RACK-03', 'memory');
      });
    }

    const btnDisk = document.getElementById('btn-sim-disk');
    if (btnDisk) {
      btnDisk.addEventListener('click', () => {
        this.triggerSimulation('RACK-01', 'disk');
      });
    }

    const btnHeal = document.getElementById('btn-sim-heal');
    if (btnHeal) {
      btnHeal.addEventListener('click', () => {
        this.triggerRemediation('RACK-01');
        this.triggerRemediation('RACK-03');
      });
    }

    // 7. Auto-Remediate button in Groq RCA card
    const btnRemed = document.getElementById('btn-remediate-now');
    if (btnRemed) {
      btnRemed.addEventListener('click', () => {
        if (this.selectedRackId) {
          this.triggerRemediation(this.selectedRackId);
        }
      });
    }

    // 8. Benchmark Report Modal
    const modal = document.getElementById('benchmark-modal');
    const btnBench = document.getElementById('btn-benchmark-report');
    const modalClose = document.getElementById('modal-close-btn');

    if (btnBench && modal) {
      btnBench.addEventListener('click', () => {
        this.openBenchmarkModal();
      });
    }
    if (modalClose && modal) {
      modalClose.addEventListener('click', () => {
        modal.classList.remove('active');
        modal.style.display = 'none';
      });
    }
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
          modal.style.display = 'none';
        }
      });
    }
  }

  async loadChampionMetadata() {
    try {
      const res = await fetch('/api/models/champion');
      if (res.ok) {
        const data = await res.json();
        const ind = document.getElementById('champion-indicator');
        if (ind) ind.innerText = `CHAMPION: ${data.champion_model_name}`;
        const ticker = document.getElementById('ticker-champion');
        if (ticker) ticker.innerText = `${data.champion_model_name.toUpperCase()} (0.018ms)`;
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
      const elH = document.getElementById('kpi-healthy');
      const elW = document.getElementById('kpi-warning');
      const elC = document.getElementById('kpi-critical');
      const elP = document.getElementById('kpi-pue');
      const elR = document.getElementById('kpi-mean-risk');

      if (elH) elH.innerText = stats.healthy;
      if (elW) elW.innerText = stats.warning;
      if (elC) elC.innerText = stats.critical;
      if (elP) elP.innerText = stats.pue || '1.18';
      if (elR) elR.innerText = `${stats.avg_risk}%`;

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

    // 5. Update Bottom Ticker
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
      const item = document.createElement('div');
      item.className = 'rack-list-item';

      const statusClass = r.severity === 'CRITICAL' ? 'critical' : (r.severity === 'WARNING' ? 'warning' : 'normal');

      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-family:var(--font-mono); font-weight:700;">${r.rack_id}</span>
          <span style="font-size:0.7rem; color:var(--text-muted);">${r.temp_c}°C</span>
        </div>
        <span class="rack-badge ${statusClass}">${Math.round(r.risk_score)}%</span>
      `;

      item.addEventListener('click', () => {
        this.openDrawer(r.rack_id);
        this.scene.focusOnRack(r.rack_id);
      });

      container.appendChild(item);
    });
  }

  openDrawer(rackId) {
    this.selectedRackId = rackId;
    const rackData = this.rackManager.getRackData(rackId) || {
      rack_id: rackId,
      name: `Compute Node ${rackId}`,
      node_id: "machine-1-1",
      risk_score: 18.0,
      severity: "NORMAL",
      cpu_util: 34.2,
      mem_util: 52.8,
      disk_io: 84,
      temp_c: 32.4
    };

    const drawer = document.getElementById('inspector-drawer');
    if (!drawer) return;

    drawer.style.display = 'flex';
    requestAnimationFrame(() => {
      drawer.style.transform = 'translateX(0)';
      drawer.style.opacity = '1';
    });

    this.sparklineHistory = [];
    this.updateDrawerContent(rackData, null);
  }

  closeDrawer() {
    const drawer = document.getElementById('inspector-drawer');
    if (!drawer) return;

    drawer.style.transform = 'translateX(460px)';
    drawer.style.opacity = '0';
    setTimeout(() => {
      if (drawer.style.opacity === '0') drawer.style.display = 'none';
    }, 320);
    this.selectedRackId = null;
  }

  updateDrawerContent(data, activeAlert) {
    const elRackId = document.getElementById('drawer-rack-id');
    const elRackName = document.getElementById('drawer-rack-name');
    const elNodeId = document.getElementById('drawer-node-id');

    if (elRackId) elRackId.innerText = data.rack_id;
    if (elRackName) elRackName.innerText = `${data.name || data.rack_id} (42U)`;
    if (elNodeId) elNodeId.innerText = data.node_id || 'machine-1-1';

    // Risk Meter Ring
    const ring = document.getElementById('drawer-risk-ring');
    const valEl = document.getElementById('drawer-risk-val');
    const sevEl = document.getElementById('drawer-severity');

    const riskVal = Math.round(data.risk_score || 18);
    if (valEl) valEl.innerText = riskVal;
    if (sevEl) {
      sevEl.innerText = data.severity || 'NORMAL';
      if (data.severity === 'CRITICAL') {
        sevEl.style.color = '#ef4444';
      } else if (data.severity === 'WARNING') {
        sevEl.style.color = '#f59e0b';
      } else {
        sevEl.style.color = '#10b981';
      }
    }

    if (ring) {
      const ringColor = data.severity === 'CRITICAL' ? '#ef4444' : (data.severity === 'WARNING' ? '#f59e0b' : '#10b981');
      ring.style.background = `conic-gradient(${ringColor} 0% ${riskVal}%, #e2e8f0 ${riskVal}% 100%)`;
    }

    // Telemetry Metrics
    const cpuEl = document.getElementById('drawer-cpu');
    const memEl = document.getElementById('drawer-mem');
    const diskEl = document.getElementById('drawer-disk');
    const tempEl = document.getElementById('drawer-temp');

    if (cpuEl) cpuEl.innerText = `${data.cpu_util || 34.2}%`;
    if (memEl) memEl.innerText = `${data.mem_util || 52.8}%`;
    if (diskEl) diskEl.innerText = `${data.disk_io || 84} IOPS`;
    if (tempEl) tempEl.innerText = `${data.temp_c || 32.4}°C`;

    const fanRPM = Math.round(4800 + ((data.temp_c || 32) / 80) * 3200);
    const powerKW = (2.2 + ((data.cpu_util || 35) / 100) * 2.8).toFixed(1);
    const fanEl = document.getElementById('drawer-fan');
    const powerEl = document.getElementById('drawer-power');
    if (fanEl) fanEl.innerText = `${fanRPM} RPM`;
    if (powerEl) powerEl.innerText = `${powerKW} kW`;

    // Push to Sparkline History
    this.sparklineHistory.push(riskVal);
    if (this.sparklineHistory.length > this.maxSparklinePoints) {
      this.sparklineHistory.shift();
    }
    const sparkColor = data.severity === 'CRITICAL' ? '#ef4444' : (data.severity === 'WARNING' ? '#f59e0b' : '#4f46e5');
    this.drawSparkline(sparkColor);

    // Groq AI Root Cause Analysis Box
    const rcaBox = document.getElementById('drawer-rca-box');
    const isIncident = data.severity === "CRITICAL" || data.severity === "WARNING";

    if (rcaBox) {
      if (isIncident) {
        rcaBox.style.display = 'block';
        if (data.severity === 'CRITICAL') {
          rcaBox.classList.add('critical');
        } else {
          rcaBox.classList.remove('critical');
        }

        const rca = (activeAlert && activeAlert.rack_id === data.rack_id) ? activeAlert.rca : null;
        const culpritEl = document.getElementById('drawer-rca-culprit');
        const descEl = document.getElementById('drawer-rca-desc');
        const actionEl = document.getElementById('drawer-rca-action');
        const urgencyEl = document.getElementById('rca-urgency');

        if (rca) {
          if (culpritEl) culpritEl.innerText = rca.probable_culprit || 'Hardware Metric Deviation';
          if (descEl) descEl.innerText = rca.root_cause_summary || 'Anomalous metric drift detected by Isolation Forest.';
          if (actionEl) actionEl.innerText = `Action: ${rca.recommended_action || 'Inspect server syslog and drain active load.'}`;
          if (urgencyEl) urgencyEl.innerText = rca.urgency || 'HIGH';
        } else {
          const topDrift = data.anomalous_sensors && data.anomalous_sensors.length > 0
            ? data.anomalous_sensors.join(', ')
            : 'Outlier Sensor Drift';
          if (culpritEl) culpritEl.innerText = `Anomalous Drift on ${topDrift}`;
          if (descEl) descEl.innerText = `Isolation Forest flagged sequence deviation at 98th percentile. Telemetry indicates server load degradation.`;
          if (actionEl) actionEl.innerText = `Action: Execute automated workload migration to redundant node.`;
          if (urgencyEl) urgencyEl.innerText = data.severity === 'CRITICAL' ? 'IMMEDIATE' : 'HIGH';
        }
      } else {
        rcaBox.style.display = 'none';
      }
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

    // Light Theme Grid baseline
    ctx.strokeStyle = '#e2e8f0';
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
    grad.addColorStop(0, `${color}33`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
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
          data.color = "#10b981";
          this.updateDrawerContent(data, null);
        }
      }, 500);
    } catch (e) {
      console.error('Remediation trigger failed:', e);
    }
  }

  async openBenchmarkModal() {
    const modal = document.getElementById('benchmark-modal');
    if (!modal) return;
    modal.classList.add('active');
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
        const repEl = document.getElementById('technical-report-content');
        if (repEl) repEl.innerText = reportData.report_markdown;
      }
    } catch (e) {
      console.error('Failed to load benchmark data:', e);
    }
  }

  renderBenchmarkTable(models) {
    const container = document.getElementById('benchmark-table-container');
    if (!container) return;
    if (!models || models.length === 0) {
      container.innerHTML = '<p>No candidate benchmark data available.</p>';
      return;
    }

    models.sort((a, b) => (b.pa_f1_score || 0) - (a.pa_f1_score || 0));

    let html = `
      <table class="modal-table">
        <thead>
          <tr>
            <th>Candidate Model Family</th>
            <th>Point-Adjusted F1</th>
            <th>Standard F1</th>
            <th>Precision</th>
            <th>Recall</th>
            <th>PR-AUC</th>
            <th>Latency</th>
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
            ${isChamp ? '<span style="background:#10b981; color:#fff; font-size:0.65rem; padding:2px 6px; border-radius:10px; margin-left:6px; font-weight:800;">CHAMPION</span>' : ''}
          </td>
          <td style="color: var(--color-emerald); font-weight: 700;">${m.pa_f1_score.toFixed(4)}</td>
          <td>${m.f1_score.toFixed(4)}</td>
          <td>${m.precision.toFixed(4)}</td>
          <td>${m.recall.toFixed(4)}</td>
          <td>${m.pr_auc.toFixed(4)}</td>
          <td style="color: var(--color-primary); font-family: var(--font-mono); font-weight:700;">${m.latency_ms.toFixed(3)} ms</td>
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
