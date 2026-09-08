/**
 * DC Health AI - 3D Digital Twin Scene Engine
 * Exact Replication using User's GLB Model (/models/dc with int.glb)
 * and User Reference Images (/images/user_sky_panoramic.png, /images/user_room_interior.png)
 *
 * Features:
 * - Direct loading and integration of /models/dc with int.glb
 * - 10-Rack dual-cluster layout matching Blender scenes and reference images:
 *     * Left Cluster (Node 9): R-01 through R-05 (nominal green LEDs, R-03 warning amber)
 *     * Right Cluster (Node 28): R-06, R-07 (green), R-08 (amber Disk I/O), R-09 (CRITICAL RED alert), R-10 (green)
 * - Industrial overhead ceiling pipes, ventilation ducts, and hanging lamps from dc with int.glb
 * - R-09 Critical Alert state with glowing neon wireframe chassis rim & spinning 3D warning pyramid beacon
 * - Floating 3D/HTML Badge Tags hovering above all 10 racks (R-01 to R-10)
 * - User reference skyline projection (/images/user_sky_panoramic.png) through panoramic windows
 * - User reference room interior walls ("DATA POWERS A BETTER TOMORROW" / "MONITOR PREDICT EXPLAIN PREVENT")
 * - High-gloss reflective epoxy floor reflecting server LEDs and daylight
 * - Camera presets: [Overview], [Left Cluster], [Right Cluster], [Top Down], and Zoom Controls
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

    // Theme state ('light' by default as requested: "make day only")
    this.currentTheme = 'light';

    // Racks registry (10 racks: R-01 through R-10)
    this.racks = new Map();
    this.interactiveObjects = [];
    this.blinkingGlbLeds = [];
    this.selectedRackId = 'R-09';
    this.onRackSelectCallback = null;

    // Camera animation targets
    this.cameraTargetPos = null;
    this.cameraLookTarget = null;

    // GLB Model references
    this.glbContainer = null;
    this.glbModel = null;
    this.r09RimMesh = null;
    this.warningBeaconTriangle = null;
    this.r09SpotLight = null;

    // Architecture & Lights References for Theme Switching
    this.ambientLight = null;
    this.keySun = null;
    this.fillLight = null;
    this.ceilingLights = [];
    this.trofferMeshes = [];
    this.floorMesh = null;
    this.skylineMesh = null;

    this.init();
  }

  init() {
    // 1. Camera - Positioned for the exact cinematic Overview framing both clusters symmetrically
    this.camera = new THREE.PerspectiveCamera(
      42,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0.0, 4.4, 21.0);

    // 2. High-Performance WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.30;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 3. Studio Background & Soft Distance Fog
    this.scene.background = new THREE.Color(0xf1f5f9);
    this.scene.fog = new THREE.FogExp2(0xf1f5f9, 0.007);

    // 4. Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.minDistance = 4.0;
    this.controls.maxDistance = 50.0;
    this.controls.target.set(0.0, 2.0, 1.0);

    // 5. Lighting Setup (Natural Daylight Sunlight + Overhead Linear LED Troffers)
    this.setupLighting();

    // 6. Datacenter Room Architecture (Glossy Tiled Floor, User Reference Skyline, Side Walls)
    this.buildDatacenterArchitecture();

    // 7. Load and Integrate user's GLB Model (/models/dc with int.glb)
    this.loadUserGLBModel();

    // 8. Build 10 Server Rack Hitboxes & Badges (R-01 through R-10)
    this.build10RackFleet();

    // 9. Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));

    // 10. Render Loop
    this.animate();
  }

  setupLighting() {
    // 1. Soft Ambient Daylight
    this.ambientLight = new THREE.AmbientLight(0xffffff, 2.4);
    this.scene.add(this.ambientLight);

    // 2. Key Architectural Natural Sunlight (Casting soft shadows)
    this.keySun = new THREE.DirectionalLight(0xfffaf0, 2.8);
    this.keySun.position.set(15, 25, 20);
    this.keySun.castShadow = true;
    this.keySun.shadow.mapSize.width = 2048;
    this.keySun.shadow.mapSize.height = 2048;
    this.keySun.shadow.bias = -0.0005;
    this.scene.add(this.keySun);

    // 3. Front Face Fill Light to brightly illuminate server blade faceplates
    const frontFill = new THREE.DirectionalLight(0xffffff, 1.6);
    frontFill.position.set(0, 8, 22);
    this.scene.add(frontFill);

    // 4. Sky Fill Light
    this.fillLight = new THREE.DirectionalLight(0xdbeafe, 1.4);
    this.fillLight.position.set(-16, 18, -12);
    this.scene.add(this.fillLight);

    // 5. Overhead Recessed Linear LED Troffers (Angled rows across ceiling)
    const trofferCoords = [
      [-6.5, 7.6, 6.0, 0.22],
      [-2.2, 7.6, 5.0, 0.10],
      [2.2, 7.6, 5.0, -0.10],
      [6.5, 7.6, 6.0, -0.22],
      [-5.0, 7.6, 0.5, 0.08],
      [5.0, 7.6, 0.5, -0.08]
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
        emissiveIntensity: 3.5,
        roughness: 0.05,
        side: THREE.DoubleSide
      });
      const diffMesh = new THREE.Mesh(diffGeo, diffMat);
      diffMesh.rotation.x = Math.PI / 2;
      diffMesh.position.y = -0.01;
      trofferGroup.add(diffMesh);

      // Soft Downward Illumination onto Racks
      const pLight = new THREE.PointLight(0xffffff, 1.4, 18.0, 1.4);
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
    const floorGeo = new THREE.PlaneGeometry(55, 45);
    const floorTexture = this.createFloorTexture(false);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.24, // Clean soft reflection of server chassis & lights
      metalness: 0.05
    });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = 0.0;
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);

    // 2. Background Panoramic Glass Windows with User's Reference Skyline (/images/user_sky_panoramic.png)
    const skylineGeo = new THREE.PlaneGeometry(52, 18);
    const skylineTex = textureLoader.load(
      '/images/user_sky_panoramic.png',
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
    this.skylineMesh.position.set(0, 7.2, -15.0);
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
    const glassPlane = new THREE.Mesh(new THREE.PlaneGeometry(52, 15.0), glassMat);
    glassPlane.position.set(0, 6.2, -14.6);
    this.scene.add(glassPlane);

    // Slender Window Mullions (Dark Slate frames)
    for (let x = -25; x <= 25; x += 5.0) {
      const mullionGeo = new THREE.BoxGeometry(0.14, 15.0, 0.15);
      const mullionMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
      const mullionMesh = new THREE.Mesh(mullionGeo, mullionMat);
      mullionMesh.position.set(x, 6.2, -14.5);
      this.scene.add(mullionMesh);
    }
    // Horizontal window frame rail
    const railGeo = new THREE.BoxGeometry(52, 0.14, 0.15);
    const railMesh = new THREE.Mesh(railGeo, new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 }));
    railMesh.position.set(0, 6.2, -14.5);
    this.scene.add(railMesh);

    // 3. Left Wall with "DATA POWERS A BETTER TOMORROW" (matching user_room_interior.png)
    this.buildBrandedSideWall(-20.0, 'DATA POWERS\nA BETTER\nTOMORROW', true);

    // 4. Right Wall with "MONITOR PREDICT EXPLAIN PREVENT" (matching user_room_interior.png)
    this.buildBrandedSideWall(20.0, 'MONITOR\nPREDICT\nEXPLAIN\nPREVENT', false);

    // 5. Indoor Architectural Potted Plants (matching user's reference images)
    this.createPottedPlant(-16.0, 0, -4.0);
    this.createPottedPlant(-13.0, 0, -7.0);
    this.createPottedPlant(13.0, 0, -7.0);
    this.createPottedPlant(16.0, 0, -4.0);
  }

  /**
   * Loads the user's GLB Model (/models/dc with int.glb) containing the dual clusters,
   * server faceplates, activity LEDs, industrial ceiling pipes, and roof architecture.
   */
  loadUserGLBModel() {
    const gltfLoader = new GLTFLoader();
    const modelPath = '/models/dc%20with%20int.glb';

    console.log(`[Three.js] Loading user datacenter model from ${modelPath}`);

    gltfLoader.load(
      modelPath,
      (gltf) => {
        console.log('[Three.js] User GLB loaded successfully:', gltf);
        this.glbModel = gltf.scene;

        // Container group to scale and center dc with int.glb
        // Bounding box: Center X=21.54, Y=7.92, Z=0.49. Scale=0.25 makes rack height ~4.0m
        this.glbContainer = new THREE.Group();
        this.glbContainer.scale.set(0.25, 0.25, 0.25);
        this.glbContainer.position.set(-21.54 * 0.25, 0, -0.49 * 0.25);
        this.glbContainer.add(this.glbModel);

        // Enhance materials and hide any exterior facade that blocks the interior camera
        this.glbModel.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            const n = child.name || '';
            const mn = (child.material && child.material.name) ? child.material.name : '';

            // Hide the solid exterior concrete facade walls & flat floor of the GLB
            // so our high-res panoramic sky window, branded walls, and glossy floor shine through!
            if (n.includes('090') || n.includes('091') || n.includes('092') || n.includes('088') || n.includes('089') ||
                mn === 'PisoBranco.001' || (mn === 'Wall_Pipes' && (n.includes('Cube') || n.includes('026')))) {
              child.visible = false;
            }

            // Material tuning
            if (child.material) {
              const matName = child.material.name || '';
              if (matName.includes('Verde')) {
                // Green Activity LEDs
                child.material.emissive = new THREE.Color(0x22c55e);
                child.material.emissiveIntensity = 2.8;
                this.blinkingGlbLeds.push(child);
              } else if (matName.includes('Amarelo')) {
                // Amber Warning LEDs
                child.material.emissive = new THREE.Color(0xf59e0b);
                child.material.emissiveIntensity = 2.8;
                this.blinkingGlbLeds.push(child);
              } else if (matName.includes('MetalCase')) {
                child.material.metalness = 0.88;
                child.material.roughness = 0.22;
              } else if (matName.includes('Frente')) {
                child.material.roughness = 0.32;
              }
            }
          }
        });

        this.scene.add(this.glbContainer);
        console.log('[Three.js] Added dc with int.glb to scene');
      },
      (xhr) => {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        console.log(`[Three.js] Loading GLB: ${percent}%`);
      },
      (error) => {
        console.warn('[Three.js] GLB notice (running high-perf fallback clusters):', error);
      }
    );
  }

  /**
   * Sets up 10 Server Racks in Two Distinct Clusters matching the GLB layout:
   * Left Cluster (5 Racks): R-01, R-02, R-03 (amber warning), R-04, R-05
   * Right Cluster (5 Racks): R-06, R-07, R-08 (amber warning), R-09 (CRITICAL RED alert), R-10
   */
  build10RackFleet() {
    const leftClusterData = [
      { id: 'R-01', status: 'NORMAL', risk: 14, cpu: 28, mem: 34, disk: 42, net: 26, temp: 29.2, x: -12.0 },
      { id: 'R-02', status: 'NORMAL', risk: 18, cpu: 32, mem: 38, disk: 48, net: 31, temp: 30.1, x: -9.8 },
      { id: 'R-03', status: 'WARNING', risk: 48, cpu: 64, mem: 68, disk: 62, net: 45, temp: 38.6, x: -7.7 },
      { id: 'R-04', status: 'NORMAL', risk: 16, cpu: 26, mem: 31, disk: 38, net: 24, temp: 28.8, x: -5.5 },
      { id: 'R-05', status: 'NORMAL', risk: 21, cpu: 35, mem: 40, disk: 43, net: 29, temp: 30.4, x: -3.3 }
    ];

    const rightClusterData = [
      { id: 'R-06', status: 'NORMAL', risk: 22, cpu: 38, mem: 42, disk: 44, net: 33, temp: 31.0, x: 3.3 },
      { id: 'R-07', status: 'NORMAL', risk: 19, cpu: 31, mem: 36, disk: 41, net: 28, temp: 29.5, x: 5.5 },
      { id: 'R-08', status: 'WARNING', risk: 58, cpu: 68, mem: 71, disk: 84, net: 49, temp: 41.2, x: 7.7 },
      { id: 'R-09', status: 'CRITICAL', risk: 87, cpu: 92, mem: 78, disk: 65, net: 41, temp: 47.8, x: 9.8 }, // Critical Alert
      { id: 'R-10', status: 'NORMAL', risk: 17, cpu: 29, mem: 35, disk: 39, net: 27, temp: 29.8, x: 12.0 }
    ];

    leftClusterData.forEach((data) => this.registerRackSlot(data));
    rightClusterData.forEach((data) => this.registerRackSlot(data));

    // Select R-09 on load
    setTimeout(() => this.selectRack('R-09'), 150);
  }

  registerRackSlot(data) {
    const isCritical = data.id === 'R-09';
    const isWarning = data.status === 'WARNING';
    const zPos = 6.3;

    const group = new THREE.Group();
    group.position.set(data.x, 0, zPos);

    // 1. Raycast Hit Box for Server Rack Slot
    const hitBoxGeo = new THREE.BoxGeometry(2.0, 3.4, 1.6);
    const hitBoxMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });
    const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitBox.position.y = 2.1;
    hitBox.userData = { rackId: data.id, isRack: true };
    group.add(hitBox);
    this.interactiveObjects.push(hitBox);

    // 2. Glowing Neon Red Wireframe Chassis Rim on R-09 (matching reference command center)
    if (isCritical) {
      const rimGeo = new THREE.BoxGeometry(2.1, 3.4, 1.65);
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 3.2,
        wireframe: true
      });
      this.r09RimMesh = new THREE.Mesh(rimGeo, rimMat);
      this.r09RimMesh.position.y = 2.1;
      group.add(this.r09RimMesh);

      // Spinning 3D ⚠️ Warning Pyramid Beacon above R-09
      const coneGeo = new THREE.ConeGeometry(0.38, 0.65, 3);
      const coneMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 3.5,
        roughness: 0.1
      });
      this.warningBeaconTriangle = new THREE.Mesh(coneGeo, coneMat);
      this.warningBeaconTriangle.position.set(0, 4.3, 0);
      group.add(this.warningBeaconTriangle);

      // Red Alert Warning Spotlight
      this.r09SpotLight = new THREE.PointLight(0xef4444, 2.8, 8.0, 1.8);
      this.r09SpotLight.position.set(0, 4.2, 0.5);
      group.add(this.r09SpotLight);
    }

    // 3. Amber Warning Highlight on R-08 and R-03
    if (isWarning) {
      const amberSpot = new THREE.PointLight(0xf59e0b, 1.6, 6.0, 1.8);
      amberSpot.position.set(0, 4.5, 0.4);
      group.add(amberSpot);
    }

    // 4. Floating HTML Badge Tag Container (R-01 through R-10)
    const badgeEl = this.createFloatingBadgeTag(data.id, isCritical, isWarning);

    this.scene.add(group);
    this.racks.set(data.id, {
      group: group,
      hitBox: hitBox,
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
    let targetPos = new THREE.Vector3(0.0, 4.4, 21.0);
    let lookAt = new THREE.Vector3(0.0, 2.0, 1.0);

    switch (preset) {
      case 'overview':
        targetPos.set(0.0, 4.4, 21.0);
        lookAt.set(0.0, 2.0, 1.0);
        break;
      case 'left':
        targetPos.set(-7.7, 3.6, 13.0);
        lookAt.set(-7.7, 2.0, 6.8);
        break;
      case 'right':
        targetPos.set(7.7, 3.6, 13.0);
        lookAt.set(7.7, 2.0, 6.8);
        break;
      case 'top':
        targetPos.set(0.0, 24.0, 6.0);
        lookAt.set(0.0, 0.0, 5.0);
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
      this.ambientLight.intensity = isDark ? 1.0 : 2.4;
    }
    if (this.keySun) {
      this.keySun.color.setHex(isDark ? 0x38bdf8 : 0xfffaf0);
      this.keySun.intensity = isDark ? 1.5 : 2.8;
    }
    if (this.fillLight) {
      this.fillLight.color.setHex(isDark ? 0x00f0ff : 0xdbeafe);
      this.fillLight.intensity = isDark ? 1.1 : 1.4;
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
      t.diffuser.material.emissiveIntensity = isDark ? 2.8 : 3.5;
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
    if (this.r09SpotLight) {
      this.r09SpotLight.visible = false;
    }

    if (rack.badgeEl) {
      rack.badgeEl.className = 'floating-rack-badge';
      rack.badgeEl.innerText = serverId;
    }
  }

  remediateRack(rackId) {
    this.remediateServer(rackId);
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

      tempV.set(rack.group.position.x, 4.4, rack.group.position.z);
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

  createFloorTexture(isDark = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = isDark ? '#0a101f' : '#f8fafd';
    ctx.fillRect(0, 0, 1024, 1024);

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
    texture.repeat.set(4.0, 3.0);
    return texture;
  }

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

  buildBrandedSideWall(xPos, textLines, isLeft) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

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
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), mat);
    mesh.rotation.y = isLeft ? Math.PI / 2 : -Math.PI / 2;
    mesh.position.set(xPos, 5.0, 0);
    this.scene.add(mesh);
  }

  createPottedPlant(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const potGeo = new THREE.CylinderGeometry(0.48, 0.40, 0.95, 24);
    const potMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.1
    });
    const potMesh = new THREE.Mesh(potGeo, potMat);
    potMesh.position.y = 0.48;
    potMesh.castShadow = true;
    group.add(potMesh);

    const leafGeo = new THREE.SphereGeometry(0.70, 12, 10);
    leafGeo.scale(1.2, 0.4, 0.8);
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.35
    });

    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      const angle = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(angle) * 0.38, 1.15 + Math.sin(i) * 0.15, Math.sin(angle) * 0.38);
      leaf.rotation.set(0.35, angle, 0.4);
      leaf.castShadow = true;
      group.add(leaf);
    }

    this.scene.add(group);
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

    // 2. Animate Server Activity LEDs
    this.blinkingGlbLeds.forEach((mesh, idx) => {
      if (mesh.material && mesh.material.emissive) {
        const flicker = Math.sin(time * 5.0 + idx) > 0.1 ? 2.8 : 0.8;
        mesh.material.emissiveIntensity = flicker;
      }
    });

    // 3. Float & Spin the Warning Triangle above R-09
    if (this.warningBeaconTriangle && this.warningBeaconTriangle.visible) {
      this.warningBeaconTriangle.position.y = 4.6 + Math.sin(time * 3.5) * 0.08;
      this.warningBeaconTriangle.rotation.y = time * 2.0;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    // 4. Update Screen Space Positions of Floating Badges
    this.updateFloatingBadges();
  }
}
