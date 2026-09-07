/**
 * Ultra-Premium MNC 3D Data Center Digital Twin Engine
 * Hyperscale Server Room with PBR materials, modular server blades, animated LED arrays,
 * overhead cable raceways, reflective epoxy floor, holographic 3D billboards, and thermal heatmap mode.
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

    // Rack entities and materials registry
    this.racks = new Map(); // rackId -> { group, frameMesh, bladeMeshes, beaconLight, beaconMesh, billboardSprite, data }
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

    // 2. High-Performance WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 3. Cyber Data Center Fog & Background
    this.scene.background = new THREE.Color(0x06090e);
    this.scene.fog = new THREE.FogExp2(0x06090e, 0.02);

    // 4. Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 65;
    this.controls.target.set(0, 2.5, 0);

    // 5. Environmental Lighting & Ceiling LED Strips
    this.setupLighting();

    // 6. High-Tech Data Center Architecture (Floor, Ceiling, Walls, Cable Trays)
    this.buildDataCenterArchitecture();

    // 7. Construct Hyper-Detailed Server Racks
    this.buildDetailedServerFleet();

    // 8. Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));

    // 9. Render Loop
    this.animate();
  }

  setupLighting() {
    // Ambient fill
    const ambient = new THREE.AmbientLight(0x162235, 2.0);
    this.scene.add(ambient);

    // Main Cool Key Light
    const keyLight = new THREE.DirectionalLight(0xd0e8ff, 3.0);
    keyLight.position.set(12, 22, 16);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 60;
    keyLight.shadow.camera.left = -20;
    keyLight.shadow.camera.right = 20;
    keyLight.shadow.camera.top = 20;
    keyLight.shadow.camera.bottom = -20;
    this.scene.add(keyLight);

    // Cyber Purple Rim Light
    const rimLight = new THREE.DirectionalLight(0x7928ca, 2.2);
    rimLight.position.set(-18, 16, -14);
    this.scene.add(rimLight);

    // Cyan Fill from opposite side
    const cyanLight = new THREE.DirectionalLight(0x00d2ff, 1.8);
    cyanLight.position.set(-15, 12, 18);
    this.scene.add(cyanLight);

    // Linear Aisle Downlights (Overhead LED Strips)
    [-4.5, 4.5].forEach((zPos) => {
      for (let x = -8; x <= 8; x += 8) {
        const stripLight = new THREE.PointLight(0xe2f1ff, 1.8, 18, 1.5);
        stripLight.position.set(x, 8.2, zPos);
        this.scene.add(stripLight);
      }
    });
  }

  buildDataCenterArchitecture() {
    // 1. Polished Epoxy Raised Floor with Hex/Tile Texture
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const ctx = floorCanvas.getContext('2d');
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, 512, 512);

    // Grid tile lines
    ctx.strokeStyle = '#122033';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 512, 512);

    // Subtle inner tile corner markings
    ctx.strokeStyle = '#00d2ff22';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 472, 472);

    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(16, 16);

    const floorGeo = new THREE.PlaneGeometry(80, 80);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.25,
      metalness: 0.85,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Glowing Cyan Aisle Runners on Floor
    [-4.5, 4.5].forEach(z => {
      const runnerGeo = new THREE.PlaneGeometry(24, 0.15);
      const runnerMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
      const runner = new THREE.Mesh(runnerGeo, runnerMat);
      runner.rotation.x = -Math.PI / 2;
      runner.position.set(0, 0.02, z + 2.0);
      this.scene.add(runner);

      const runner2 = runner.clone();
      runner2.position.z = z - 2.0;
      this.scene.add(runner2);
    });

    // 2. Structural Containment Walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0c111a,
      roughness: 0.6,
      metalness: 0.4
    });

    // Back Wall
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(40, 12), wallMat);
    backWall.position.set(0, 6, -16);
    this.scene.add(backWall);

    // Side Wall Left
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(32, 12), wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-20, 6, 0);
    this.scene.add(leftWall);

    // Data Center Signage on Back Wall
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 1024;
    signCanvas.height = 256;
    const signCtx = signCanvas.getContext('2d');
    signCtx.fillStyle = '#06090e';
    signCtx.fillRect(0, 0, 1024, 256);
    signCtx.font = 'bold 54px monospace';
    signCtx.fillStyle = '#00d2ff';
    signCtx.fillText('HYPERSCALE POD-04 // NOC EAST-1', 40, 100);
    signCtx.font = '32px sans-serif';
    signCtx.fillStyle = '#6882a6';
    signCtx.fillText('AIOPS TELEMETRY DIGITAL TWIN • 42U HIGH-DENSITY CLUSTER', 40, 160);

    const signTexture = new THREE.CanvasTexture(signCanvas);
    const signMat = new THREE.MeshBasicMaterial({ map: signTexture, transparent: true });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), signMat);
    signMesh.position.set(0, 7.5, -15.9);
    this.scene.add(signMesh);

    // 3. Overhead Cable Raceways (Yellow Fiber Trays)
    const trayMat = new THREE.MeshStandardMaterial({ color: 0xffb700, roughness: 0.4, metalness: 0.5 });
    [-4.5, 4.5].forEach(z => {
      const trayGeo = new THREE.BoxGeometry(22, 0.2, 0.8);
      const tray = new THREE.Mesh(trayGeo, trayMat);
      tray.position.set(0, 6.2, z);
      this.scene.add(tray);
    });

    // 4. Ambient Cyber Dust Particles
    const particleGeo = new THREE.BufferGeometry();
    const particleCount = 200;
    const posArr = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      posArr[i] = (Math.random() - 0.5) * 30;
      posArr[i + 1] = Math.random() * 8 + 0.5;
      posArr[i + 2] = (Math.random() - 0.5) * 25;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.08,
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.4
    });
    this.particleSystem = new THREE.Points(particleGeo, particleMat);
    this.scene.add(this.particleSystem);
  }

  buildDetailedServerFleet() {
    const rackDefs = [
      { id: "RACK-01", name: "Compute Alpha", x: -6.5, z: -4.5 },
      { id: "RACK-02", name: "Compute Beta", x: -2.2, z: -4.5 },
      { id: "RACK-03", name: "Storage SAN 1", x: 2.2, z: -4.5 },
      { id: "RACK-04", name: "Database Primary", x: 6.5, z: -4.5 },
      { id: "RACK-05", name: "AI Worker 01", x: -6.5, z: 4.5 },
      { id: "RACK-06", name: "AI Worker 02", x: -2.2, z: 4.5 },
      { id: "RACK-07", name: "Gateway 01", x: 2.2, z: 4.5 },
      { id: "RACK-08", name: "Gateway 02", x: 6.5, z: 4.5 },
    ];

    rackDefs.forEach((def) => {
      const rackGroup = this.createRealisticServerRack(def);
      this.scene.add(rackGroup);
    });
  }

  createRealisticServerRack(def) {
    const group = new THREE.Group();
    group.position.set(def.x, 0, def.z);

    // 1. Heavy Metal 42U Frame
    const frameGeo = new THREE.BoxGeometry(2.0, 5.2, 1.8);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x111620,
      roughness: 0.35,
      metalness: 0.88
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.y = 2.6;
    frameMesh.castShadow = true;
    frameMesh.receiveShadow = true;
    group.add(frameMesh);

    // Glass / Perforated Front Door Frame
    const doorFrameGeo = new THREE.BoxGeometry(1.85, 4.9, 0.08);
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x1a2434,
      roughness: 0.2,
      metalness: 0.9,
      transparent: true,
      opacity: 0.85
    });
    const doorMesh = new THREE.Mesh(doorFrameGeo, doorMat);
    doorMesh.position.set(0, 2.6, 0.94);
    group.add(doorMesh);

    // 2. Individual Modular Server Blades (7 Blades stacked)
    const bladeMeshes = [];
    const bladeGeo = new THREE.BoxGeometry(1.7, 0.55, 1.6);

    for (let i = 0; i < 7; i++) {
      const yOffset = 0.8 + i * 0.62;
      const bladeMat = new THREE.MeshStandardMaterial({
        color: 0x18202d,
        roughness: 0.4,
        metalness: 0.8
      });
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.set(0, yOffset, 0.05);
      group.add(blade);
      bladeMeshes.push(blade);

      // Silver Blade Handles
      const handleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 });
      const handleL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.08), handleMat);
      handleL.position.set(-0.8, yOffset, 0.9);
      const handleR = handleL.clone();
      handleR.position.x = 0.8;
      group.add(handleL);
      group.add(handleR);

      // Micro Activity LEDs on each blade
      for (let ledIdx = 0; ledIdx < 3; ledIdx++) {
        const ledGeo = new THREE.SphereGeometry(0.025, 8, 8);
        const ledMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(-0.6 + ledIdx * 0.08, yOffset, 0.92);
        group.add(led);
        this.blinkingLeds.push({ mesh: led, baseColor: 0x00ff88, seed: Math.random() * 100 });
      }
    }

    // 3. Status Beacon Tower Light on Rack Roof
    const beaconGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.35, 16);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00ff88,
      emissiveIntensity: 1.5,
      roughness: 0.2
    });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.set(0, 5.38, 0);
    group.add(beaconMesh);

    // Beacon Point Light
    const beaconLight = new THREE.PointLight(0x00ff88, 1.2, 8);
    beaconLight.position.set(0, 5.6, 0);
    group.add(beaconLight);

    // 4. Floating Holographic 3D Billboard Badge
    const billboardSprite = this.createHolographicBillboard(def.id, "NORMAL", 18, 32);
    billboardSprite.position.set(0, 6.9, 0);
    group.add(billboardSprite);

    // Setup Raycasting metadata
    group.userData = {
      rackId: def.id,
      name: def.name,
      isRack: true
    };
    frameMesh.userData = group.userData;
    doorMesh.userData = group.userData;

    this.interactiveObjects.push(frameMesh, doorMesh);

    this.racks.set(def.id, {
      group,
      frameMesh,
      bladeMeshes,
      beaconLight,
      beaconMesh,
      billboardSprite,
      data: {
        rack_id: def.id,
        name: def.name,
        risk_score: 18,
        severity: "NORMAL",
        temp_c: 32
      }
    });

    return group;
  }

  createHolographicBillboard(rackId, severity, risk, temp) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    this.drawBillboardCanvas(canvas, rackId, severity, risk, temp);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.4, 1.2, 1.0);
    sprite.userData = { canvas, texture };
    return sprite;
  }

  drawBillboardCanvas(canvas, rackId, severity, risk, temp) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isCritical = severity === "CRITICAL";
    const isWarning = severity === "WARNING";

    const borderColor = isCritical ? '#ff385c' : (isWarning ? '#ffb700' : '#00d2ff');
    const glowColor = isCritical ? 'rgba(255, 56, 92, 0.4)' : (isWarning ? 'rgba(255, 183, 0, 0.4)' : 'rgba(0, 210, 255, 0.3)');

    // Cyber pill card
    ctx.fillStyle = 'rgba(10, 16, 26, 0.88)';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 112, 16);
    ctx.fill();
    ctx.stroke();

    // Top Rack ID Title
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(rackId, 24, 42);

    // Status Pill
    ctx.fillStyle = isCritical ? '#ff385c' : (isWarning ? '#ffb700' : '#00ff88');
    ctx.beginPath();
    ctx.arc(220, 34, 8, 0, Math.PI * 2);
    ctx.fill();

    // Bottom Telemetry Metrics
    ctx.font = 'bold 26px monospace';
    ctx.fillStyle = borderColor;
    ctx.fillText(`${Math.round(risk)}% RISK`, 24, 85);

    ctx.font = '20px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`${Math.round(temp)}°C`, 160, 85);
  }

  updateRackTelemetry(rackState) {
    const rack = this.racks.get(rackState.rack_id);
    if (!rack) return;

    rack.data = rackState;
    const severity = rackState.severity;
    const risk = rackState.risk_score;
    const temp = rackState.temp_c;

    let hexColor = 0x00ff88; // Emerald
    if (severity === "CRITICAL") hexColor = 0xff385c;
    else if (severity === "WARNING") hexColor = 0xffb700;

    // 1. Update Beacon Tower Light & Material
    rack.beaconMesh.material.color.setHex(hexColor);
    rack.beaconMesh.material.emissive.setHex(hexColor);
    rack.beaconLight.color.setHex(hexColor);
    rack.beaconLight.intensity = severity === "CRITICAL" ? 3.5 : (severity === "WARNING" ? 2.0 : 1.2);

    // 2. Update Thermal or PBR Mode Materials
    if (this.thermalMode) {
      const thermalColor = this.getThermalColor(temp);
      rack.bladeMeshes.forEach(blade => blade.material.color.set(thermalColor));
      rack.frameMesh.material.color.set(0x0c111c);
    } else {
      // Nominal PBR look with subtle front glow
      const bladeColor = severity === "CRITICAL" ? 0x2a141c : (severity === "WARNING" ? 0x282014 : 0x18202d);
      rack.bladeMeshes.forEach(blade => blade.material.color.setHex(bladeColor));
      rack.frameMesh.material.color.setHex(0x111620);
    }

    // 3. Redraw 3D Floating Billboard Sprite
    if (rack.billboardSprite && rack.billboardSprite.userData.canvas) {
      const canvas = rack.billboardSprite.userData.canvas;
      const texture = rack.billboardSprite.userData.texture;
      this.drawBillboardCanvas(canvas, rackState.rack_id, severity, risk, temp);
      texture.needsUpdate = true;
    }
  }

  getThermalColor(temp) {
    // Thermal FLIR scale: 20C (cyan) -> 35C (green) -> 55C (yellow) -> 75C+ (red/magenta)
    const t = THREE.MathUtils.clamp((temp - 20) / 60, 0, 1);
    const color = new THREE.Color();
    if (t < 0.3) {
      color.lerpColors(new THREE.Color(0x00d2ff), new THREE.Color(0x00ff88), t / 0.3);
    } else if (t < 0.7) {
      color.lerpColors(new THREE.Color(0x00ff88), new THREE.Color(0xffb700), (t - 0.3) / 0.4);
    } else {
      color.lerpColors(new THREE.Color(0xffb700), new THREE.Color(0xff0055), (t - 0.7) / 0.3);
    }
    return color;
  }

  toggleThermalMode(enabled) {
    this.thermalMode = enabled;
    this.racks.forEach(r => {
      this.updateRackTelemetry(r.data);
    });
  }

  setCameraPreset(presetName) {
    this.isAutoOrbit = false;
    const duration = 1200;

    const presets = {
      isometric: { pos: new THREE.Vector3(18, 14, 22), target: new THREE.Vector3(0, 2.5, 0) },
      aisle1: { pos: new THREE.Vector3(-14, 3.2, -4.5), target: new THREE.Vector3(10, 3.2, -4.5) },
      aisle2: { pos: new THREE.Vector3(-14, 3.2, 4.5), target: new THREE.Vector3(10, 3.2, 4.5) },
      topdown: { pos: new THREE.Vector3(0, 26, 0.1), target: new THREE.Vector3(0, 0, 0) },
      orbit: { pos: this.camera.position.clone(), target: new THREE.Vector3(0, 2.5, 0) }
    };

    const targetPreset = presets[presetName] || presets.isometric;
    if (presetName === 'orbit') {
      this.isAutoOrbit = true;
      return;
    }

    this.smoothCameraTransition(targetPreset.pos, targetPreset.target, duration);
  }

  focusOnRack(rackId) {
    const rack = this.racks.get(rackId);
    if (!rack) return;

    const rackPos = rack.group.position;
    const targetLook = new THREE.Vector3(rackPos.x, 2.8, rackPos.z);
    // Position camera 6 meters in front of the rack
    const camZ = rackPos.z > 0 ? rackPos.z + 5.5 : rackPos.z - 5.5;
    const targetPos = new THREE.Vector3(rackPos.x + 1.2, 3.5, camZ);

    this.smoothCameraTransition(targetPos, targetLook, 1000);
  }

  smoothCameraTransition(targetPos, targetLook, duration = 1000) {
    const startPos = this.camera.position.clone();
    const startLook = this.controls.target.clone();
    const startTime = performance.now();

    const animateTransition = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      // Smooth easeInOutCubic
      const ease = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.camera.position.lerpVectors(startPos, targetPos, ease);
      this.controls.target.lerpVectors(startLook, targetLook, ease);

      if (progress < 1.0) {
        requestAnimationFrame(animateTransition);
      }
    };
    requestAnimationFrame(animateTransition);
  }

  onPointerDown(event) {
    if (event.clientY < 75) return; // Navbar guard

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const rackId = hit.userData.rackId;
      if (rackId && this.onRackClickCallback) {
        this.onRackClickCallback(rackId);
        this.focusOnRack(rackId);
      }
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const time = performance.now() * 0.001;

    // 1. Auto-Orbit Mode
    if (this.isAutoOrbit) {
      const radius = 24;
      this.camera.position.x = Math.sin(time * 0.15) * radius;
      this.camera.position.z = Math.cos(time * 0.15) * radius;
      this.camera.position.y = 12 + Math.sin(time * 0.2) * 2;
      this.controls.target.set(0, 2.5, 0);
    }

    this.controls.update();

    // 2. Micro Activity LED Flickering
    this.blinkingLeds.forEach(item => {
      const noise = Math.sin(time * 8 + item.seed);
      item.mesh.visible = noise > -0.2;
    });

    // 3. Pulsing Beacons on Warning / Critical Alert
    this.racks.forEach(rack => {
      const severity = rack.data ? rack.data.severity : "NORMAL";
      if (severity === "CRITICAL") {
        const pulse = 1.0 + Math.sin(time * 10) * 0.8;
        rack.beaconLight.intensity = 2.5 * pulse;
        rack.beaconMesh.scale.set(pulse, pulse, pulse);
      } else if (severity === "WARNING") {
        const pulse = 1.0 + Math.sin(time * 4) * 0.4;
        rack.beaconLight.intensity = 1.8 * pulse;
        rack.beaconMesh.scale.set(pulse, pulse, pulse);
      } else {
        rack.beaconMesh.scale.set(1, 1, 1);
      }
    });

    // 4. Subtle Particle Drift
    if (this.particleSystem) {
      const positions = this.particleSystem.geometry.attributes.position.array;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] -= 0.006;
        if (positions[i] < 0.2) positions[i] = 8.5;
      }
      this.particleSystem.geometry.attributes.position.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
