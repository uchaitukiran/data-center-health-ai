/**
 * Three.js 3D Data Center Scene Engine
 * Loads low-poly GLB server room model, sets up cyber lighting, and enables smooth OrbitControls.
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
    this.interactiveRacks = [];
    this.onRackClickCallback = null;

    this.init();
  }

  init() {
    // 1. Perspective Camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 14, 22);

    // 2. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // 3. Fog and Background
    this.scene.background = new THREE.Color(0x0a0d14);
    this.scene.fog = new THREE.FogExp2(0x0a0d14, 0.025);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // Prevent going below floor
    this.controls.minDistance = 5;
    this.controls.maxDistance = 60;
    this.controls.target.set(0, 2, 0);

    // 5. Lighting Setup
    this.setupLighting();

    // 6. Floor Grid
    this.setupFloor();

    // 7. Load 3D GLB Model & Setup Procedural Interactive Racks
    this.loadDataCenterModel();

    // 8. Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());
    window.addEventListener('pointerdown', (e) => this.onPointerDown(e));

    // 9. Animation Loop
    this.animate();
  }

  setupLighting() {
    // Soft Ambient Light
    const ambient = new THREE.AmbientLight(0x1a2638, 1.8);
    this.scene.add(ambient);

    // Cyber Blue Key Light
    const dirLight = new THREE.DirectionalLight(0x00d2ff, 2.5);
    dirLight.position.set(15, 25, 15);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    // Secondary Purple Rim Light
    const rimLight = new THREE.DirectionalLight(0x9d4edd, 1.5);
    rimLight.position.set(-15, 20, -10);
    this.scene.add(rimLight);

    // Central Point Light for Server Glow
    const pointLight = new THREE.PointLight(0x00ff88, 1.5, 30);
    pointLight.position.set(0, 6, 0);
    this.scene.add(pointLight);
  }

  setupFloor() {
    // Reflective metallic floor
    const floorGeo = new THREE.PlaneGeometry(120, 120);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x080b11,
      roughness: 0.3,
      metalness: 0.8
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Cyber Grid Helper
    const grid = new THREE.GridHelper(80, 40, 0x00d2ff, 0x16253b);
    grid.position.y = 0.01;
    this.scene.add(grid);
  }

  loadDataCenterModel() {
    const loader = new GLTFLoader();
    const modelUrl = '/models/data_center_low-poly.glb';

    loader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(1.5, 1.5, 1.5);
        model.position.set(0, 0, 0);
        this.scene.add(model);
        console.log('[DataCenterScene] Successfully loaded data_center_low-poly.glb');
      },
      undefined,
      (error) => {
        console.warn('[DataCenterScene] Could not load GLB model directly, relying on interactive rack fleet:', error);
      }
    );

    // Always create interactive tagged 3D racks (RACK-01 to RACK-08)
    this.createInteractiveRacks();
  }

  createInteractiveRacks() {
    // 2 Rows of 4 Server Racks with status LED strips
    const rackPositions = [
      { id: "RACK-01", x: -6, z: -4 },
      { id: "RACK-02", x: -2, z: -4 },
      { id: "RACK-03", x: 2, z: -4 },
      { id: "RACK-04", x: 6, z: -4 },
      { id: "RACK-05", x: -6, z: 4 },
      { id: "RACK-06", x: -2, z: 4 },
      { id: "RACK-07", x: 2, z: 4 },
      { id: "RACK-08", x: 6, z: 4 },
    ];

    const rackGeo = new THREE.BoxGeometry(2.2, 5.0, 2.2);

    rackPositions.forEach((pos) => {
      // Rack Cabinet Frame
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x111622,
        roughness: 0.4,
        metalness: 0.9
      });
      const rack = new THREE.Mesh(rackGeo, frameMat);
      rack.position.set(pos.x, 2.5, pos.z);
      rack.castShadow = true;
      rack.userData = { rackId: pos.id, isRack: true };

      // Front Glowing LED Status Bezel
      const bezelGeo = new THREE.PlaneGeometry(1.8, 4.4);
      const bezelMat = new THREE.MeshStandardMaterial({
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveIntensity: 0.8,
        roughness: 0.2
      });
      const bezel = new THREE.Mesh(bezelGeo, bezelMat);
      bezel.position.set(0, 0, 1.11);
      rack.add(bezel);

      // Store references
      rack.userData.bezelMat = bezelMat;
      this.interactiveRacks.push(rack);
      this.scene.add(rack);
    });
  }

  onPointerDown(event) {
    if (event.clientY < 70) return; // Ignore navbar clicks

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveRacks, true);

    if (intersects.length > 0) {
      let hit = intersects[0].object;
      while (hit && !hit.userData.isRack && hit.parent) {
        hit = hit.parent;
      }
      if (hit && hit.userData.rackId && this.onRackClickCallback) {
        this.onRackClickCallback(hit.userData.rackId);
      }
    }
  }

  resetCamera() {
    this.controls.reset();
    this.camera.position.set(0, 14, 22);
    this.controls.target.set(0, 2, 0);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();

    // Pulse glowing materials
    const time = Date.now() * 0.003;
    this.interactiveRacks.forEach(rack => {
      const mat = rack.userData.bezelMat;
      if (mat && mat.userData && mat.userData.isAlert) {
        mat.emissiveIntensity = 1.0 + Math.sin(time * 3) * 0.6;
      }
    });

    this.renderer.render(this.scene, this.camera);
  }
}
