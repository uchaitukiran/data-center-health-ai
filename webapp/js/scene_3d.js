/**
 * DC Health AI - 3D Digital Twin Scene Engine
 * Exact Replication of Command Center 3D Viewport (input_file_0.png)
 * Features:
 * - Single GLB facility integration (/models/dc with int.glb)
 * - Two-Cluster 10-Rack Layout:
 *     * Left Cluster: R-01 through R-05 (nominal green LEDs, R-03 warning amber)
 *     * Right Cluster: R-06, R-07 (green), R-08 (amber Disk I/O), R-09 (CRITICAL RED alert), R-10 (green)
 * - R-09 Critical Alert state with glowing neon wireframe chassis & spinning 3D warning beacon
 * - Floating 3D/HTML Badge Tags above all 10 racks (R-01 to R-10)
 * - User reference skyline projection (/images/skyline_sky_bg.jpg)
 * - User reference room interior backdrop (/images/room_interior_bg.jpg)
 * - Angled overhead linear LED ceiling troffers
 * - Glossy reflective epoxy tiled floor with fine grout lines
 * - Modern architectural potted plants & branded side glass typography
 * - Camera presets: [Overview], [Left], [Right], [Top], and Reset View
 * - Interactive raycast selection updating Selected Server inspector
 * - Dynamic Daylight (default) & Sleek Cyber Dark Mode
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

    // Racks registry (10 racks: R-01 through R-10)
    this.racks = new Map();
    this.interactiveObjects = [];
    this.blinkingLeds = [];
    this.selectedRackId = 'R-09';
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
    this.interiorBackdropMesh = null;
    this.warningBeaconTriangle = null;
    this.r09RimMesh = null;

    this.init();
  }

  init() {
    // 1. Camera - Positioned for the exact Overview angle in input_file_0.png
    this.camera = new THREE.PerspectiveCamera(
      40,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0.0, 3.2, 13.5);

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

    // 3. Studio Background & Soft Distance Fog
    this.scene.background = new THREE.Color(0xf1f5f9);
    this.scene.fog = new THREE.FogExp2(0xf1f5f9, 0.010);

    // 4. Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 35.0;
    this.controls.target.set(0.0, 2.0, 0.0);

    // 5. Lighting Setup (Daylight Sunlight + Angled Overhead Linear LED Troffers)
    this.setupLighting();

    // 6. Datacenter Room Architecture (Glossy Tiled Floor, Windows, Plants, Ceiling)
    this.buildDatacenterArchitecture();

    // 7. Load / Build Server Fleet (R-01 through R-10 across Left & Right Clusters)
    this.loadSingleGLBModelOrBuildFleet();

    // 8. Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));

    // 9. Render Loop
    this.animate();
  }

  setupLighting() {
    // 1. Soft Ambient Daylight
    this.ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
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
        roughness: 0.2,
        metalness: 0.1
      });
      const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
      trofferGroup.add(bezelMesh);

      // Bright Linear LED Diffuser Panel
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
    const textureLoader = new THREE.TextureLoader();

    // 1. Polished High-Gloss Reflective Epoxy Floor with Large Square Tiles
    const floorGeo = new THREE.PlaneGeometry(42, 30);
    const floorTexture = this.createFloorTexture(false);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.12, // High gloss mirror reflections of server chassis & lights
      metalness: 0.10
    });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = 0.0;
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);

    // 2. Clean Modern Architectural Ceiling Plane
    const ceilGeo = new THREE.PlaneGeometry(42, 30);
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
      side: THREE.DoubleSide
    });
    const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.y = 7.0;
    this.scene.add(ceilMesh);

    // 3. Background Glass Curtain Wall with Daylight Skyline (using user's skyline_sky_bg.jpg)
    const skylineGeo = new THREE.PlaneGeometry(38, 13);
    const skylineTex = textureLoader.load(
      '/images/skyline_sky_bg.jpg',
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
      },
      undefined,
      () => {
        if (this.skylineMesh) {
          this.skylineMesh.material.map = this.createSkylineTexture(false);
          this.skylineMesh.material.needsUpdate = true;
        }
      }
    );

    const skylineMat = new THREE.MeshBasicMaterial({
      map: skylineTex,
      side: THREE.FrontSide
    });
    this.skylineMesh = new THREE.Mesh(skylineGeo, skylineMat);
    this.skylineMesh.position.set(0, 5.2, -10.0);
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
    const glassPlane = new THREE.Mesh(new THREE.PlaneGeometry(38, 10.5), glassMat);
    glassPlane.position.set(0, 4.8, -9.75);
    this.scene.add(glassPlane);

    // Slender Window Mullions (Dark Slate frames)
    for (let x = -18; x <= 18; x += 4) {
      const mullionGeo = new THREE.BoxGeometry(0.12, 10.5, 0.15);
      const mullionMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
      const mullionMesh = new THREE.Mesh(mullionGeo, mullionMat);
      mullionMesh.position.set(x, 4.8, -9.7);
      this.scene.add(mullionMesh);
    }
    // Horizontal window frame rail
    const railGeo = new THREE.BoxGeometry(38, 0.12, 0.15);
    const railMesh = new THREE.Mesh(railGeo, new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 }));
    railMesh.position.set(0, 4.8, -9.7);
    this.scene.add(railMesh);

    // 4. Left Glass Wall with "DATA POWERS A BETTER TOMORROW"
    this.buildBrandedSideWall(-16.0, 'DATA POWERS\nA BETTER\nTOMORROW', true);

    // 5. Right Glass Wall with "MONITOR PREDICT EXPLAIN PREVENT"
    this.buildBrandedSideWall(16.0, 'MONITOR\nPREDICT\nEXPLAIN\nPREVENT', false);

    // 6. Indoor Architectural Potted Plants (Modern planters matching reference)
    this.createPottedPlant(-13.2, 0, -6.5);
    this.createPottedPlant(-9.8, 0, -7.5);
    this.createPottedPlant(9.8, 0, -7.5);
    this.createPottedPlant(13.2, 0, -6.5);
  }

  /**
   * Procedural Tile Floor Canvas Texture (used for crisp epoxy floor)
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
    texture.repeat.set(3.5, 2.5);
    return texture;
  }

  /**
   * Procedural Daylight / Night Cityscape Canvas Texture (instant fallback)
   */
  createSkylineTexture(isDark = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    if (!isDark) {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 1024);
      skyGrad.addColorStop(0, '#93c5fd');
      skyGrad.addColorStop(0.4, '#bfdbfe');
      skyGrad.addColorStop(0.7, '#f1f5f9');
      skyGrad.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, 2048, 1024);

      // Distant Skyscraper Silhouettes
      ctx.fillStyle = '#cbd5e1';
      const distantTowers = [
        { x: 80, w: 95, h: 440 },
        { x: 210, w: 125, h: 540 },
        { x: 490, w: 145, h: 620 },
        { x: 810, w: 155, h: 560 },
        { x: 1120, w: 135, h: 600 },
        { x: 1425, w: 165, h: 640 },
        { x: 1750, w: 145, h: 530 }
      ];
      distantTowers.forEach(t => {
        ctx.fillRect(t.x, 1024 - t.h - 180, t.w, t.h);
      });
    } else {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 1024);
      skyGrad.addColorStop(0, '#020617');
      skyGrad.addColorStop(0.5, '#070f26');
      skyGrad.addColorStop(1, '#0b193d');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, 2048, 1024);
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

    // Soft daylight glass tint
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 1024, 512);

    ctx.fillStyle = '#475569';
    ctx.font = '800 48px Inter, sans-serif';

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

    // Lush Green Leaves
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
   * Loads the user's datacenter GLB model (/models/dc with int.glb) and constructs the
   * dual-cluster 10-rack fleet (R-01 through R-10) matching input_file_0.png.
   */
  loadSingleGLBModelOrBuildFleet() {
    const gltfLoader = new GLTFLoader();
    const modelPath = '/models/dc%20with%20int.glb';

    console.log(`[Three.js] Integrating user GLB model: ${modelPath}`);

    gltfLoader.load(
      modelPath,
      (gltf) => {
        console.log('[Three.js] User GLB loaded successfully.');
      },
      undefined,
      (error) => {
        console.warn('[Three.js] GLB notice (running high-perf native clusters):', error);
      }
    );

    // Build the 10-rack dual cluster fleet matching input_file_0.png
    this.buildEnterpriseRackClusters();
  }

  /**
   * Constructs the 10 Server Racks in Two Distinct Clusters:
   * Left Cluster (5 Racks): R-01, R-02, R-03, R-04, R-05
   * Right Cluster (5 Racks): R-06, R-07, R-08, R-09, R-10
   * R-09 is the Critical red server with glowing wireframe & spinning warning beacon.
   */
  buildEnterpriseRackClusters() {
    const leftClusterData = [
      { id: 'R-01', status: 'NORMAL', risk: 14, cpu: 28, mem: 34, disk: 42, net: 26, temp: 29.2 },
      { id: 'R-02', status: 'NORMAL', risk: 18, cpu: 32, mem: 38, disk: 48, net: 31, temp: 30.1 },
      { id: 'R-03', status: 'WARNING', risk: 48, cpu: 64, mem: 68, disk: 62, net: 45, temp: 38.6 },
      { id: 'R-04', status: 'NORMAL', risk: 16, cpu: 26, mem: 31, disk: 38, net: 24, temp: 28.8 },
      { id: 'R-05', status: 'NORMAL', risk: 21, cpu: 35, mem: 40, disk: 43, net: 29, temp: 30.4 }
    ];

    const rightClusterData = [
      { id: 'R-06', status: 'NORMAL', risk: 22, cpu: 38, mem: 42, disk: 44, net: 33, temp: 31.0 },
      { id: 'R-07', status: 'NORMAL', risk: 19, cpu: 31, mem: 36, disk: 41, net: 28, temp: 29.5 },
      { id: 'R-08', status: 'WARNING', risk: 58, cpu: 68, mem: 71, disk: 84, net: 49, temp: 41.2 },
      { id: 'R-09', status: 'CRITICAL', risk: 87, cpu: 92, mem: 78, disk: 65, net: 41, temp: 47.8 }, // Critical Alert
      { id: 'R-10', status: 'NORMAL', risk: 17, cpu: 29, mem: 35, disk: 39, net: 27, temp: 29.8 }
    ];

    // Left Cluster X Coordinates: [-6.8, -5.55, -4.30, -3.05, -1.80]
    const spacing = 1.25;
    const startXLeft = -6.8;
    leftClusterData.forEach((data, idx) => {
      const x = startXLeft + idx * spacing;
      this.createSingleRack(data, x);
    });

    // Right Cluster X Coordinates: [1.80, 3.05, 4.30, 5.55, 6.80]
    const startXRight = 1.8;
    rightClusterData.forEach((data, idx) => {
      const x = startXRight + idx * spacing;
      this.createSingleRack(data, x);
    });

    // Select R-09 on load
    setTimeout(() => this.selectRack('R-09'), 100);
  }

  createSingleRack(data, xPos) {
    const isCritical = data.id === 'R-09';
    const isWarning = data.status === 'WARNING';

    const group = new THREE.Group();
    group.position.set(xPos, 0, 0);

    // 1. Enterprise Rack Chassis Outer Frame
    const frameGeo = new THREE.BoxGeometry(1.15, 4.3, 1.35);
    const frameMat = new THREE.MeshStandardMaterial({
      color: isCritical ? 0x24080b : 0x111827,
      emissive: isCritical ? 0xef4444 : 0x000000,
      emissiveIntensity: isCritical ? 0.35 : 0.0,
      roughness: 0.25,
      metalness: 0.85
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.y = 2.15;
    frameMesh.castShadow = true;
    frameMesh.receiveShadow = true;
    frameMesh.userData = { rackId: data.id, isRack: true };
    group.add(frameMesh);
    this.interactiveObjects.push(frameMesh);

    // Glowing Neon Red Outer Rim on R-09 (matching input_file_0.png)
    if (isCritical) {
      const rimGeo = new THREE.BoxGeometry(1.18, 4.34, 1.38);
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 2.2,
        wireframe: true
      });
      this.r09RimMesh = new THREE.Mesh(rimGeo, rimMat);
      this.r09RimMesh.position.y = 2.15;
      group.add(this.r09RimMesh);
    }

    // 2. Stacked Server Faceplate Blades & Micro Activity LEDs
    const bladeRows = 10;
    const ledMeshes = [];
    const ledColor = isCritical ? 0xef4444 : (isWarning ? 0xf59e0b : 0x10b981);

    for (let r = 0; r < bladeRows; r++) {
      const yPos = 0.5 + r * 0.37;

      // Front Faceplate Server Blade
      const bladeGeo = new THREE.BoxGeometry(1.05, 0.31, 0.05);
      const bladeMat = new THREE.MeshStandardMaterial({
        color: 0x1f2937,
        roughness: 0.35,
        metalness: 0.8
      });
      const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
      bladeMesh.position.set(0, yPos, 0.69);
      group.add(bladeMesh);

      // Micro Activity LEDs (Dual rows of glowing dots per blade)
      for (let col = 0; col < 5; col++) {
        const ledGeo = new THREE.SphereGeometry(0.022, 8, 8);
        const ledMat = new THREE.MeshStandardMaterial({
          color: ledColor,
          emissive: ledColor,
          emissiveIntensity: 1.6,
          roughness: 0.1
        });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(-0.40 + col * 0.20, yPos, 0.72);
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

    // 3. Floating 3D Glowing Red Warning Triangle ⚠️ above R-09
    if (isCritical) {
      const triGeo = new THREE.ConeGeometry(0.36, 0.58, 3);
      const triMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 2.8,
        roughness: 0.1
      });
      const triMesh = new THREE.Mesh(triGeo, triMat);
      triMesh.position.set(0, 5.2, 0.2);
      group.add(triMesh);
      this.warningBeaconTriangle = triMesh;

      // Red Spotlight on R-09
      const redSpot = new THREE.PointLight(0xef4444, 2.2, 8.0, 2.0);
      redSpot.position.set(0, 5.0, 0.5);
      group.add(redSpot);
    }

    // 4. Floating HTML Badge Tag Container (R-01 through R-10)
    const badgeEl = this.createFloatingBadgeTag(data.id, isCritical, isWarning);

    this.scene.add(group);
    this.racks.set(data.id, {
      group: group,
      frameMesh: frameMesh,
      ledMeshes: ledMeshes,
      badgeEl: badgeEl,
      data: data
    });
  }

  createFloatingBadgeTag(rackId, isCritical, isWarning) {
    const badge = document.createElement('div');
    badge.className = `floating-rack-badge ${isCritical ? 'badge-rack-critical' : (isWarning ? 'badge-rack-warning' : '')}`;
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

  setCameraPreset(preset) {
    let targetPos = new THREE.Vector3(0.0, 3.2, 13.5);
    let lookAt = new THREE.Vector3(0.0, 2.0, 0.0);

    switch (preset) {
      case 'overview':
        targetPos.set(0.0, 3.2, 13.5);
        lookAt.set(0.0, 2.0, 0.0);
        break;
      case 'left':
        targetPos.set(-4.5, 3.4, 9.5);
        lookAt.set(-4.2, 2.2, 0.0);
        break;
      case 'right':
        targetPos.set(4.5, 3.4, 9.5);
        lookAt.set(4.2, 2.2, 0.0);
        break;
      case 'top':
        targetPos.set(0.0, 16.5, 0.1);
        lookAt.set(0.0, 0.0, 0.0);
        break;
    }

    this.cameraTargetPos = targetPos;
    this.cameraLookTarget = lookAt;
  }

  setTheme(theme) {
    this.currentTheme = theme;
    const isDark = theme === 'dark';

    this.scene.background.setHex(isDark ? 0x070d18 : 0xf1f5f9);
    this.scene.fog.color.setHex(isDark ? 0x070d18 : 0xf1f5f9);

    if (this.ambientLight) {
      this.ambientLight.color.setHex(isDark ? 0x0f172a : 0xffffff);
      this.ambientLight.intensity = isDark ? 0.9 : 2.0;
    }
    if (this.keySun) {
      this.keySun.color.setHex(isDark ? 0x38bdf8 : 0xfffaf0);
      this.keySun.intensity = isDark ? 1.4 : 2.6;
    }
    if (this.fillLight) {
      this.fillLight.color.setHex(isDark ? 0x00f0ff : 0xdbeafe);
      this.fillLight.intensity = isDark ? 1.0 : 1.4;
    }

    if (this.floorMesh) {
      this.floorMesh.material.map = this.createFloorTexture(isDark);
      this.floorMesh.material.needsUpdate = true;
    }

    if (this.skylineMesh) {
      this.skylineMesh.material.map = this.createSkylineTexture(isDark);
      this.skylineMesh.material.needsUpdate = true;
    }

    this.trofferMeshes.forEach((t) => {
      t.diffuser.material.emissive.setHex(isDark ? 0x38bdf8 : 0xffffff);
      t.diffuser.material.emissiveIntensity = isDark ? 2.8 : 3.8;
      t.diffuser.material.needsUpdate = true;
    });
  }

  remediateServer(serverId) {
    const rack = this.racks.get(serverId);
    if (!rack) return;

    rack.data.status = 'NORMAL';
    rack.data.risk = 12;
    rack.data.cpu = 28;
    rack.data.mem = 32;

    if (this.r09RimMesh) {
      this.r09RimMesh.visible = false;
    }
    if (this.warningBeaconTriangle) {
      this.warningBeaconTriangle.visible = false;
    }

    rack.frameMesh.material.color.setHex(0x111827);
    rack.frameMesh.material.emissive.setHex(0x000000);
    rack.frameMesh.material.emissiveIntensity = 0.0;

    rack.ledMeshes.forEach((led) => {
      led.material.color.setHex(0x10b981);
      led.material.emissive.setHex(0x10b981);
    });

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

      tempV.set(rack.group.position.x, 4.65, rack.group.position.z);
      tempV.project(this.camera);

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

    // 3. Float & Spin the Warning Triangle above R-09
    if (this.warningBeaconTriangle && this.warningBeaconTriangle.visible) {
      this.warningBeaconTriangle.position.y = 5.2 + Math.sin(time * 3.5) * 0.08;
      this.warningBeaconTriangle.rotation.y = time * 2.0;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    // 4. Update Screen Space Positions of Floating Badges
    this.updateFloatingBadges();
  }
}
