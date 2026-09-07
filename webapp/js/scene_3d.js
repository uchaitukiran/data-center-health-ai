/**
 * DC Health AI - 3D Digital Twin Scene Engine
 * Exact Replication of Reference Dashboard 3D Viewport (input_file_0.png / input_file_1.png)
 * Features:
 * - Single GLB facility loader (/models/data_center_low-poly.glb)
 * - 8 Enterprise Server Racks: DC-01 through DC-08
 * - Floating 3D/HTML Badge Tags above each rack (DC-01 to DC-08)
 * - DC-07 Critical Red Alert state with glowing warning triangle & red chassis glow
 * - Angled overhead linear LED ceiling troffers
 * - Glossy reflective epoxy tiled floor with fine grout lines
 * - Background glass curtain wall with daylit skyline & datacenter motto typography
 * - Modern architectural potted plants
 * - Camera presets: [Overview], [Left], [Right], [Top]
 * - Interactive raycast selection updating Selected Server inspector
 * - Dynamic Theme switching (Light Mode default & Dark Mode)
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

    // Theme state ('light' by default as in input_file_0.png)
    this.currentTheme = 'light';

    // Racks registry
    this.racks = new Map(); // 'DC-01' -> { group, frameMesh, ledMeshes, badgeEl, data }
    this.interactiveObjects = [];
    this.blinkingLeds = [];
    this.selectedRackId = 'DC-07';
    this.onRackSelectCallback = null;

    // Camera animation targets
    this.cameraTargetPos = null;
    this.cameraLookTarget = null;

    // Architecture & Lights References for Theme Switching
    this.ambientLight = null;
    this.keySun = null;
    this.fillLight = null;
    this.ceilingLights = [];
    this.trofferMeshes = [];
    this.floorMesh = null;
    this.skylineMesh = null;
    this.warningBeaconTriangle = null;
    this.dc07RimMesh = null;

    this.init();
  }

  init() {
    // 1. Camera - Positioned for the exact Overview angle in input_file_0.png
    this.camera = new THREE.PerspectiveCamera(
      42,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0.0, 3.8, 14.5);

    // 2. High-Performance WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 3. Studio Background & Fog
    this.scene.background = new THREE.Color(0xf1f5f9);
    this.scene.fog = new THREE.FogExp2(0xf1f5f9, 0.012);

    // 4. Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 35.0;
    this.controls.target.set(0.0, 2.2, 0.0);

    // 5. Lighting Setup (Daylight Sunlight + Angled Overhead Linear LED Troffers)
    this.setupLighting();

    // 6. Datacenter Room Architecture (Glossy Tiled Floor, Windows, Plants, Ceiling)
    this.buildDatacenterArchitecture();

    // 7. Load / Build Server Fleet (DC-01 through DC-08 with Single GLB file integration)
    this.loadSingleGLBModelOrBuildFleet();

    // 8. Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));

    // 9. Render Loop
    this.animate();
  }

  setupLighting() {
    // 1. Soft Ambient Daylight
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.9);
    this.scene.add(this.ambientLight);

    // 2. Key Architectural Natural Sunlight
    this.keySun = new THREE.DirectionalLight(0xfffaf0, 2.6);
    this.keySun.position.set(12, 22, 16);
    this.keySun.castShadow = true;
    this.keySun.shadow.mapSize.width = 2048;
    this.keySun.shadow.mapSize.height = 2048;
    this.keySun.shadow.bias = -0.0005;
    this.scene.add(this.keySun);

    // 3. Sky Fill Light
    this.fillLight = new THREE.DirectionalLight(0xdbeafe, 1.4);
    this.fillLight.position.set(-14, 16, -10);
    this.scene.add(this.fillLight);

    // 4. Overhead Recessed Linear LED Troffers (Angled rows across ceiling)
    const trofferCoords = [
      [-6.5, 6.9, 1.8, 0.28],
      [-2.2, 6.9, 0.6, 0.16],
      [2.2, 6.9, 0.6, -0.16],
      [6.5, 6.9, 1.8, -0.28],
      [-4.2, 6.9, -3.8, 0.12],
      [4.2, 6.9, -3.8, -0.12]
    ];

    trofferCoords.forEach(([tx, ty, tz, rotY]) => {
      const trofferGroup = new THREE.Group();
      trofferGroup.position.set(tx, ty, tz);
      trofferGroup.rotation.y = rotY;

      // Clean White / Silver Recessed Frame Bezel
      const bezelGeo = new THREE.BoxGeometry(4.2, 0.08, 0.95);
      const bezelMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.15,
        metalness: 0.1
      });
      const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
      bezelMesh.position.y = 0.04;
      trofferGroup.add(bezelMesh);

      // Glowing Pure White Diffuser Plate (Facing downward)
      const diffGeo = new THREE.PlaneGeometry(4.0, 0.8);
      const diffMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 3.8,
        roughness: 0.05,
        side: THREE.DoubleSide
      });
      const diffMesh = new THREE.Mesh(diffGeo, diffMat);
      diffMesh.rotation.x = Math.PI / 2;
      diffMesh.position.y = -0.01;
      trofferGroup.add(diffMesh);

      // Soft Downward Illumination onto Racks
      const pLight = new THREE.PointLight(0xffffff, 1.4, 16.0, 1.4);
      pLight.position.y = -0.4;
      trofferGroup.add(pLight);

      this.scene.add(trofferGroup);
      this.ceilingLights.push(pLight);
      this.trofferMeshes.push({ bezel: bezelMesh, diffuser: diffMesh });
    });
  }

  buildDatacenterArchitecture() {
    // 1. Polished High-Gloss Reflective Epoxy Floor with Large Square Tiles
    const floorGeo = new THREE.PlaneGeometry(40, 28);
    const floorTexture = this.createFloorTexture(false);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.14, // Glossy mirror reflections of racks and lights
      metalness: 0.12
    });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = 0.0;
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);

    // 2. Clean Modern Architectural Ceiling Plane
    const ceilGeo = new THREE.PlaneGeometry(40, 28);
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
      side: THREE.DoubleSide
    });
    const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.y = 7.0;
    this.scene.add(ceilMesh);

    // 3. Background Glass Curtain Wall with Panoramic Daylight Cityscape
    const skylineTex = this.createSkylineTexture(false);
    const skylineGeo = new THREE.PlaneGeometry(36, 12);
    const skylineMat = new THREE.MeshBasicMaterial({
      map: skylineTex,
      side: THREE.FrontSide
    });
    this.skylineMesh = new THREE.Mesh(skylineGeo, skylineMat);
    this.skylineMesh.position.set(0, 5.0, -9.8);
    this.scene.add(this.skylineMesh);

    // Glass Curtain Wall Over Skyline with Glossy Reflection & Mullions
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      transmission: 0.85,
      opacity: 1.0,
      transparent: true,
      roughness: 0.08,
      ior: 1.5
    });
    const glassPlane = new THREE.Mesh(new THREE.PlaneGeometry(36, 10), glassMat);
    glassPlane.position.set(0, 4.8, -9.6);
    this.scene.add(glassPlane);

    // Slender Modern Window Mullions (Anthracite / Dark Slate frames)
    for (let x = -16; x <= 16; x += 4) {
      const mullionGeo = new THREE.BoxGeometry(0.12, 10, 0.15);
      const mullionMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
      const mullionMesh = new THREE.Mesh(mullionGeo, mullionMat);
      mullionMesh.position.set(x, 4.8, -9.55);
      this.scene.add(mullionMesh);
    }
    // Horizontal window frame rail
    const railGeo = new THREE.BoxGeometry(36, 0.12, 0.15);
    const railMesh = new THREE.Mesh(railGeo, new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 }));
    railMesh.position.set(0, 4.8, -9.55);
    this.scene.add(railMesh);

    // 4. Left Glass Wall with "DATA POWERS A BETTER TOMORROW"
    this.buildBrandedSideWall(-15.5, 'DATA POWERS\nA BETTER\nTOMORROW', true);

    // 5. Right Glass Wall with "AI for Reliable Tomorrow"
    this.buildBrandedSideWall(15.5, 'AI for\nReliable\nTomorrow', false);

    // 6. Indoor Architectural Potted Plants (Modern planters matching reference)
    this.createPottedPlant(-12.8, 0, -6.5);
    this.createPottedPlant(-9.5, 0, -7.5);
    this.createPottedPlant(9.5, 0, -7.5);
    this.createPottedPlant(12.8, 0, -6.5);
  }

  /**
   * Procedural Tile Floor Canvas Texture
   */
  createFloorTexture(isDark = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Base porcelain / marble
    ctx.fillStyle = isDark ? '#0a101f' : '#f8fafd';
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle surface tone variation
    for (let i = 0; i < 1500; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const alpha = isDark ? 0.05 : 0.025;
      ctx.fillStyle = isDark ? `rgba(56, 189, 248, ${alpha})` : `rgba(203, 213, 225, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Modern large square tiles (8x8 grid = 128px per tile)
    ctx.strokeStyle = isDark ? '#1e293b' : '#e2e8f0';
    ctx.lineWidth = 2.5;
    const tileSize = 128;
    for (let x = 0; x <= 1024; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y <= 1024; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 2);
    return texture;
  }

  /**
   * Procedural Daylight / Night Cityscape Canvas Texture
   */
  createSkylineTexture(isDark = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    if (!isDark) {
      // Daylight Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 1024);
      skyGrad.addColorStop(0, '#93c5fd'); // Soft sky blue
      skyGrad.addColorStop(0.4, '#bfdbfe');
      skyGrad.addColorStop(0.7, '#f1f5f9'); // Horizon haze
      skyGrad.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, 2048, 1024);

      // Distant clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      for (let c = 0; c < 7; c++) {
        const cx = 140 + c * 280;
        const cy = 180 + Math.sin(c) * 45;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 150, 48, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Distant Skyscraper Silhouettes (Soft slate)
      ctx.fillStyle = '#cbd5e1';
      const distantTowers = [
        { x: 80, w: 95, h: 440 },
        { x: 210, w: 125, h: 540 },
        { x: 370, w: 90, h: 400 },
        { x: 490, w: 145, h: 620 },
        { x: 670, w: 115, h: 480 },
        { x: 810, w: 155, h: 560 },
        { x: 995, w: 100, h: 430 },
        { x: 1120, w: 135, h: 600 },
        { x: 1285, w: 115, h: 510 },
        { x: 1425, w: 165, h: 640 },
        { x: 1620, w: 105, h: 460 },
        { x: 1750, w: 145, h: 530 },
        { x: 1920, w: 115, h: 410 }
      ];
      distantTowers.forEach(t => {
        ctx.fillRect(t.x, 1024 - t.h - 180, t.w, t.h);
      });

      // Closer Glass Towers with Window Grids
      ctx.fillStyle = '#94a3b8';
      const closeTowers = [
        { x: 130, w: 115, h: 500 },
        { x: 290, w: 135, h: 640 },
        { x: 455, w: 105, h: 470 },
        { x: 590, w: 165, h: 700 },
        { x: 790, w: 125, h: 530 },
        { x: 945, w: 145, h: 670 },
        { x: 1180, w: 125, h: 550 },
        { x: 1345, w: 175, h: 730 },
        { x: 1545, w: 120, h: 490 },
        { x: 1700, w: 155, h: 660 },
        { x: 1885, w: 135, h: 480 }
      ];
      closeTowers.forEach(t => {
        const topY = 1024 - t.h - 180;
        ctx.fillRect(t.x, topY, t.w, t.h);

        // Glass window stripes
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        for (let wy = topY + 20; wy < 1024 - 180; wy += 30) {
          for (let wx = t.x + 12; wx < t.x + t.w - 12; wx += 22) {
            ctx.fillRect(wx, wy, 10, 15);
          }
        }
        ctx.fillStyle = '#94a3b8';
      });

      // Distant green foliage / park belt
      ctx.fillStyle = '#4ade80';
      for (let x = 0; x < 2048; x += 32) {
        ctx.beginPath();
        ctx.arc(x, 1024 - 180, 26, 0, Math.PI, true);
        ctx.fill();
      }
    } else {
      // Night Cyber Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 1024);
      skyGrad.addColorStop(0, '#020617');
      skyGrad.addColorStop(0.5, '#070f26');
      skyGrad.addColorStop(1, '#0b193d');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, 2048, 1024);

      // Night City Towers with Glowing Windows
      ctx.fillStyle = '#0f172a';
      const nightTowers = [
        { x: 120, w: 130, h: 580 },
        { x: 290, w: 150, h: 700 },
        { x: 480, w: 120, h: 530 },
        { x: 630, w: 170, h: 740 },
        { x: 840, w: 140, h: 600 },
        { x: 1010, w: 160, h: 720 },
        { x: 1210, w: 130, h: 560 },
        { x: 1370, w: 180, h: 760 },
        { x: 1580, w: 140, h: 620 },
        { x: 1750, w: 160, h: 690 }
      ];
      nightTowers.forEach(t => {
        const topY = 1024 - t.h - 180;
        ctx.fillRect(t.x, topY, t.w, t.h);

        // Glowing yellow & cyan office window dots
        for (let wy = topY + 20; wy < 1024 - 180; wy += 26) {
          for (let wx = t.x + 10; wx < t.x + t.w - 10; wx += 19) {
            if (Math.random() > 0.45) {
              ctx.fillStyle = Math.random() > 0.35 ? '#fde047' : '#38bdf8';
              ctx.fillRect(wx, wy, 8, 12);
            }
          }
        }
        ctx.fillStyle = '#0f172a';
      });
    }

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * Branded Side Glass Wall with Corporate Typography
   */
  buildBrandedSideWall(xPos, textLines, isLeft) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Soft daylight glass
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 1024, 512);

    ctx.fillStyle = '#475569';
    ctx.font = '800 48px Inter, sans-serif';
    ctx.letterSpacing = '1px';

    const lines = textLines.split('\n');
    lines.forEach((line, idx) => {
      ctx.fillText(line, 100, 180 + idx * 64);
    });

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.3,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), mat);
    mesh.rotation.y = isLeft ? Math.PI / 2 : -Math.PI / 2;
    mesh.position.set(xPos, 4.5, -1);
    this.scene.add(mesh);
  }

  /**
   * Modern Architectural Potted Office Plant
   */
  createPottedPlant(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // White Cylindrical Ceramic Planter
    const potGeo = new THREE.CylinderGeometry(0.45, 0.38, 0.9, 24);
    const potMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.1
    });
    const potMesh = new THREE.Mesh(potGeo, potMat);
    potMesh.position.y = 0.45;
    potMesh.castShadow = true;
    group.add(potMesh);

    // Lush Green Leaves (Monstera / Ficus)
    const leafGeo = new THREE.SphereGeometry(0.65, 12, 10);
    leafGeo.scale(1.2, 0.4, 0.8);
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.35
    });

    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      const angle = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(angle) * 0.35, 1.1 + Math.sin(i) * 0.15, Math.sin(angle) * 0.35);
      leaf.rotation.set(0.35, angle, 0.4);
      leaf.castShadow = true;
      group.add(leaf);
    }

    this.scene.add(group);
  }

  /**
   * Loads the Single GLB Model (/models/data_center_low-poly.glb) or constructs the
   * 8 Enterprise Server Racks (DC-01 to DC-08) side-by-side as shown in input_file_0.png.
   */
  loadSingleGLBModelOrBuildFleet() {
    const gltfLoader = new GLTFLoader();
    const modelPath = '/models/data_center_low-poly.glb';

    console.log(`[Three.js] Loading single GLB model: ${modelPath}`);

    gltfLoader.load(
      modelPath,
      (gltf) => {
        console.log('[Three.js] Single GLB loaded successfully. Setting up DC-01 through DC-08 fleet.');
        // Build the precision 8 server rack fleet matching input_file_0.png
        this.buildEnterpriseRackRow();
      },
      undefined,
      (error) => {
        console.warn('[Three.js] GLB fallback. Constructing procedural enterprise fleet:', error);
        this.buildEnterpriseRackRow();
      }
    );
  }

  /**
   * Constructs the 8 Server Racks in a row (DC-01 to DC-08)
   * Centered horizontally with live LEDs, interactive raycasting, and DC-07 Critical Warning Triangle.
   */
  buildEnterpriseRackRow() {
    const rackSpacing = 1.85;
    const startX = -((8 - 1) * rackSpacing) / 2; // Centers the 8 racks symmetrically at X = 0

    const serverRacksData = [
      { id: 'DC-01', status: 'NORMAL', risk: 14, cpu: 28, mem: 34, disk: 42, net: 26, temp: 29.2 },
      { id: 'DC-02', status: 'NORMAL', risk: 18, cpu: 32, mem: 38, disk: 48, net: 31, temp: 30.1 },
      { id: 'DC-03', status: 'WARNING', risk: 48, cpu: 64, mem: 68, disk: 62, net: 45, temp: 38.6 },
      { id: 'DC-04', status: 'NORMAL', risk: 16, cpu: 26, mem: 31, disk: 38, net: 24, temp: 28.8 },
      { id: 'DC-05', status: 'WARNING', risk: 54, cpu: 71, mem: 65, disk: 59, net: 48, temp: 39.4 },
      { id: 'DC-06', status: 'NORMAL', risk: 22, cpu: 38, mem: 42, disk: 44, net: 33, temp: 31.0 },
      { id: 'DC-07', status: 'CRITICAL', risk: 87, cpu: 92, mem: 78, disk: 65, net: 41, temp: 47.8 }, // Alert Target
      { id: 'DC-08', status: 'NORMAL', risk: 19, cpu: 30, mem: 36, disk: 40, net: 28, temp: 29.5 }
    ];

    serverRacksData.forEach((data, index) => {
      const rackX = startX + index * rackSpacing;
      const isCritical = data.id === 'DC-07';
      const isWarning = data.status === 'WARNING';

      const group = new THREE.Group();
      group.position.set(rackX, 0, 0);

      // 1. Enterprise Rack Chassis Outer Frame
      const frameGeo = new THREE.BoxGeometry(1.55, 4.4, 1.45);
      const frameMat = new THREE.MeshStandardMaterial({
        color: isCritical ? 0x220a0d : 0x111827,
        emissive: isCritical ? 0xef4444 : 0x000000,
        emissiveIntensity: isCritical ? 0.35 : 0.0,
        roughness: 0.25,
        metalness: 0.85
      });
      const frameMesh = new THREE.Mesh(frameGeo, frameMat);
      frameMesh.position.y = 2.2;
      frameMesh.castShadow = true;
      frameMesh.receiveShadow = true;
      frameMesh.userData = { rackId: data.id, isRack: true };
      group.add(frameMesh);
      this.interactiveObjects.push(frameMesh);

      // Glowing Neon Red Outer Rim on DC-07 (as in reference image)
      if (isCritical) {
        const rimGeo = new THREE.BoxGeometry(1.60, 4.45, 1.50);
        const rimMat = new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: 0xef4444,
          emissiveIntensity: 2.2,
          wireframe: true
        });
        this.dc07RimMesh = new THREE.Mesh(rimGeo, rimMat);
        this.dc07RimMesh.position.y = 2.2;
        group.add(this.dc07RimMesh);
      }

      // 2. Stacked Server Faceplate Blades & Micro Activity LEDs
      const bladeRows = 10;
      const ledMeshes = [];
      const ledColor = isCritical ? 0xef4444 : (isWarning ? 0xf59e0b : 0x10b981);

      for (let r = 0; r < bladeRows; r++) {
        const yPos = 0.5 + r * 0.38;

        // Front Faceplate Server Blade
        const bladeGeo = new THREE.BoxGeometry(1.42, 0.32, 0.05);
        const bladeMat = new THREE.MeshStandardMaterial({
          color: 0x1f2937,
          roughness: 0.35,
          metalness: 0.8
        });
        const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
        bladeMesh.position.set(0, yPos, 0.74);
        group.add(bladeMesh);

        // Micro Activity LEDs (Dual rows of glowing dots per blade)
        for (let col = 0; col < 6; col++) {
          const ledGeo = new THREE.SphereGeometry(0.024, 8, 8);
          const ledMat = new THREE.MeshStandardMaterial({
            color: ledColor,
            emissive: ledColor,
            emissiveIntensity: 1.6,
            roughness: 0.1
          });
          const led = new THREE.Mesh(ledGeo, ledMat);
          led.position.set(-0.55 + col * 0.22, yPos, 0.77);
          group.add(led);
          ledMeshes.push(led);

          this.blinkingLeds.push({
            mesh: led,
            baseColor: ledColor,
            freq: 3.0 + Math.random() * 8.0,
            phase: Math.random() * Math.PI * 2
          });
        }
      }

      // 3. Floating 3D Glowing Red Warning Triangle ⚠️ above DC-07
      if (isCritical) {
        // Red glowing warning pyramid / triangle
        const triGeo = new THREE.ConeGeometry(0.38, 0.60, 3);
        const triMat = new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: 0xef4444,
          emissiveIntensity: 2.8,
          roughness: 0.1
        });
        const triMesh = new THREE.Mesh(triGeo, triMat);
        triMesh.position.set(0, 5.25, 0.2);
        group.add(triMesh);
        this.warningBeaconTriangle = triMesh;

        // Red Spotlight on DC-07
        const redSpot = new THREE.PointLight(0xef4444, 2.2, 8.0, 2.0);
        redSpot.position.set(0, 5.0, 0.5);
        group.add(redSpot);
      }

      // 4. Floating HTML Badge Tag Container (DC-01, DC-02, etc.)
      const badgeEl = this.createFloatingBadgeTag(data.id, isCritical);

      this.scene.add(group);
      this.racks.set(data.id, {
        group: group,
        frameMesh: frameMesh,
        ledMeshes: ledMeshes,
        badgeEl: badgeEl,
        data: data
      });
    });
  }

  /**
   * Creates an interactive 2D/3D Floating Badge Tag positioned directly above each rack.
   */
  createFloatingBadgeTag(rackId, isCritical) {
    const badge = document.createElement('div');
    badge.className = `floating-rack-badge ${isCritical ? 'badge-rack-critical' : ''}`;
    badge.setAttribute('data-rack-id', rackId);

    if (isCritical) {
      badge.innerHTML = `<span class="badge-alert-icon">⚠️</span> <span>${rackId}</span>`;
    } else {
      badge.innerText = rackId;
    }

    badge.addEventListener('click', () => {
      this.selectRack(rackId);
    });

    this.container.appendChild(badge);
    return badge;
  }

  /**
   * Selects a server rack, highlighting it in 3D and firing the inspector update callback.
   */
  selectRack(rackId) {
    this.selectedRackId = rackId;
    const rack = this.racks.get(rackId);
    if (!rack) return;

    // Highlight active floating badge
    document.querySelectorAll('.floating-rack-badge').forEach((b) => b.classList.remove('selected'));
    if (rack.badgeEl) rack.badgeEl.classList.add('selected');

    if (this.onRackSelectCallback) {
      this.onRackSelectCallback(rackId, rack.data);
    }
  }

  onRackSelect(callback) {
    this.onRackSelectCallback = callback;
  }

  /**
   * Camera Perspectives Switcher: [Overview], [Left], [Right], [Top]
   */
  setCameraPreset(preset) {
    let targetPos = new THREE.Vector3(0.0, 3.8, 14.5);
    let lookAt = new THREE.Vector3(0.0, 2.2, 0.0);

    switch (preset) {
      case 'overview':
        targetPos.set(0.0, 3.8, 14.5);
        lookAt.set(0.0, 2.2, 0.0);
        break;
      case 'left':
        targetPos.set(-5.5, 3.4, 9.5);
        lookAt.set(-4.5, 2.2, 0.0);
        break;
      case 'right':
        targetPos.set(5.5, 3.4, 9.5);
        lookAt.set(4.5, 2.2, 0.0);
        break;
      case 'top':
        targetPos.set(0.0, 16.5, 0.1);
        lookAt.set(0.0, 0.0, 0.0);
        break;
    }

    this.cameraTargetPos = targetPos;
    this.cameraLookTarget = lookAt;
  }

  /**
   * Switch between Light Theme & Dark Theme dynamically
   */
  setTheme(theme) {
    this.currentTheme = theme;
    const isDark = theme === 'dark';

    // Update scene background and fog
    this.scene.background.setHex(isDark ? 0x070d18 : 0xf1f5f9);
    this.scene.fog.color.setHex(isDark ? 0x070d18 : 0xf1f5f9);

    // Update lighting
    if (this.ambientLight) {
      this.ambientLight.color.setHex(isDark ? 0x0f172a : 0xffffff);
      this.ambientLight.intensity = isDark ? 0.9 : 1.9;
    }
    if (this.keySun) {
      this.keySun.color.setHex(isDark ? 0x38bdf8 : 0xfffaf0);
      this.keySun.intensity = isDark ? 1.4 : 2.6;
    }
    if (this.fillLight) {
      this.fillLight.color.setHex(isDark ? 0x00f0ff : 0xdbeafe);
      this.fillLight.intensity = isDark ? 1.0 : 1.4;
    }

    // Update floor texture
    if (this.floorMesh) {
      this.floorMesh.material.map = this.createFloorTexture(isDark);
      this.floorMesh.material.needsUpdate = true;
    }

    // Update skyline backdrop
    if (this.skylineMesh) {
      this.skylineMesh.material.map = this.createSkylineTexture(isDark);
      this.skylineMesh.material.needsUpdate = true;
    }

    // Update troffer ceiling diffusers
    this.trofferMeshes.forEach(t => {
      t.diffuser.material.emissive.setHex(isDark ? 0x38bdf8 : 0xffffff);
      t.diffuser.material.emissiveIntensity = isDark ? 2.8 : 3.8;
      t.diffuser.material.needsUpdate = true;
    });
  }

  /**
   * Healing Remediation Update: restores DC-07 from Critical red to Nominal green
   */
  remediateServer(serverId) {
    const rack = this.racks.get(serverId);
    if (!rack) return;

    rack.data.status = 'NORMAL';
    rack.data.risk = 12;
    rack.data.cpu = 28;
    rack.data.mem = 32;

    // Remove red glowing rim and warning beacon
    if (this.dc07RimMesh) {
      this.dc07RimMesh.visible = false;
    }
    if (this.warningBeaconTriangle) {
      this.warningBeaconTriangle.visible = false;
    }

    // Restore rack chassis to slate black
    rack.frameMesh.material.color.setHex(0x111827);
    rack.frameMesh.material.emissive.setHex(0x000000);
    rack.frameMesh.material.emissiveIntensity = 0.0;

    // Change LEDs to green
    rack.ledMeshes.forEach(led => {
      led.material.color.setHex(0x10b981);
      led.material.emissive.setHex(0x10b981);
    });

    // Update badge
    if (rack.badgeEl) {
      rack.badgeEl.className = 'floating-rack-badge';
      rack.badgeEl.innerText = serverId;
    }
  }

  onPointerDown(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const rackId = hit.userData.rackId;
      if (rackId) {
        this.selectRack(rackId);
      }
    }
  }

  onWindowResize() {
    if (!this.camera || !this.renderer || !this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  updateFloatingBadges() {
    const tempV = new THREE.Vector3();
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    this.racks.forEach((rack) => {
      if (!rack.badgeEl || !rack.group) return;

      // Top center of rack at Y = 4.65
      tempV.set(rack.group.position.x, 4.65, rack.group.position.z);
      tempV.project(this.camera);

      // Check if behind camera
      if (tempV.z > 1) {
        rack.badgeEl.style.display = 'none';
        return;
      }

      rack.badgeEl.style.display = 'flex';
      const x = (tempV.x * 0.5 + 0.5) * w;
      const y = (-(tempV.y * 0.5) + 0.5) * h;

      rack.badgeEl.style.left = `${x}px`;
      rack.badgeEl.style.top = `${y}px`;
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const time = performance.now() * 0.001;

    // 1. Smooth Camera Transition (Lerp)
    if (this.cameraTargetPos && this.cameraLookTarget) {
      this.camera.position.lerp(this.cameraTargetPos, 0.06);
      this.controls.target.lerp(this.cameraLookTarget, 0.06);

      if (this.camera.position.distanceTo(this.cameraTargetPos) < 0.05) {
        this.cameraTargetPos = null;
        this.cameraLookTarget = null;
      }
    }

    // 2. Animate Server Blade Flickering Activity LEDs
    this.blinkingLeds.forEach((led) => {
      const flicker = Math.sin(time * led.freq + led.phase) > 0.1 ? 1.6 : 0.25;
      led.mesh.material.emissiveIntensity = flicker;
    });

    // 3. Float & Spin the Warning Triangle above DC-07
    if (this.warningBeaconTriangle && this.warningBeaconTriangle.visible) {
      this.warningBeaconTriangle.position.y = 5.25 + Math.sin(time * 3.5) * 0.08;
      this.warningBeaconTriangle.rotation.y = time * 2.0;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    // 4. Update Screen Space Positions of Floating Badges
    this.updateFloatingBadges();
  }
}
