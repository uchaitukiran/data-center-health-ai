/**
 * DC Health AI - Main Application Orchestrator
 * Controls 3D Digital Twin, Interactive Charts, Live Telemetry,
 * Groq AI RCA Insights, Sound Effects, and Theme Toggling.
 */

import { DataCenterScene } from './scene_3d.js';
import { soundEngine } from './audio_manager.js';

class DCHealthApp {
  constructor() {
    this.scene = new DataCenterScene('canvas-container');
    this.selectedServerId = 'DC-07';
    this.currentTheme = 'light';
    this.serversData = new Map();

    this.initServersData();
    this.initLiveClock();
    this.initThemeToggle();
    this.initSoundToggle();
    this.initCameraControls();
    this.initInteractiveInspector();
    this.initCharts();
    this.initAutoRemediation();
    this.initBenchmarkModal();
    this.connectLiveWebSocket();
  }

  /**
   * Initializes initial mock & live server state for DC-01 through DC-08
   */
  initServersData() {
    const servers = [
      { id: 'DC-01', status: 'NORMAL', score: 94, risk: 14, uptime: '48 days 6 hrs', failure: '> 30 days', cpu: 28, mem: 34, disk: 42, net: 26, culprit: 'Normal Operations', desc: 'All telemetry metrics nominal within 99.8th percentile confidence interval.', actions: ['Routine monitoring active', 'Cluster balance optimal'] },
      { id: 'DC-02', status: 'NORMAL', score: 91, risk: 18, uptime: '42 days 12 hrs', failure: '> 30 days', cpu: 32, mem: 38, disk: 48, net: 31, culprit: 'Normal Operations', desc: 'All telemetry metrics nominal within 99.8th percentile confidence interval.', actions: ['Routine monitoring active'] },
      { id: 'DC-03', status: 'WARNING', score: 56, risk: 48, uptime: '19 days 8 hrs', failure: '~ 4.2 hours', cpu: 64, mem: 68, disk: 62, net: 45, culprit: 'Memory Pressure Precursor', desc: 'Sustained memory utilization drift above 65%. Llama-3.3-70B predicts potential OOM within 4 hours.', actions: ['Inspect thread pool leakage', 'Flush inactive cache pages', 'Prepare standby migration'] },
      { id: 'DC-04', status: 'NORMAL', score: 95, risk: 16, uptime: '54 days 2 hrs', failure: '> 30 days', cpu: 26, mem: 31, disk: 38, net: 24, culprit: 'Normal Operations', desc: 'Workload distribution balanced across NVMe arrays.', actions: ['Routine monitoring active'] },
      { id: 'DC-05', status: 'WARNING', score: 52, risk: 54, uptime: '14 days 19 hrs', failure: '~ 3.1 hours', cpu: 71, mem: 65, disk: 59, net: 48, culprit: 'TCP Queue Congestion', desc: 'Elevated network packet retransmission observed on primary 800GbE spine link.', actions: ['Rebalance SDN routing table', 'Check interface buffer depth'] },
      { id: 'DC-06', status: 'NORMAL', score: 89, risk: 22, uptime: '38 days 14 hrs', failure: '> 30 days', cpu: 38, mem: 42, disk: 44, net: 33, culprit: 'Normal Operations', desc: 'Healthy operational baseline.', actions: ['Routine monitoring active'] },
      { id: 'DC-07', status: 'CRITICAL', score: 13, risk: 87, uptime: '12 days 4 hrs', failure: '~ 17 minutes', cpu: 92, mem: 78, disk: 65, net: 41, culprit: 'Memory Leak & NVMe Disk Stall', desc: 'Unusual spike in memory usage combined with increasing disk I/O. This pattern resembles past failures due to memory leak or runaway process.', actions: ['Check memory-intensive processes', 'Inspect disk queue and I/O wait', 'Consider restarting the affected service'] },
      { id: 'DC-08', status: 'NORMAL', score: 92, risk: 19, uptime: '45 days 1 hr', failure: '> 30 days', cpu: 30, mem: 36, disk: 40, net: 28, culprit: 'Normal Operations', desc: 'Nominal telemetry envelope across all 38 monitored parameters.', actions: ['Routine monitoring active'] }
    ];

    servers.forEach(s => this.serversData.set(s.id, s));
  }

  initLiveClock() {
    const updateTime = () => {
      const now = new Date();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const m = months[now.getMonth()];
      const d = String(now.getDate()).padStart(2, '0');
      const y = now.getFullYear();

      let hours = now.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const mins = String(now.getMinutes()).padStart(2, '0');

      const el = document.getElementById('system-date-time');
      if (el) el.innerHTML = `${m} ${d}, ${y} &bull; ${hours}:${mins} ${ampm}`;
    };
    setInterval(updateTime, 1000);
    updateTime();
  }

  initThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    const sunIcon = document.querySelector('.theme-icon.sun');
    const moonIcon = document.querySelector('.theme-icon.moon');

    // Default to 'light' theme as in reference image input_file_0.png
    const savedTheme = localStorage.getItem('dc_theme') || 'light';
    this.currentTheme = savedTheme;

    if (savedTheme === 'dark') {
      document.body.classList.add('dark-theme');
      if (sunIcon) sunIcon.style.display = 'none';
      if (moonIcon) moonIcon.style.display = 'block';
    } else {
      document.body.classList.remove('dark-theme');
      if (sunIcon) sunIcon.style.display = 'block';
      if (moonIcon) moonIcon.style.display = 'none';
    }

    if (this.scene && this.scene.setTheme) {
      this.scene.setTheme(this.currentTheme);
    }

    if (btn) {
      btn.addEventListener('click', () => {
        soundEngine.playClick();
        const isDark = document.body.classList.toggle('dark-theme');
        this.currentTheme = isDark ? 'dark' : 'light';
        localStorage.setItem('dc_theme', this.currentTheme);

        if (sunIcon && moonIcon) {
          sunIcon.style.display = isDark ? 'none' : 'block';
          moonIcon.style.display = isDark ? 'block' : 'none';
        }

        // Switch 3D scene lighting & environment
        if (this.scene && this.scene.setTheme) {
          this.scene.setTheme(this.currentTheme);
        }

        // Re-render charts with updated theme colors
        this.drawDonutChart();
        this.drawHealthRing(this.serversData.get(this.selectedServerId)?.score || 13);
        this.drawRiskTrend();
      });
    }
  }

  initSoundToggle() {
    const soundBtn = document.getElementById('sound-toggle');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const isMuted = soundEngine.toggleMute();
        soundBtn.style.opacity = isMuted ? '0.4' : '1.0';
        if (!isMuted) soundEngine.playClick();
      });
    }

    // Start subtle ambient cooling fan on first user click
    const startAudio = () => {
      soundEngine.ensureContext();
      soundEngine.startAmbientHum();
      window.removeEventListener('pointerdown', startAudio);
      window.removeEventListener('keydown', startAudio);
    };
    window.addEventListener('pointerdown', startAudio);
    window.addEventListener('keydown', startAudio);
  }

  initCameraControls() {
    document.querySelectorAll('.cam-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        soundEngine.playClick();
        document.querySelectorAll('.cam-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const camPreset = btn.getAttribute('data-cam');
        this.scene.setCameraPreset(camPreset);
      });
    });

    // Fullscreen Toggle
    const fsBtn = document.getElementById('btn-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        soundEngine.playClick();
        const card = document.getElementById('viewport-3d-card');
        if (!document.fullscreenElement) {
          if (card.requestFullscreen) card.requestFullscreen();
        } else {
          if (document.exitFullscreen) document.exitFullscreen();
        }
      });
    }
  }

  initInteractiveInspector() {
    // 3D Scene callback when a rack is clicked
    this.scene.onRackSelect((rackId, data) => {
      soundEngine.playSelect();
      this.selectServer(rackId);
    });

    // Default select DC-07 on load
    this.selectServer('DC-07');
  }

  selectServer(serverId) {
    this.selectedServerId = serverId;
    const server = this.serversData.get(serverId) || {
      id: serverId,
      status: 'NORMAL',
      score: 92,
      risk: 18,
      uptime: '30 days 0 hrs',
      failure: '> 30 days',
      cpu: 30,
      mem: 35,
      disk: 40,
      net: 25,
      culprit: 'Nominal Operations',
      desc: 'All monitored sensor parameters within normal bounds.',
      actions: ['Continuous background evaluation']
    };

    // 1. Update Title and Badge
    const elId = document.getElementById('ins-server-id');
    const elBadge = document.getElementById('ins-status-badge');
    if (elId) elId.innerText = server.id;

    if (elBadge) {
      elBadge.className = `badge-status-pill ${server.status === 'CRITICAL' ? 'badge-critical' : (server.status === 'WARNING' ? 'badge-warning' : 'badge-normal')}`;
      elBadge.innerHTML = `<span>${server.status === 'CRITICAL' ? '⚠️' : '●'}</span> ${server.status === 'CRITICAL' ? 'Critical' : (server.status === 'WARNING' ? 'At Risk' : 'Healthy')}`;
    }

    // 2. Update Health Score Ring
    const elScore = document.getElementById('ins-health-score');
    if (elScore) {
      elScore.innerText = server.score;
      elScore.style.color = server.status === 'CRITICAL' ? 'var(--color-rose)' : (server.status === 'WARNING' ? 'var(--color-amber)' : 'var(--color-emerald)');
    }
    this.drawHealthRing(server.score);

    // 3. Update Metadata Specs
    const elUptime = document.getElementById('ins-uptime');
    const elRisk = document.getElementById('ins-risk-score');
    const elFail = document.getElementById('ins-failure-time');
    if (elUptime) elUptime.innerText = server.uptime;
    if (elRisk) {
      elRisk.innerText = `${server.risk}%`;
      elRisk.className = `score-val ${server.risk > 70 ? 'text-red' : ''}`;
    }
    if (elFail) {
      elFail.innerText = server.failure;
      elFail.className = `score-val ${server.status === 'CRITICAL' ? 'text-red' : ''}`;
    }

    // 4. Update Resource Usage Progress Bars
    const elCpu = document.getElementById('bar-cpu');
    const elMem = document.getElementById('bar-mem');
    const elDisk = document.getElementById('bar-disk');
    const elNet = document.getElementById('bar-net');

    const valCpu = document.getElementById('val-cpu');
    const valMem = document.getElementById('val-mem');
    const valDisk = document.getElementById('val-disk');
    const valNet = document.getElementById('val-net');

    if (elCpu) elCpu.style.width = `${server.cpu}%`;
    if (elMem) elMem.style.width = `${server.mem}%`;
    if (elDisk) elDisk.style.width = `${server.disk}%`;
    if (elNet) elNet.style.width = `${server.net}%`;

    if (valCpu) valCpu.innerText = `${server.cpu}%`;
    if (valMem) valMem.innerText = `${server.mem}%`;
    if (valDisk) valDisk.innerText = `${server.disk}%`;
    if (valNet) valNet.innerText = `${server.net}%`;

    // 5. Update AI Insight Card
    const elHeading = document.getElementById('ai-alert-heading');
    const elDesc = document.getElementById('ai-alert-desc');
    const elList = document.getElementById('ai-recom-list');
    const alertBanner = document.getElementById('ai-alert-banner');

    if (elHeading) elHeading.innerText = server.status === 'CRITICAL' ? 'High risk of failure detected.' : (server.status === 'WARNING' ? 'Elevated sensor deviation.' : 'Nominal Infrastructure Health.');
    if (elDesc) elDesc.innerText = server.desc;

    if (alertBanner) {
      if (server.status === 'CRITICAL') {
        alertBanner.style.background = 'var(--color-rose-light)';
        alertBanner.style.borderLeftColor = 'var(--color-rose)';
      } else if (server.status === 'WARNING') {
        alertBanner.style.background = 'var(--color-amber-light)';
        alertBanner.style.borderLeftColor = 'var(--color-amber)';
      } else {
        alertBanner.style.background = 'var(--color-emerald-light)';
        alertBanner.style.borderLeftColor = 'var(--color-emerald)';
      }
    }

    if (elList && server.actions) {
      elList.innerHTML = server.actions.map(a => `<li>${a}</li>`).join('');
    }
  }

  initCharts() {
    this.drawDonutChart();
    this.drawHealthRing(13);
    this.drawRiskTrend();
  }

  /**
   * Draws the Server Health Distribution Donut Chart (Card 1)
   */
  drawDonutChart() {
    const canvas = document.getElementById('donut-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = 46;
    const lineWidth = 12;

    ctx.clearRect(0, 0, w, h);

    // Distribution: 86% Healthy (Green), 11% Warning (Orange), 3% Critical (Red)
    const slices = [
      { percent: 0.86, color: '#10b981' },
      { percent: 0.11, color: '#f59e0b' },
      { percent: 0.03, color: '#ef4444' }
    ];

    let startAngle = -Math.PI / 2;
    const gap = 0.04; // Visual segment gap

    slices.forEach(slice => {
      const sliceAngle = slice.percent * Math.PI * 2;
      const endAngle = startAngle + sliceAngle - gap;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.strokeStyle = slice.color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      startAngle += sliceAngle;
    });
  }

  /**
   * Draws the Radial Progress Health Ring for Selected Server
   */
  drawHealthRing(score) {
    const canvas = document.getElementById('health-ring-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = 30;
    const lineWidth = 7;

    ctx.clearRect(0, 0, w, h);

    // Background track ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = this.currentTheme === 'dark' ? '#1e293b' : '#f1f5f9';
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Foreground progress ring
    const percent = Math.min(Math.max(score / 100, 0), 1);
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + percent * Math.PI * 2;

    let ringColor = '#10b981';
    if (score < 40) ringColor = '#ef4444';
    else if (score < 70) ringColor = '#f59e0b';

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  /**
   * Draws the Risk Trend (Last 24 Hours) Smooth Area Line Chart (Card 2)
   */
  drawRiskTrend() {
    const canvas = document.getElementById('risk-trend-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 24 Hour points from 00:00 to 24:00 (peaks at 87% at index 20)
    const points = [
      { x: 0, y: 18 },
      { x: 2, y: 19 },
      { x: 4, y: 22 },
      { x: 6, y: 21 },
      { x: 8, y: 24 },
      { x: 10, y: 26 },
      { x: 12, y: 28 },
      { x: 14, y: 35 },
      { x: 16, y: 44 },
      { x: 18, y: 56 },
      { x: 20, y: 87 }, // Peak at 20:40
      { x: 22, y: 79 },
      { x: 24, y: 72 }
    ];

    // Horizontal baseline grid
    ctx.strokeStyle = this.currentTheme === 'dark' ? '#1e293b' : '#f1f5f9';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach(ratio => {
      ctx.beginPath();
      ctx.moveTo(0, h * ratio);
      ctx.lineTo(w, h * ratio);
      ctx.stroke();
    });

    // Map points to canvas coordinates
    const mapped = points.map(p => ({
      x: (p.x / 24) * w,
      y: h - (p.y / 100) * (h - 16) - 8
    }));

    // Area fill with gradient
    ctx.beginPath();
    ctx.moveTo(mapped[0].x, mapped[0].y);
    for (let i = 0; i < mapped.length - 1; i++) {
      const xc = (mapped[i].x + mapped[i + 1].x) / 2;
      const yc = (mapped[i].y + mapped[i + 1].y) / 2;
      ctx.quadraticCurveTo(mapped[i].x, mapped[i].y, xc, yc);
    }
    ctx.lineTo(mapped[mapped.length - 1].x, mapped[mapped.length - 1].y);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();

    const areaGrad = ctx.createLinearGradient(0, 0, 0, h);
    areaGrad.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
    areaGrad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Stroke spline line
    ctx.beginPath();
    ctx.moveTo(mapped[0].x, mapped[0].y);
    for (let i = 0; i < mapped.length - 1; i++) {
      const xc = (mapped[i].x + mapped[i + 1].x) / 2;
      const yc = (mapped[i].y + mapped[i + 1].y) / 2;
      ctx.quadraticCurveTo(mapped[i].x, mapped[i].y, xc, yc);
    }
    ctx.lineTo(mapped[mapped.length - 1].x, mapped[mapped.length - 1].y);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Highlight Peak Point (at index 10, x = 20)
    const peak = mapped[10];
    ctx.beginPath();
    ctx.arc(peak.x, peak.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  initAutoRemediation() {
    const btn = document.getElementById('btn-remediate');
    if (btn) {
      btn.addEventListener('click', async () => {
        soundEngine.playClick();
        btn.disabled = true;
        btn.innerHTML = `<span>⏳</span> Remediating ${this.selectedServerId}...`;

        try {
          const res = await fetch('/api/simulate/remediate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rack_id: this.selectedServerId })
          });

          if (res.ok) {
            soundEngine.playSelect();
            // Update Selected Server to Healthy
            const server = this.serversData.get(this.selectedServerId);
            if (server) {
              server.status = 'NORMAL';
              server.score = 96;
              server.risk = 12;
              server.cpu = 28;
              server.mem = 32;
              server.disk = 36;
              server.net = 24;
              server.failure = '> 30 days';
              server.culprit = 'Workload Migrated Successfully';
              server.desc = 'Automated failover executed. Memory leaked process recycled, workloads drained to backup cluster node.';
              server.actions = ['Node operational in healthy baseline', 'Workloads distributed'];
            }

            // Update Top Stat Cards
            const elH = document.getElementById('card-healthy-count');
            const elC = document.getElementById('card-critical-count');
            if (elH) elH.innerText = '25';
            if (elC) elC.innerText = '0';

            // Refresh Inspector UI
            this.selectServer(this.selectedServerId);

            // Update 3D Scene Rack Status (Heal DC-07 to nominal green)
            if (this.scene && this.scene.remediateServer) {
              this.scene.remediateServer(this.selectedServerId);
            }

            btn.innerHTML = `<span>✓</span> Workloads Remediated`;
            setTimeout(() => {
              btn.disabled = false;
              btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Execute Auto-Remediation & Failover`;
            }, 3000);
          }
        } catch (e) {
          console.error('Remediation call error:', e);
          btn.disabled = false;
          btn.innerText = 'Retry Remediation';
        }
      });
    }
  }

  initBenchmarkModal() {
    const modal = document.getElementById('benchmark-modal');
    const openBtn = document.getElementById('btn-open-tournament');
    const closeBtn = document.getElementById('modal-close-btn');

    if (openBtn && modal) {
      openBtn.addEventListener('click', async () => {
        soundEngine.playClick();
        modal.classList.add('active');

        const tableContainer = document.getElementById('benchmark-table-container');
        const reportContainer = document.getElementById('technical-report-content');

        try {
          const res = await fetch('/api/models/tournament');
          if (res.ok) {
            const data = await res.json();
            const models = data.benchmark_results || [];

            let tableHtml = `
              <table class="modal-table">
                <thead>
                  <tr>
                    <th>Model Architecture</th>
                    <th>PA-F1 Score</th>
                    <th>Standard F1</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>PR-AUC</th>
                    <th>Infer Latency</th>
                  </tr>
                </thead>
                <tbody>
            `;

            models.forEach(m => {
              const isChamp = m.is_champion;
              tableHtml += `
                <tr class="${isChamp ? 'champion-row' : ''}">
                  <td>${isChamp ? '🏆 <strong>' + m.model_name + '</strong> (Production Champion)' : m.model_name}</td>
                  <td><strong>${(m.point_adjusted_f1 || 0).toFixed(4)}</strong></td>
                  <td>${(m.raw_f1 || 0).toFixed(4)}</td>
                  <td>${(m.precision || 0).toFixed(4)}</td>
                  <td>${(m.recall || 0).toFixed(4)}</td>
                  <td>${(m.pr_auc || 0).toFixed(4)}</td>
                  <td>${(m.latency_ms || 0).toFixed(3)} ms</td>
                </tr>
              `;
            });

            tableHtml += `</tbody></table>`;
            if (tableContainer) tableContainer.innerHTML = tableHtml;

            if (reportContainer) {
              reportContainer.innerText = `
SELECTION METHODOLOGY:
- Dataset: Server Machine Dataset (38 telemetry dimensions x 28 nodes)
- Protocol: Strict Chronological Pre-Split (Zero Data Leakage Audited)
  * Training Partition:   24,149 timestamps (Normal Baseline)
  * Validation Partition:  4,212 timestamps (Threshold Optimization)
  * Testing Partition:    28,420 timestamps (Generalization Evaluation)

OPERATIONAL TRADE-OFF DECISION:
1. Robust Covariance achieved the highest Point-Adjusted F1 (0.6412) and superior PR-AUC.
2. Inference latency of 0.001 ms satisfies hyperscale 10,000 req/sec NOC throughput constraints.
3. Successfully serialized to artifacts/best_model/champion_model.pkl.
              `.trim();
            }
          }
        } catch (e) {
          console.error('Error fetching tournament:', e);
        }
      });
    }

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => {
        soundEngine.playClick();
        modal.classList.remove('active');
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    }
  }

  connectLiveWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;

    try {
      const socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data);
          // If active alert incoming, sync with DC-07
          if (frame.active_alert && this.selectedServerId === 'DC-07') {
            const server = this.serversData.get('DC-07');
            if (server && frame.active_alert.ai_rca) {
              server.desc = frame.active_alert.ai_rca.description;
              server.actions = [frame.active_alert.ai_rca.recommended_action || 'Drain node workloads'];
              this.selectServer('DC-07');
            }
          }
        } catch (err) {}
      };

      socket.onclose = () => {
        setTimeout(() => this.connectLiveWebSocket(), 3000);
      };
    } catch (e) {
      console.warn('WebSocket connection fallback:', e);
    }
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.dcHealthApp = new DCHealthApp();
});
