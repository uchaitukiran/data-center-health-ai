/**
 * DC Health AI - Command Center Digital Twin Engine
 * Real 3D Model: /models/dc with int.glb
 *
 * Architecture:
 * 1. Direct GLTF Loading of dc with int.glb:
 *    - Left Cluster: 5 Server Racks (R-01..R-05)
 *    - Right Cluster: 5 Server Racks (R-06..R-10)
 *    - Central corridor aisle
 *    - Overhead ceiling ventilation pipes, acoustic panels, and hanging industrial lamps
 *    - Floor-to-ceiling panoramic glass windows
 * 2. Background Sky & Unreal-Engine Daylighting:
 *    - Panoramic daylight sky (/images/sky.png) visible through room windows
 *    - ACESFilmic tone mapping with RoomEnvironment specular reflections on server chassis
 *    - Warm directional sunlight casting soft shadows across the racks and floor
 *    - Pulsing red emergency light over R-09
 * 3. 10 Interactive Floating Badges:
 *    - R-01 to R-10 anchored to the exact 3D rack columns
 *    - R-09 in Critical Red with pulsing alert halo and spinning 3D holographic beacon
 *    - R-03 and R-08 in Amber Warning
 *    - Raycasting click selection updates the inspector
 * 4. Camera Controls:
 *    - Overview, Left Racks, Right Racks, Focus R-09 presets
 *    - Left & right rotation and zoom in / zoom out
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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
    this.glbScene = null;
    this.r09HaloMesh = null;
    this.r09Light = null;
    this.warningBeacon = null;

    // Animation state
    this.clock = new THREE.Clock();
    this.isAlertActive = true;
    this.modelLoaded = false;

    this.init();
  }

  init() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 500;

    // 1. Camera: Centered inside datacenter room at eye level looking down the aisle
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
    this.camera.position.set(21.9, 16.5, 68);

    // 2. High-Fidelity WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 3. PMREM Environment Generator for realistic PBR metal reflections on server racks
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    // 4. Orbit Controls: Left/Right rotation only, Zoom In/Out only
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(21.9, 12, 0);

    // Lock polar angle around eye level (approx 74° to 90°)
    this.controls.minPolarAngle = 1.28;
    this.controls.maxPolarAngle = 1.57;

    // Azimuth bounds: broad left/right viewing without flipping
    this.controls.minAzimuthAngle = -Math.PI / 3.0;
    this.controls.maxAzimuthAngle = Math.PI / 3.0;

    // Zoom limits
    this.controls.minDistance = 25.0;
    this.controls.maxDistance = 110.0;

    // 5. Daylight Sky Background
    this.setupSkyBackground();

    // 6. Unreal Engine Lighting
    this.setupLighting();

    // 7. Load Real 3D Model: dc with int.glb
    this.loadDCWithInteriorGLB();

    // 8. Build 10 Interactive Rack Slots, Badges & Alert Effects
    this.build10RackSlots();

    // 9. Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));

    // 10. Animation Loop
    this.animate();
  }

  /**
   * Sets up panoramic daylight sky background visible through windows
   */
  setupSkyBackground() {
    new THREE.TextureLoader().load('/images/sky.png', (skyTex) => {
      skyTex.colorSpace = THREE.SRGBColorSpace;
      this.scene.background = skyTex;
    });
  }

  /**
   * Sets up bright, clean daylight illumination
   */
  setupLighting() {
    // Ambient daylight fill
    this.ambientLight = new THREE.AmbientLight(0xffffff, 2.4);
    this.scene.add(this.ambientLight);

    // Directional sunlight shining from windows
    this.sunLight = new THREE.DirectionalLight(0xfffaf0, 3.2);
    this.sunLight.position.set(60, 120, 80);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 1.0;
    this.sunLight.shadow.camera.far = 300;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // Hemisphere sky bounce light
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x445566, 1.8);
    this.scene.add(hemiLight);

    // Dedicated pulsing red emergency light over R-09
    this.r09Light = new THREE.PointLight(0xef4444, 4.5, 30.0, 1.5);
    this.r09Light.position.set(61, 28, 10);
    this.scene.add(this.r09Light);
  }

  /**
   * Loads the user's 3D Model: dc with int.glb
   */
  loadDCWithInteriorGLB() {
    const loader = new GLTFLoader();
    const modelUrl = '/models/dc%20with%20int.glb';

    loader.load(
      modelUrl,
      (gltf) => {
        this.glbScene = gltf.scene;
        this.scene.add(this.glbScene);

        this.glbScene.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.side = THREE.DoubleSide;
              // Remove the solid black roof slab so sunlight and sky illuminate from above
              if (child.material.name === 'Roof') {
                child.visible = false;
              }
            }
          }
        });

        this.modelLoaded = true;
        console.log('[Three.js] dc with int.glb successfully loaded and rendered!');
      },
      (xhr) => {
        const pct = Math.round((xhr.loaded / 12224992) * 100);
        console.log(`[Three.js] Loading dc with int.glb: ${pct}%`);
      },
      (err) => {
        console.error('[Three.js] Error loading dc with int.glb:', err);
      }
    );
  }

  /**
   * Builds the 10 Interactive Rack Slots, Floating Badges, and Alert FX
   * Anchored to the exact coordinates of dc with int.glb
   */
  build10RackSlots() {
    const rackDefs = [
      // Left Cluster (R-01..R-05)
      { id: 'R-01', x: -27, y: 25.5, z: 8, status: 'NORMAL' },
      { id: 'R-02', x: -18, y: 25.5, z: 8, status: 'NORMAL' },
      { id: 'R-03', x: -9.5, y: 25.5, z: 8, status: 'WARNING' },
      { id: 'R-04', x: -1, y: 25.5, z: 8, status: 'NORMAL' },
      { id: 'R-05', x: 7.5, y: 25.5, z: 8, status: 'NORMAL' },
      // Right Cluster (R-06..R-10)
      { id: 'R-06', x: 35.5, y: 25.5, z: 8, status: 'NORMAL' },
      { id: 'R-07', x: 44, y: 25.5, z: 8, status: 'NORMAL' },
      { id: 'R-08', x: 52.5, y: 25.5, z: 8, status: 'WARNING' },
      { id: 'R-09', x: 61, y: 25.5, z: 8, status: 'CRITICAL' },
      { id: 'R-10', x: 69.5, y: 25.5, z: 8, status: 'NORMAL' }
    ];

    rackDefs.forEach((cfg) => {
      // 1. Raycasting Click Hitbox
      const hitGeo = new THREE.BoxGeometry(8, 26, 14);
      const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.set(cfg.x, 13, cfg.z);
      hitMesh.userData = { rackId: cfg.id, isRack: true };
      this.scene.add(hitMesh);
      this.interactiveObjects.push(hitMesh);

      // 2. Floating HTML Badge Pill
      const badgeEl = this.createFloatingBadgeTag(cfg);

      this.racks.set(cfg.id, {
        hitMesh: hitMesh,
        badgeEl: badgeEl,
        worldPos: new THREE.Vector3(cfg.x, cfg.y, cfg.z),
        config: cfg
      });
    });

    // 3. Critical Alert Halo on R-09
    const haloGeo = new THREE.BoxGeometry(8.5, 26.5, 14.5);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    this.r09HaloMesh = new THREE.Mesh(haloGeo, haloMat);
    this.r09HaloMesh.position.set(61, 13, 8);
    this.scene.add(this.r09HaloMesh);

    // 4. Spinning 3D Holographic Warning Pyramid Beacon over R-09
    const beaconGeo = new THREE.ConeGeometry(1.8, 3.2, 4);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 3.5,
      roughness: 0.1
    });
    this.warningBeacon = new THREE.Mesh(beaconGeo, beaconMat);
    this.warningBeacon.position.set(61, 28, 8);
    this.scene.add(this.warningBeacon);

    // Default select R-09 on load
    setTimeout(() => this.selectRack('R-09'), 200);
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
      const badgeEl = data.badgeEl;
      if (!badgeEl) return;

      tempVec.copy(data.worldPos);
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
   * Camera Presets: Overview, Left Racks, Right Racks, Focus R-09
   */
  setCameraPreset(presetName) {
    if (!this.controls || !this.camera) return;

    let targetPos = new THREE.Vector3(21.9, 16.5, 68);
    let targetLook = new THREE.Vector3(21.9, 12, 0);

    switch (presetName) {
      case 'left':
        targetPos.set(-3.0, 15, 48);
        targetLook.set(-8.8, 11, 0);
        break;
      case 'right':
        targetPos.set(46.0, 15, 48);
        targetLook.set(52.6, 11, 0);
        break;
      case 'r09':
        targetPos.set(55.0, 13, 30);
        targetLook.set(61.0, 10, 8);
        break;
      case 'overview':
      default:
        targetPos.set(21.9, 16.5, 68);
        targetLook.set(21.9, 12, 0);
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
      const ease = 0.5 - Math.cos(progress * Math.PI) / 2; // Cosine ease

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

    // 2. Update Badge to Normal
    const r09Data = this.racks.get('R-09');
    if (r09Data && r09Data.badgeEl) {
      r09Data.badgeEl.className = 'floating-rack-badge badge-active-selected';
      r09Data.badgeEl.innerHTML = `<span>● R-09</span>`;
    }

    // 3. Remove emergency border from viewport card
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
    if (this.r09Light) this.r09Light.intensity = 4.5;

    // 2. Update Badge to Critical
    const r09Data = this.racks.get('R-09');
    if (r09Data && r09Data.badgeEl) {
      r09Data.badgeEl.className = 'floating-rack-badge badge-rack-critical badge-active-selected';
      r09Data.badgeEl.innerHTML = `<span class="badge-alert-icon">⚠️</span> <span>R-09</span>`;
    }

    // 3. Select R-09 and focus camera
    this.selectRack('R-09');

    // 4. Add emergency glow border to viewport card
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
        const pulse = 0.4 + 0.25 * Math.sin(time * 5.0);
        this.r09HaloMesh.material.opacity = pulse;
      }
      if (this.r09Light) {
        this.r09Light.intensity = 3.5 + 2.0 * Math.sin(time * 6.0);
      }
    }

    // Update screen positions of 10 floating badges
    this.updateFloatingBadges();

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
