/**
 * Ultra-Premium MNC 3D Data Center Digital Twin Engine
 * Enterprise Light Theme (Apple / Stripe / AWS Sumerian / Datadog Light Aesthetic)
 * Daylight Architectural Studio Lighting, Dual GLB Facilities Loader (Alpha & Beta Halls),
 * Interactive Raycast Racks, Live Status Glow, Smooth Camera Transitions, and Thermal FLIR mode.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class DataCenterScene {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Active facility model group and loaders
    this.gltfLoader = new GLTFLoader();
    this.facilityGroup = null;
    this.currentFacility = 'dc-1';

    // Racks registry and interactive elements
    this.racks = new Map(); // rackId -> { group, mesh, statusMaterial, data }
    this.interactiveObjects = [];
    this.blinkingLeds = [];
    this.thermalMode = false;
    this.isAutoOrbit = false;
    this.cameraTargetPos = null;
    this.cameraLookTarget = null;
    this.onRackClickCallback = null;

    this.init();
  }

  init() {
    // 1. Perspective Camera
    this.camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(18, 14, 22);

    // 2. High-Performance WebGL Renderer with Light Tone Mapping
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 3. Crisp Light Theme Studio Background & Atmospheric Fog
    this.scene.background = new THREE.Color(0xf8fafc);
    this.scene.fog = new THREE.FogExp2(0xf1f5f9, 0.012);

    // 4. Smooth Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 65;
    this.controls.target.set(0, 2.5, 0);

    // 5. Daylight Architectural Studio Lighting
    this.setupLighting();

    // 6. Architectural Light Flooring & Studio Grid
    this.buildStudioFloor();

    // 7. Load Initial 3D Datacenter Facility (Alpha Compute Hall)
    this.loadFacility('dc-1');

    // 8. Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));

    // 9. Render Loop
    this.animate();
  }

  setupLighting() {
    // Soft daylight ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 2.4);
    this.scene.add(ambient);

    // Key Architectural Sunlight (Warm White)
    const sunLight = new THREE.DirectionalLight(0xfffbf0, 3.2);
    sunLight.position.set(16, 26, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 70;
    sunLight.shadow.camera.left = -22;
    sunLight.shadow.camera.right = 22;
    sunLight.shadow.camera.top = 22;
    sunLight.shadow.camera.bottom = -22;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);

    // Soft Sky Blue Fill Light
    const skyFill = new THREE.DirectionalLight(0xdbeafe, 1.6);
    skyFill.position.set(-18, 18, -14);
    this.scene.add(skyFill);

    // Crisp White Overhead Studio Strip Lights
    [-5, 5].forEach((zPos) => {
      for (let x = -8; x <= 8; x += 8) {
        const stripLight = new THREE.PointLight(0xffffff, 1.4, 20, 1.8);
        stripLight.position.set(x, 9.0, zPos);
        this.scene.add(stripLight);
      }
    });
  }

  buildStudioFloor() {
    // Clean, light glossy epoxy floor
    const floorGeo = new THREE.PlaneGeometry(80, 80);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.28,
      metalness: 0.12
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.02;
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);

    // Subtle architectural grid seams
    const gridHelper = new THREE.GridHelper(80, 40, 0xcbd5e1, 0xe2e8f0);
    gridHelper.position.y = 0.0;
    this.scene.add(gridHelper);
  }

  loadFacility(facilityId) {
    this.currentFacility = facilityId;

    // Remove existing facility group
    if (this.facilityGroup) {
      this.scene.remove(this.facilityGroup);
      this.facilityGroup.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
      this.facilityGroup = null;
    }

    this.racks.clear();
    this.interactiveObjects = [];
    this.blinkingLeds = [];

    // Determine target GLB model
    const modelPath = facilityId === 'dc-1'
      ? '/models/data_center_low-poly.glb'
      : '/models/data_center_low-poly_1.glb';

    console.log(`[Three.js] Loading GLB Model for ${facilityId}: ${modelPath}`);

    this.facilityGroup = new THREE.Group();
    this.scene.add(this.facilityGroup);

    this.gltfLoader.load(
      modelPath,
      (gltf) => {
        const model = gltf.scene;
        model.castShadow = true;
        model.receiveShadow = true;

        // Auto-scale and center
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Normalize scale to fit nicely in 25x25 footprint
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetScale = 22.0 / (maxDim || 1.0);
        model.scale.set(targetScale, targetScale, targetScale);

        // Re-center on floor
        box.setFromObject(model);
        box.getCenter(center);
        model.position.x -= center.x;
        model.position.y -= box.min.y; // Sit directly on floor
        model.position.z -= center.z;

        // Register meshes & enhance materials for light theme
        let rackIndex = 1;
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // In light theme, upgrade materials to crisp architectural PBR
            if (child.material) {
              const originalMat = child.material;
              const cleanMat = new THREE.MeshStandardMaterial({
                color: originalMat.color || 0xdbeafe,
                roughness: 0.35,
                metalness: 0.25
              });
              child.material = cleanMat;
            }

            // Bind rack entities (each major cluster represents a monitored rack)
            const rackId = `RACK-0${rackIndex <= 8 ? rackIndex : (rackIndex % 8) + 1}`;
            child.userData = {
              rackId: rackId,
              name: `Cluster Rack ${rackId} (${facilityId.toUpperCase()})`,
              isRack: true,
              facility: facilityId
            };

            // Emissive status indicator
            const statusMat = new THREE.MeshStandardMaterial({
              color: 0x10b981,
              emissive: 0x10b981,
              emissiveIntensity: 0.6,
              roughness: 0.2
            });

            this.racks.set(rackId, {
              mesh: child,
              statusMat: statusMat,
              originalMat: child.material,
              data: {
                id: rackId,
                name: `Compute Node ${rackId}`,
                riskScore: 18.0,
                severity: "NORMAL",
                facility: facilityId
              }
            });

            this.interactiveObjects.push(child);
            rackIndex++;
          }
        });

        this.facilityGroup.add(model);
        console.log(`[Three.js] Successfully loaded facility ${facilityId} with ${this.racks.size} monitored racks.`);
      },
      (xhr) => {
        // Loading progress
      },
      (error) => {
        console.error(`[Three.js] Failed loading GLB model ${modelPath}:`, error);
        // Fallback procedural racks if file load issue
        this.buildFallbackServerFleet();
      }
    );
  }

  buildFallbackServerFleet() {
    const rackCount = 8;
    for (let i = 0; i < rackCount; i++) {
      const rackId = `RACK-0${i + 1}`;
      const group = new THREE.Group();
      const x = (i % 4 - 1.5) * 4.5;
      const z = Math.floor(i / 4) * 7.0 - 3.5;
      group.position.set(x, 0, z);

      // Frame
      const frameGeo = new THREE.BoxGeometry(2.0, 5.0, 1.4);
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.3,
        metalness: 0.4
      });
      const frameMesh = new THREE.Mesh(frameGeo, frameMat);
      frameMesh.position.y = 2.5;
      frameMesh.castShadow = true;
      frameMesh.receiveShadow = true;
      frameMesh.userData = { rackId: rackId, isRack: true };
      group.add(frameMesh);

      // Status indicator LED bar
      const ledGeo = new THREE.BoxGeometry(1.6, 0.15, 0.05);
      const ledMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 0.8
      });
      const ledMesh = new THREE.Mesh(ledGeo, ledMat);
      ledMesh.position.set(0, 4.8, 0.72);
      group.add(ledMesh);

      this.facilityGroup.add(group);
      this.racks.set(rackId, {
        mesh: frameMesh,
        statusMat: ledMat,
        originalMat: frameMat,
        data: {
          id: rackId,
          name: `Compute Node ${rackId}`,
          riskScore: 18.0,
          severity: "NORMAL"
        }
      });
      this.interactiveObjects.push(frameMesh);
    }
  }

  updateRackTelemetry(arg1, arg2) {
    let rackId, telemetryData;
    if (typeof arg1 === 'string') {
      rackId = arg1;
      telemetryData = arg2 || {};
    } else if (arg1 && (arg1.rack_id || arg1.id)) {
      rackId = arg1.rack_id || arg1.id;
      telemetryData = arg1;
    } else {
      return;
    }

    const rack = this.racks.get(rackId);
    if (!rack) return;

    rack.data = { ...rack.data, ...telemetryData };
    const risk = telemetryData.riskScore || telemetryData.risk_score || 0;

    let targetColor = 0x10b981; // Green
    let emissiveIntensity = 0.6;

    if (risk >= 70.0) {
      targetColor = 0xef4444; // Red
      emissiveIntensity = 1.5;
      if (!this.blinkingLeds.includes(rack)) {
        this.blinkingLeds.push(rack);
      }
    } else if (risk >= 40.0) {
      targetColor = 0xf59e0b; // Amber
      emissiveIntensity = 1.0;
      const idx = this.blinkingLeds.indexOf(rack);
      if (idx !== -1) this.blinkingLeds.splice(idx, 1);
    } else {
      const idx = this.blinkingLeds.indexOf(rack);
      if (idx !== -1) this.blinkingLeds.splice(idx, 1);
    }

    if (rack.statusMat) {
      rack.statusMat.color.setHex(targetColor);
      rack.statusMat.emissive.setHex(targetColor);
      rack.statusMat.emissiveIntensity = emissiveIntensity;
    }

    // In Thermal FLIR mode, update color gradient
    if (this.thermalMode && rack.mesh && rack.mesh.material) {
      const temp = telemetryData.temp || (28 + (risk / 100) * 26);
      const t = Math.min(Math.max((temp - 24) / 28, 0), 1);
      const thermalColor = new THREE.Color().setHSL((1 - t) * 0.65, 1.0, 0.5);
      rack.mesh.material.color = thermalColor;
    }
  }

  setThermalMode(enabled) {
    this.thermalMode = enabled;
    this.racks.forEach((rack) => {
      if (enabled) {
        const risk = rack.data.riskScore || 18;
        const temp = 28 + (risk / 100) * 26;
        const t = Math.min(Math.max((temp - 24) / 28, 0), 1);
        const thermalColor = new THREE.Color().setHSL((1 - t) * 0.65, 1.0, 0.5);
        if (rack.mesh && rack.mesh.material) {
          rack.mesh.material.color = thermalColor;
          rack.mesh.material.emissive = thermalColor;
          rack.mesh.material.emissiveIntensity = 0.3;
        }
      } else {
        if (rack.mesh && rack.mesh.material && rack.originalMat) {
          rack.mesh.material.color = rack.originalMat.color || new THREE.Color(0xdbeafe);
          rack.mesh.material.emissive = new THREE.Color(0x000000);
          rack.mesh.material.emissiveIntensity = 0.0;
        }
      }
    });
  }

  setCameraPreset(preset) {
    this.isAutoOrbit = false;
    let targetPos = new THREE.Vector3(18, 14, 22);
    let lookAt = new THREE.Vector3(0, 2.5, 0);

    switch (preset) {
      case 'isometric':
        targetPos.set(18, 14, 22);
        lookAt.set(0, 2.5, 0);
        break;
      case 'aisle1':
        targetPos.set(-4.2, 4.0, 9.0);
        lookAt.set(-4.2, 3.0, -8.0);
        break;
      case 'aisle2':
        targetPos.set(4.2, 4.0, 9.0);
        lookAt.set(4.2, 3.0, -8.0);
        break;
      case 'topdown':
        targetPos.set(0, 32, 0.1);
        lookAt.set(0, 0, 0);
        break;
      case 'orbit':
        this.isAutoOrbit = true;
        return;
    }

    this.cameraTargetPos = targetPos;
    this.cameraLookTarget = lookAt;
  }

  focusOnRack(rackId) {
    const rack = this.racks.get(rackId);
    if (!rack || !rack.mesh) return;

    const worldPos = new THREE.Vector3();
    rack.mesh.getWorldPosition(worldPos);

    this.cameraTargetPos = new THREE.Vector3(
      worldPos.x + 4.5,
      worldPos.y + 2.5,
      worldPos.z + 5.0
    );
    this.cameraLookTarget = worldPos.clone();
  }

  onPointerDown(event) {
    // Raycasting for interactive rack click
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);

    if (intersects.length > 0) {
      let targetMesh = intersects[0].object;
      while (targetMesh && !targetMesh.userData.isRack && targetMesh.parent) {
        targetMesh = targetMesh.parent;
      }
      if (targetMesh && targetMesh.userData.isRack) {
        const rackId = targetMesh.userData.rackId;
        const rack = this.racks.get(rackId);
        if (rack && this.onRackClickCallback) {
          this.onRackClickCallback(rackId, rack.data);
        }
      }
    }
  }

  onRackClick(callback) {
    this.onRackClickCallback = callback;
  }

  onWindowResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const time = performance.now() * 0.001;

    // Smooth camera transition (lerp)
    if (this.cameraTargetPos && this.cameraLookTarget) {
      this.camera.position.lerp(this.cameraTargetPos, 0.05);
      this.controls.target.lerp(this.cameraLookTarget, 0.05);

      if (this.camera.position.distanceTo(this.cameraTargetPos) < 0.1) {
        this.cameraTargetPos = null;
        this.cameraLookTarget = null;
      }
    }

    // Drone Orbit Flythrough
    if (this.isAutoOrbit) {
      const radius = 24.0;
      const speed = 0.25;
      this.camera.position.x = Math.sin(time * speed) * radius;
      this.camera.position.z = Math.cos(time * speed) * radius;
      this.camera.position.y = 12.0 + Math.sin(time * 0.5) * 3.0;
      this.controls.target.set(0, 2.5, 0);
    }

    // Pulsing Critical Alerts
    if (this.blinkingLeds.length > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 6.0);
      this.blinkingLeds.forEach((rack) => {
        if (rack.statusMat) {
          rack.statusMat.emissiveIntensity = 0.5 + pulse * 1.5;
        }
      });
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
