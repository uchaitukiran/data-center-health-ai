/**
 * DC Health AI - Command Center Digital Twin Engine
 * High-Fidelity Photorealistic 3D Datacenter Room
 *
 * Architecture:
 * 1. Daylight Room Environment:
 *    - Uses user's daylight sky (/images/sky.png) as background
 *    - Uses user's interior room (/images/int.png) with panoramic glass windows & wall typography
 * 2. Real 3D Server Fleet (10 Racks in 2 Clusters):
 *    - Left Cluster: R-01, R-02, R-03, R-04, R-05
 *    - Right Cluster: R-06, R-07, R-08, R-09, R-10
 *    - Realistic PBR server chassis, blade faceplates, and emissive activity LEDs
 *    - R-09 Critical Alert: Intense glowing red LEDs, pulsing alert halo, red emergency point light,
 *      and spinning 3D holographic warning beacon
 *    - R-03 & R-08 Warning: Amber warning LEDs
 * 3. Unreal Engine Daylight Illumination:
 *    - Directional sunlight casting specular highlights on rack tops and floor
 *    - High-dynamic-range ACESFilmic tone mapping
 *    - Specular reflections of server rack LEDs on the glossy floor
 * 4. Constrained Camera Controls:
 *    - Left & Right rotation (azimuth orbit)
 *    - Smooth Zoom In & Zoom Out
 *    - Polar angle clamped strictly at eye level (never flips or dips under floor)
 * 5. Interactive 3D Fleet:
 *    - 10 floating badges tracking 3D racks in screen space
 *    - Raycasting click selection
 *    - One-click auto-remediation transforms R-09 to healthy green
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class DataCenterScene {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.racks = new Map();
    this.interactiveObjects = [];
    this.selectedRackId = 'R-09';
    this.onRackSelectCallback = null;

    // 3D Objects
    this.roomMesh = null;
    this.skyMesh = null;
    this.floorReflector = null;
    this.racksGroup = null;
    this.r09HaloMesh = null;
    this.r09Light = null;
    this.warningBeacon = null;

    // Animation state
    this.clock = new THREE.Clock();
    this.isAlertActive = true;
    this.animatingCamera = false;

    this.init();
  }

  init() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 500;

    // 1. Camera: Positioned inside room at eye level looking forward
    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 1000);
    this.camera.position.set(0, 0.35, 9.2);

    // 2. High-Fidelity WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 3. Orbit Controls: Left/Right rotation only, Zoom In/Out only
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(0, -0.15, 0);

    // Lock polar angle strictly around eye level (approx 74° to 90°)
    this.controls.minPolarAngle = 1.28;
    this.controls.maxPolarAngle = 1.57;

    // Azimuth bounds: broad left/right viewing without disorienting flip
    this.controls.minAzimuthAngle = -Math.PI / 3.2;
    this.controls.maxAzimuthAngle = Math.PI / 3.2;

    // Zoom limits
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 14.0;

    // 4. Unreal Engine Daylight Lighting
    this.setupLighting();

    // 5. Build Room & Panoramic Sky Environment
    this.buildRoomEnvironment();

    // 6. Build High-Fidelity 3D Server Racks Fleet
    this.buildServerRacks();

    // 7. Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));

    // 8. Animation Loop
    this.animate();
  }

  /**
   * Sets up bright, clean daylight illumination matching the user's reference
   */
  setupLighting() {
    // Ambient daylight fill
    this.ambientLight = new THREE.AmbientLight(0xf1f5f9, 2.2);
    this.scene.add(this.ambientLight);

    // Main directional sunlight from window / sky direction
    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 2.6);
    this.sunLight.position.set(6, 14, 10);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 50;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // Secondary sky bounce light
    const skyBounce = new THREE.DirectionalLight(0xbae6fd, 1.4);
    skyBounce.position.set(-8, 10, -5);
    this.scene.add(skyBounce);

    // Dedicated pulsing red emergency light over R-09
    this.r09Light = new THREE.PointLight(0xef4444, 4.0, 6.0, 1.5);
    this.r09Light.position.set(2.45, 0.8, 0.5);
    this.scene.add(this.r09Light);
  }

  /**
   * Builds the datacenter room interior using int.png and sky.png
   */
  buildRoomEnvironment() {
    const textureLoader = new THREE.TextureLoader();

    // 1. Panoramic Sky in background
    textureLoader.load('/images/sky.png', (skyTex) => {
      skyTex.colorSpace = THREE.SRGBColorSpace;
      const skyGeo = new THREE.PlaneGeometry(36, 18);
      const skyMat = new THREE.MeshBasicMaterial({
        map: skyTex,
        depthWrite: false
      });
      this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
      this.skyMesh.position.set(0, 2.2, -6.5);
      this.scene.add(this.skyMesh);
    });

    // 2. Interior Room Stage using int.png (with transparent window alpha blending or crisp projection)
    textureLoader.load('/images/int.png', (roomTex) => {
      roomTex.colorSpace = THREE.SRGBColorSpace;
      const vFOV = THREE.MathUtils.degToRad(this.camera.fov);
      const planeH = 2 * Math.tan(vFOV / 2) * 9.2;
      const planeW = planeH * this.camera.aspect;

      const roomGeo = new THREE.PlaneGeometry(planeW, planeH);
      const roomMat = new THREE.MeshBasicMaterial({
        map: roomTex,
        depthWrite: false
      });
      this.roomMesh = new THREE.Mesh(roomGeo, roomMat);
      this.roomMesh.position.set(0, 0, 0);
      this.scene.add(this.roomMesh);
    });

    // 3. Glossy Specular Floor Plane reflecting rack chassis and LEDs
    const floorGeo = new THREE.PlaneGeometry(16, 8);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.18,
      metalness: 0.35,
      transparent: true,
      opacity: 0.32
    });
    this.floorReflector = new THREE.Mesh(floorGeo, floorMat);
    this.floorReflector.rotation.x = -Math.PI / 2;
    this.floorReflector.position.set(0, -1.45, 0.5);
    this.scene.add(this.floorReflector);
  }

  /**
   * Builds 10 High-Fidelity 3D Server Racks in 2 Clusters
   * Left Cluster: R-01 to R-05 | Right Cluster: R-06 to R-10
   */
  buildServerRacks() {
    this.racksGroup = new THREE.Group();
    this.scene.add(this.racksGroup);

    const racksConfig = [
      // Left Cluster (R-01 .. R-05)
      { id: 'R-01', status: 'NORMAL', x: -3.55, z: 0.0, bladeCount: 8 },
      { id: 'R-02', status: 'NORMAL', x: -2.80, z: 0.0, bladeCount: 8 },
      { id: 'R-03', status: 'WARNING', x: -2.05, z: 0.0, bladeCount: 8 },
      { id: 'R-04', status: 'NORMAL', x: -1.30, z: 0.0, bladeCount: 8 },
      { id: 'R-05', status: 'NORMAL', x: -0.55, z: 0.0, bladeCount: 8 },
      // Right Cluster (R-06 .. R-10)
      { id: 'R-06', status: 'NORMAL', x: 0.55, z: 0.0, bladeCount: 8 },
      { id: 'R-07', status: 'NORMAL', x: 1.30, z: 0.0, bladeCount: 8 },
      { id: 'R-08', status: 'WARNING', x: 2.05, z: 0.0, bladeCount: 8 },
      { id: 'R-09', status: 'CRITICAL', x: 2.70, z: 0.0, bladeCount: 8 },
      { id: 'R-10', status: 'NORMAL', x: 3.35, z: 0.0, bladeCount: 8 }
    ];

    // Shared Materials
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.25
    });

    const frontGrilleMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.9,
      roughness: 0.4
    });

    const greenLedMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const amberLedMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const redLedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    racksConfig.forEach((cfg) => {
      const rackGroup = new THREE.Group();
      rackGroup.position.set(cfg.x, -0.35, cfg.z);

      // 1. Rack Cabinet Body
      const bodyW = 0.62;
      const bodyH = 2.15;
      const bodyD = 0.95;
      const bodyGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyD);
      const bodyMesh = new THREE.Mesh(bodyGeo, chassisMat);
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      rackGroup.add(bodyMesh);

      // 2. Recessed Front Faceplate Frame
      const faceGeo = new THREE.PlaneGeometry(bodyW * 0.92, bodyH * 0.95);
      const faceMesh = new THREE.Mesh(faceGeo, frontGrilleMat);
      faceMesh.position.set(0, 0, bodyD / 2 + 0.005);
      rackGroup.add(faceMesh);

      // 3. Server Blades & Activity LEDs
      const bladeHeight = (bodyH * 0.92) / cfg.bladeCount;
      const ledsArray = [];

      for (let b = 0; b < cfg.bladeCount; b++) {
        const bladeY = (bodyH * 0.92) / 2 - (b + 0.5) * bladeHeight;

        // Blade separator line
        const lineGeo = new THREE.PlaneGeometry(bodyW * 0.88, 0.015);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
        const lineMesh = new THREE.Mesh(lineGeo, lineMat);
        lineMesh.position.set(0, bladeY - bladeHeight / 2, bodyD / 2 + 0.01);
        rackGroup.add(lineMesh);

        // LED Indicators (2 columns: activity & power)
        let ledMat = greenLedMat;
        if (cfg.id === 'R-09') ledMat = redLedMat;
        else if (cfg.status === 'WARNING') ledMat = amberLedMat;

        for (let col = 0; col < 2; col++) {
          const ledGeo = new THREE.PlaneGeometry(0.025, 0.035);
          const ledMesh = new THREE.Mesh(ledGeo, ledMat);
          const ledX = (col === 0 ? -1 : 1) * (bodyW * 0.32);
          ledMesh.position.set(ledX, bladeY, bodyD / 2 + 0.015);
          rackGroup.add(ledMesh);
          ledsArray.push(ledMesh);
        }
      }

      // 4. Critical Alert Halo on R-09
      if (cfg.id === 'R-09') {
        const haloGeo = new THREE.BoxGeometry(bodyW + 0.12, bodyH + 0.12, bodyD + 0.12);
        const haloMat = new THREE.MeshBasicMaterial({
          color: 0xef4444,
          wireframe: true,
          transparent: true,
          opacity: 0.45
        });
        this.r09HaloMesh = new THREE.Mesh(haloGeo, haloMat);
        rackGroup.add(this.r09HaloMesh);

        // 3D Spinning Holographic Alert Beacon
        const beaconGeo = new THREE.ConeGeometry(0.18, 0.32, 4);
        const beaconMat = new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: 0xef4444,
          emissiveIntensity: 3.5,
          roughness: 0.1
        });
        this.warningBeacon = new THREE.Mesh(beaconGeo, beaconMat);
        this.warningBeacon.position.set(0, bodyH / 2 + 0.35, 0);
        rackGroup.add(this.warningBeacon);
      }

      // 5. Invisible Hitbox for Raycasting
      const hitGeo = new THREE.BoxGeometry(bodyW + 0.1, bodyH + 0.1, bodyD + 0.2);
      const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.set(0, 0, 0);
      hitMesh.userData = { rackId: cfg.id, isRack: true };
      rackGroup.add(hitMesh);
      this.interactiveObjects.push(hitMesh);

      this.racksGroup.add(rackGroup);

      // 6. Create Floating HTML Badge Tag
      const badgeEl = this.createFloatingBadgeTag(cfg);

      this.racks.set(cfg.id, {
        group: rackGroup,
        hitMesh: hitMesh,
        badgeEl: badgeEl,
        leds: ledsArray,
        config: cfg
      });
    });

    // Default select R-09 on load
    setTimeout(() => this.selectRack('R-09'), 150);
  }

  /**
   * Creates floating HTML badge pill above each server rack
   */
  createFloatingBadgeTag(cfg) {
    const isCritical = cfg.id === 'R-09';
    const isWarning = cfg.status === 'WARNING';

    const badge = document.createElement('div');
    badge.className = `floating-rack-badge ${isCritical ? 'badge-rack-critical' : (isWarning ? 'badge-rack-warning' : '')}`;
    badge.setAttribute('data-rack-id', cfg.id);

    if (isCritical) {
      badge.innerHTML = `<span class="badge-alert-icon">⚠️</span> <span>${cfg.id}</span>`;
    } else if (isWarning) {
      badge.innerHTML = `<span class="badge-warn-icon">&bull;</span> <span>${cfg.id}</span>`;
    } else {
      badge.innerHTML = `<span>${cfg.id}</span>`;
    }

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectRack(cfg.id);
    });

    this.container.appendChild(badge);
    return badge;
  }

  /**
   * Updates floating badges screen positions on every animation frame
   */
  updateFloatingBadges() {
    if (!this.camera) return;

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const tempVec = new THREE.Vector3();

    this.racks.forEach((data, id) => {
      const rackGroup = data.group;
      const badgeEl = data.badgeEl;
      if (!rackGroup || !badgeEl) return;

      // Top of the rack in world space
      tempVec.set(rackGroup.position.x, rackGroup.position.y + 1.25, rackGroup.position.z);
      tempVec.project(this.camera);

      // Behind camera check
      if (tempVec.z > 1) {
        badgeEl.style.display = 'none';
        return;
      }

      badgeEl.style.display = 'flex';
      const screenX = (tempVec.x * 0.5 + 0.5) * w;
      const screenY = (-(tempVec.y * 0.5) + 0.5) * h;

      badgeEl.style.left = `${screenX}px`;
      badgeEl.style.top = `${screenY}px`;
    });
  }

  onRackSelect(callback) {
    this.onRackSelectCallback = callback;
  }

  remediateServer(rackId) {
    if (rackId === 'R-09') {
      this.remediateR09();
    }
  }

  /**
   * Selects a server rack and applies visual focus
   */
  selectRack(rackId) {
    if (!this.racks.has(rackId)) return;

    this.selectedRackId = rackId;

    // Update badge styling
    this.racks.forEach((data, id) => {
      if (data.badgeEl) {
        if (id === rackId) {
          data.badgeEl.classList.add('badge-active-selected');
        } else {
          data.badgeEl.classList.remove('badge-active-selected');
        }
      }
    });

    if (this.onRackSelectCallback) {
      this.onRackSelectCallback(rackId);
    }
  }

  /**
   * Camera Presets: Overview, Left, Right, Focus R-09
   */
  setCameraPreset(presetName) {
    if (!this.controls || !this.camera) return;

    let targetPos = new THREE.Vector3(0, 0.35, 9.2);
    let targetLook = new THREE.Vector3(0, -0.15, 0);

    switch (presetName) {
      case 'left':
        targetPos.set(-2.1, 0.25, 6.2);
        targetLook.set(-2.1, -0.2, 0);
        break;
      case 'right':
        targetPos.set(2.1, 0.25, 6.2);
        targetLook.set(2.1, -0.2, 0);
        break;
      case 'r09':
        targetPos.set(2.45, 0.15, 4.2);
        targetLook.set(2.45, -0.25, 0);
        break;
      case 'overview':
      default:
        targetPos.set(0, 0.35, 9.2);
        targetLook.set(0, -0.15, 0);
        break;
    }

    this.smoothTransitionCamera(targetPos, targetLook);
  }

  smoothTransitionCamera(targetPos, targetLook) {
    const startPos = this.camera.position.clone();
    const startLook = this.controls.target.clone();
    const duration = 750; // ms
    const startTime = performance.now();

    const animateStep = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      const ease = 0.5 - Math.cos(progress * Math.PI) / 2; // Smooth cosine ease

      this.camera.position.lerpVectors(startPos, targetPos, ease);
      this.controls.target.lerpVectors(startLook, targetLook, ease);
      this.controls.update();

      if (progress < 1.0) {
        requestAnimationFrame(animateStep);
      }
    };

    requestAnimationFrame(animateStep);
  }

  /**
   * Raycasting Pointer Interaction
   */
  onPointerDown(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      if (hit.userData && hit.userData.rackId) {
        this.selectRack(hit.userData.rackId);
      }
    }
  }

  /**
   * Auto-Remediation: Restores R-09 to Nominal Healthy Green
   */
  remediateR09() {
    this.isAlertActive = false;

    // 1. Hide Critical Beacon and Halo
    if (this.warningBeacon) this.warningBeacon.visible = false;
    if (this.r09HaloMesh) this.r09HaloMesh.visible = false;
    if (this.r09Light) this.r09Light.intensity = 0.0;

    // 2. Turn R-09 LEDs to Emerald Green
    const r09Data = this.racks.get('R-09');
    if (r09Data && r09Data.leds) {
      const greenMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      r09Data.leds.forEach((led) => {
        led.material = greenMat;
      });
    }

    // 3. Update Badge to Normal
    if (r09Data && r09Data.badgeEl) {
      r09Data.badgeEl.className = 'floating-rack-badge badge-active-selected';
      r09Data.badgeEl.innerHTML = `<span>● R-09</span>`;
    }

    // 4. Remove emergency border from viewport card
    const card = document.getElementById('viewport-3d-card');
    if (card) card.classList.remove('in-emergency');
  }

  /**
   * Triggers Critical Outage Alert Simulation on R-09
   */
  triggerAlertSimulation() {
    this.isAlertActive = true;

    // 1. Show Warning Beacon & Alert Halo
    if (this.warningBeacon) this.warningBeacon.visible = true;
    if (this.r09HaloMesh) this.r09HaloMesh.visible = true;
    if (this.r09Light) this.r09Light.intensity = 4.0;

    // 2. Set R-09 LEDs to Intense Red
    const r09Data = this.racks.get('R-09');
    if (r09Data && r09Data.leds) {
      const redMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      r09Data.leds.forEach((led) => {
        led.material = redMat;
      });
    }

    // 3. Update Badge to Critical
    if (r09Data && r09Data.badgeEl) {
      r09Data.badgeEl.className = 'floating-rack-badge badge-rack-critical badge-active-selected';
      r09Data.badgeEl.innerHTML = `<span class="badge-alert-icon">⚠️</span> <span>R-09</span>`;
    }

    // 4. Select R-09 and focus camera
    this.selectRack('R-09');

    // 5. Add emergency glow border to viewport card
    const card = document.getElementById('viewport-3d-card');
    if (card) card.classList.add('in-emergency');
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /**
   * Main Render & Animation Loop
   */
  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    if (this.controls) {
      this.controls.update();
    }

    // Emergency Beacon & Halo Pulsing
    if (this.isAlertActive) {
      if (this.warningBeacon) {
        this.warningBeacon.rotation.y += delta * 2.8;
      }
      if (this.r09HaloMesh) {
        const pulse = 0.35 + 0.25 * Math.sin(time * 5.0);
        this.r09HaloMesh.material.opacity = pulse;
      }
      if (this.r09Light) {
        this.r09Light.intensity = 3.0 + 2.0 * Math.sin(time * 6.0);
      }
    }

    // Update screen positions of 10 floating badges
    this.updateFloatingBadges();

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
