/**
 * ANODOS Digital Twin — Three.js viewer (v2).
 *
 * Owns everything that is *presentation*: renderer, camera, lights, controls,
 * picking, halos and the render loop. It reads the twin through `getState()`
 * and reports user intent through `onSelect` / `onHover`.
 *
 * What's new in v2
 *   • light (default) + dark theme  → setTheme('light' | 'dark')
 *   • the whole hoistway is framed on open / resize / reset (fit-to-model)
 *   • trackpad-friendly navigation:
 *       drag = orbit · two-finger scroll = orbit · Shift + scroll = pan
 *       pinch / Ctrl + scroll = zoom · mouse wheel = zoom · right-drag = pan
 *   • hover picking is throttled, so moving the cursor stays smooth
 *   • when a component newly goes WARNING / HIGH_RISK / FAULT the camera flies
 *     to it and selects it; the selection halo blinks in the health colour
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createElevatorTwin, DIMS } from './elevator.js';
import { HEALTH } from './components.js';
import { HEALTH_THEME } from './materials.js';

/* ────────────────────────────────────────────────────────────────────────────
 * MODEL EXTENTS + CAMERA PRESETS
 * ──────────────────────────────────────────────────────────────────────────── */

const MODEL = {
  minY: DIMS.pitY - 0.6,
  maxY: (DIMS.roofY ?? DIMS.topY ?? 12) + 0.6,
  halfW: DIMS.shaftWidth / 2 + 0.3,
  halfD: DIMS.shaftDepth / 2 + 0.3
};
MODEL.centerY = (MODEL.minY + MODEL.maxY) / 2;
MODEL.halfH = (MODEL.maxY - MODEL.minY) / 2;
MODEL.radius = Math.hypot(MODEL.halfH, MODEL.halfW, MODEL.halfD);

/**
 * `fit` presets are re-computed from the camera aspect ratio, so the full
 * pit-to-roof model is always inside the frame. `position` is only a fallback.
 */
export const CAMERA_VIEWS = {
  reset: { position: [20, 9, 30], target: [0, MODEL.centerY, 0], label: 'Reset View', duration: 0.85, fit: { dir: [0.55, 0.2, 0.82], mode: 'sphere' } },
  top: { position: [0.01, 22, 0.02], target: [0, 4, 0], label: 'Top View', duration: 0.9 },
  front: { position: [0, MODEL.centerY + 1.5, 34], target: [0, MODEL.centerY, 0], label: 'Front View', duration: 0.85, fit: { dir: [0, 0.045, 1], mode: 'front' } },
  side: { position: [34, MODEL.centerY + 1.5, 0.02], target: [0, MODEL.centerY, 0], label: 'Side View', duration: 0.85, fit: { dir: [1, 0.045, 0.0001], mode: 'side' } },
  machine: { position: [5.5, 13.2, 5.0], target: [0, DIMS.sheaveY, DIMS.sheaveZ], label: 'Machine Room', duration: 0.9 }
};

/* ────────────────────────────────────────────────────────────────────────────
 * THEMES
 * ──────────────────────────────────────────────────────────────────────────── */

const NEUTRAL_TONE = THREE.ACESFilmicToneMapping;

const SCENE_THEMES = {
  light: {
    background: 0xeef2fa, ground: 0xe1e7f3, gridMain: 0xb9c5e0, gridSub: 0xd6ddef, gridOpacity: 0.8,
    hemiSky: 0xffffff, hemiGround: 0xaeb9d6, hemi: 1.0,
    key: 0xffffff, keyIntensity: 1.35,
    rim: 0x9db8ff, rimIntensity: 0.4,
    fill: 0xffffff, fillIntensity: 0.3,
    machine: 10,
    toneMapping: NEUTRAL_TONE ?? THREE.ACESFilmicToneMapping,
    exposure: NEUTRAL_TONE ? 1.0 : 1.3,
    select: 0x1d4ed8, hover: 0x5b8def
  },
  dark: {
    background: 0x070b14, ground: 0x0b1220, gridMain: 0x1d3253, gridSub: 0x111d31, gridOpacity: 0.55,
    hemiSky: 0x9ec6ff, hemiGround: 0x0a1018, hemi: 0.75,
    key: 0xdce9ff, keyIntensity: 1.35,
    rim: 0x3f7bff, rimIntensity: 0.7,
    fill: 0x38e0c0, fillIntensity: 0.32,
    machine: 22,
    toneMapping: THREE.ACESFilmicToneMapping,
    exposure: 1.05,
    select: 0x4fd1ff, hover: 0x8fe6ff
  }
};

const HEALTH_RANK = { [HEALTH.WARNING]: 1, [HEALTH.HIGH_RISK]: 2, [HEALTH.FAULT]: 3 };

const CLICK_MAX_DISTANCE_PX = 6;
const CLICK_MAX_DURATION_MS = 450;
const HOVER_INTERVAL_MS = 60;

/**
 * @param {object} options
 * @param {HTMLCanvasElement} options.canvas
 * @param {HTMLElement} options.container
 * @param {() => object} options.getState
 * @param {'light'|'dark'} [options.theme]           default 'light'
 * @param {(componentId:string|null) => void} [options.onSelect]
 * @param {(componentId:string|null) => void} [options.onHover]
 * @param {(message:string, level?:string) => void} [options.onError]
 * @param {(modelSource:string) => void} [options.onModelSource]
 * @param {() => void} [options.onFirstFrame]
 */
export function createViewer(options) {
  return new TwinViewer(options);
}

class TwinViewer {
  constructor({
    canvas, container, getState, onSelect, onHover, onError, onModelSource, onFirstFrame,
    modelUrl = null, theme = 'light'
  }) {
    this.canvas = canvas;
    this.container = container;
    this.getState = getState || (() => ({}));
    this.onSelect = onSelect || (() => {});
    this.onHover = onHover || (() => {});
    this.onError = onError || (() => {});
    this.onModelSource = onModelSource || (() => {});
    this.onFirstFrame = onFirstFrame || (() => {});
    this.modelUrl = modelUrl;

    this.theme = theme === 'dark' ? 'dark' : 'light';
    this.themeCfg = SCENE_THEMES[this.theme];

    this.disposed = false;
    this.firstFrameDone = false;
    this.lastFrameTime = 0;
    this._abort = new AbortController();

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerDown = null;
    this._pendingHover = null;
    this._lastHoverPick = 0;

    this._tween = null;
    this._userMoved = false;
    this._hoveredId = null;
    this.trackedComponentId = null;
    this._trackingLastPosition = null;
    this.trackingSmoothing = 0.14;

    this._prevHealth = {};
    this._healthSeen = false;

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._initHelpers();
    this._initModel();
    this._initHalos();
    this.setTheme(this.theme);
    this._bindEvents();

    this._clock = new THREE.Clock();
    this._loop = this._loop.bind(this);
    this.renderer.setAnimationLoop(this._loop);
  }

  /* ── setup ─────────────────────────────────────────────────────────── */

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('outputColorSpace' in this.renderer) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas.style.touchAction = 'none'; // the browser must not scroll/zoom the page over the 3D view
    this.canvas.style.cursor = 'grab';
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.themeCfg.background);
    this.scene.fog = new THREE.Fog(this.themeCfg.background, 46, 120);
  }

  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 250);
    const view = CAMERA_VIEWS.reset;
    this.camera.position.set(...view.position);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.14; // snappier than before (was 0.075)
    this.controls.rotateSpeed = 1.0;
    this.controls.zoomSpeed = 1.0;
    this.controls.panSpeed = 1.0;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 80;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.target.set(...view.target);
    this.controls.update();
  }

  _initLights() {
    this.lights = {};
    this.lights.hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
    this.scene.add(this.lights.hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1);
    key.position.set(12, 26, 16);
    key.target.position.set(0, 2, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 80;
    key.shadow.camera.left = -17;
    key.shadow.camera.right = 17;
    key.shadow.camera.top = 17;
    key.shadow.camera.bottom = -17;
    key.shadow.bias = -0.0012;
    key.shadow.normalBias = 0.02;
    this.scene.add(key, key.target);
    this.lights.key = key;

    this.lights.rim = new THREE.DirectionalLight(0xffffff, 0.5);
    this.lights.rim.position.set(-10, 8, -12);
    this.scene.add(this.lights.rim);

    this.lights.fill = new THREE.DirectionalLight(0xffffff, 0.3);
    this.lights.fill.position.set(-8, -2, 9);
    this.scene.add(this.lights.fill);

    // Practical light so the machine room reads even when the car is low.
    this.lights.machine = new THREE.PointLight(0xbfe4ff, 10, 14, 2);
    this.lights.machine.position.set(0, DIMS.sheaveY + 0.6, 1.2);
    this.scene.add(this.lights.machine);
  }

  _initHelpers() {
    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(45, 64),
      new THREE.MeshStandardMaterial({ color: this.themeCfg.ground, roughness: 0.95, metalness: 0.05 })
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = DIMS.pitY - 0.06;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this._buildGrid();
  }

  _buildGrid() {
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry.dispose();
      this.grid.material.dispose();
    }
    const t = this.themeCfg;
    this.grid = new THREE.GridHelper(60, 60, t.gridMain, t.gridSub);
    this.grid.position.y = DIMS.pitY - 0.02;
    this.grid.material.transparent = true;
    this.grid.material.opacity = t.gridOpacity;
    this.scene.add(this.grid);
  }

  _initModel() {
    this.twin = createElevatorTwin({ theme: this.theme });
    this.scene.add(this.twin.group);
    this.onModelSource(this.twin.source);
    this._tryLoadModel(); // optional GLB; the procedural model stays if it is missing
  }

  async _tryLoadModel() {
    if (!this.modelUrl) return;
    try {
      const head = await fetch(this.modelUrl, { method: 'HEAD' });
      if (!head.ok) return;
      const contentType = head.headers.get('content-type') || '';
      if (contentType.includes('text/html')) return;
    } catch (error) {
      return;
    }
    if (this.disposed) return;

    const result = await this.twin.loadFromGLB(this.modelUrl);
    if (!result.ok) {
      this.onError(`GLB not used (${result.reason})`, 'warning');
      return;
    }
    const state = this.getState();
    if (state && state.components) this.twin.setComponentStates(state.components);
    this.onModelSource(this.twin.source);
    this.onError('Loaded elevator.glb', 'info');
  }

  _initHalos() {
    this.selectionHalo = new THREE.Box3Helper(new THREE.Box3(), this.themeCfg.select);
    this.selectionHalo.material.transparent = true;
    this.selectionHalo.material.opacity = 0.95;
    this.selectionHalo.material.depthTest = false;
    this.selectionHalo.renderOrder = 999;
    this.selectionHalo.visible = false;
    this.scene.add(this.selectionHalo);

    this.hoverHalo = new THREE.Box3Helper(new THREE.Box3(), this.themeCfg.hover);
    this.hoverHalo.material.transparent = true;
    this.hoverHalo.material.opacity = 0.45;
    this.hoverHalo.material.depthTest = false;
    this.hoverHalo.renderOrder = 998;
    this.hoverHalo.visible = false;
    this.scene.add(this.hoverHalo);
  }

  /* ── theme ─────────────────────────────────────────────────────────── */

  setTheme(theme) {
    const name = theme === 'dark' ? 'dark' : 'light';
    const t = SCENE_THEMES[name];
    const toneChanged = this.renderer.toneMapping !== t.toneMapping;
    this.theme = name;
    this.themeCfg = t;

    this.renderer.setClearColor(t.background, 1);
    this.renderer.toneMapping = t.toneMapping;
    this.renderer.toneMappingExposure = t.exposure;
    this.scene.background.setHex(t.background);
    this.scene.fog.color.setHex(t.background);
    this.ground.material.color.setHex(t.ground);
    this._buildGrid();

    const L = this.lights;
    L.hemi.color.setHex(t.hemiSky);
    L.hemi.groundColor.setHex(t.hemiGround);
    L.hemi.intensity = t.hemi;
    L.key.color.setHex(t.key);
    L.key.intensity = t.keyIntensity;
    L.rim.color.setHex(t.rim);
    L.rim.intensity = t.rimIntensity;
    L.fill.color.setHex(t.fill);
    L.fill.intensity = t.fillIntensity;
    L.machine.intensity = t.machine;

    this.selectionHalo.material.color.setHex(t.select);
    this.hoverHalo.material.color.setHex(t.hover);
    if (this.twin) this.twin.setTheme(name);

    if (toneChanged) {
      this.scene.traverse((object) => {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) if (material) material.needsUpdate = true;
      });
    }
  }

  /* ── events ────────────────────────────────────────────────────────── */

  _bindEvents() {
    const signal = this._abort.signal;
    const on = (target, type, handler, extra = {}) => target.addEventListener(type, handler, { signal, ...extra });

    on(this.canvas, 'pointermove', (e) => this._onPointerMove(e));
    on(this.canvas, 'pointerdown', (e) => this._onPointerDown(e));
    on(this.canvas, 'pointerup', (e) => this._onPointerUp(e));
    on(this.canvas, 'pointercancel', () => this._endDrag());
    on(this.canvas, 'pointerleave', () => {
      this._pendingHover = null;
      this._setHovered(null);
    });
    // Captured on the container so it runs before OrbitControls' own wheel handler.
    on(this.container, 'wheel', (e) => this._onWheel(e), { capture: true, passive: false });
    on(this.canvas, 'contextmenu', (e) => e.preventDefault());

    // Any manual camera input cancels a running fly-to and stops auto-refitting on resize.
    this.controls.addEventListener('start', () => {
      this._tween = null;
      this._userMoved = true;
    });

    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(this.container);
    this.resize();

    on(this.canvas, 'webglcontextlost', (event) => {
      event.preventDefault();
      this.onError('WebGL context lost — the 3D view will resume automatically.', 'error');
    });
    on(this.canvas, 'webglcontextrestored', () => {
      this.onError('WebGL context restored.', 'info');
      this.resize();
    });
  }

  /* ── sizing ────────────────────────────────────────────────────────── */

  resize() {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    // Until the user takes over, keep the whole model framed as the container changes size.
    if (!this._userMoved && !this._tween && !this.trackedComponentId) this._applyViewNow('reset');
  }

  /* ── framing ───────────────────────────────────────────────────────── */

  _fitDistance(mode) {
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const tanH = tanV * this.camera.aspect;
    const pad = 1.08;
    if (mode === 'front') return Math.max(MODEL.halfH / tanV, MODEL.halfW / tanH) * pad + MODEL.halfD;
    if (mode === 'side') return Math.max(MODEL.halfH / tanV, MODEL.halfD / tanH) * pad + MODEL.halfW;
    const t = Math.min(tanV, tanH); // bounding sphere fits in the tighter axis
    return (MODEL.radius * pad * Math.sqrt(1 + t * t)) / t;
  }

  _viewFor(name) {
    const view = CAMERA_VIEWS[name] || CAMERA_VIEWS.reset;
    const target = new THREE.Vector3(...view.target);
    if (!view.fit) return { position: new THREE.Vector3(...view.position), target, duration: view.duration };
    const dir = new THREE.Vector3(...view.fit.dir).normalize();
    const position = target.clone().addScaledVector(dir, this._fitDistance(view.fit.mode));
    return { position, target, duration: view.duration };
  }

  _applyViewNow(name) {
    const view = this._viewFor(name);
    this.camera.position.copy(view.position);
    this.controls.target.copy(view.target);
    this.camera.lookAt(view.target);
    this.controls.update();
  }

  /* ── picking ───────────────────────────────────────────────────────── */

  _updatePointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  pickAt(event) {
    if (!this.twin) return null;
    this._updatePointer(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.twin.selectableMeshes, false);
    if (!hits.length) return null;
    return this.twin.resolveComponentId(hits[0].object);
  }

  _onPointerMove(event) {
    if (this.pointerDown) return; // dragging: no hover work
    this._pendingHover = { clientX: event.clientX, clientY: event.clientY }; // resolved once per few frames
  }

  _processHover(now) {
    if (!this._pendingHover || this.pointerDown || now - this._lastHoverPick < HOVER_INTERVAL_MS) return;
    const point = this._pendingHover;
    this._pendingHover = null;
    this._lastHoverPick = now;
    this._setHovered(this.pickAt(point));
  }

  _onPointerDown(event) {
    this.pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() };
    this.canvas.style.cursor = 'grabbing';
  }

  _endDrag() {
    this.pointerDown = null;
    this.canvas.style.cursor = this._hoveredId ? 'pointer' : 'grab';
  }

  _onPointerUp(event) {
    const down = this.pointerDown;
    this._endDrag();
    if (!down) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    const elapsed = performance.now() - down.time;
    if (moved > CLICK_MAX_DISTANCE_PX || elapsed > CLICK_MAX_DURATION_MS) return; // orbit, not a click
    this.onSelect(this.pickAt(event) || null);
  }

  _setHovered(id) {
    if (this._hoveredId === id) return;
    this._hoveredId = id;
    if (!this.pointerDown) this.canvas.style.cursor = id ? 'pointer' : 'grab';
    this.canvas.title = id ? (this.twin.getComponent(id)?.displayName || id) : '';
    this.twin.setHoveredComponent(id);
    this.onHover(id);
  }

  /* ── trackpad / wheel navigation ───────────────────────────────────── */

  _onWheel(event) {
    if (event.target !== this.canvas) return;
    event.preventDefault();
    event.stopPropagation();
    this._tween = null;
    this._userMoved = true;

    let dx = event.deltaX;
    let dy = event.deltaY;
    if (event.deltaMode === 1) { dx *= 16; dy *= 16; }
    else if (event.deltaMode === 2) { dx *= 400; dy *= 400; }

    // Pinch on a trackpad arrives as ctrl + wheel with small deltas.
    if (event.ctrlKey) {
      this.zoomBy(Math.exp(dy * 0.01));
      return;
    }

    // A physical mouse wheel: coarse, vertical-only notches (or line mode).
    const rawY = Math.abs(event.deltaY);
    const mouseNotch =
      event.deltaMode !== 0 ||
      (event.deltaX === 0 && rawY >= 50 && Number.isInteger(event.deltaY) && (rawY % 100 === 0 || rawY % 120 === 0));
    if (mouseNotch) {
      this.zoomBy(Math.exp(Math.sign(dy) * Math.min(Math.abs(dy), 240) * 0.0012));
      return;
    }

    // Two-finger scroll on a trackpad.
    if (event.shiftKey) this._panBy(dx, dy);
    else this._orbitBy(dx, dy);
  }

  _orbitBy(dx, dy) {
    const target = this.controls.target;
    const offset = this.camera.position.clone().sub(target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    const h = Math.max(1, this.canvas.clientHeight);
    spherical.theta += (Math.PI * dx) / h;
    spherical.phi += (Math.PI * dy) / h;
    spherical.phi = Math.max(0.05, Math.min(this.controls.maxPolarAngle, spherical.phi));
    offset.setFromSpherical(spherical);
    this.camera.position.copy(target).add(offset);
    this.camera.lookAt(target);
  }

  _panBy(dx, dy) {
    const target = this.controls.target;
    const distance = this.camera.position.distanceTo(target);
    const h = Math.max(1, this.canvas.clientHeight);
    const scale = (2 * distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) / h;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    const move = right.multiplyScalar(dx * scale).add(up.multiplyScalar(-dy * scale));
    const next = target.clone().add(move);
    next.x = THREE.MathUtils.clamp(next.x, -8, 8);
    next.y = THREE.MathUtils.clamp(next.y, DIMS.pitY - 1, (DIMS.roofY ?? DIMS.topY ?? 12) + 2);
    next.z = THREE.MathUtils.clamp(next.z, -8, 8);
    move.copy(next).sub(target);
    target.copy(next);
    this.camera.position.add(move);
  }

  /** Dolly towards / away from the orbit target. factor < 1 zooms in. */
  zoomBy(factor) {
    this._userMoved = true;
    const target = this.controls.target;
    const offset = this.camera.position.clone().sub(target);
    const distance = THREE.MathUtils.clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    offset.setLength(distance);
    this.camera.position.copy(target).add(offset);
  }

  /* ── camera control ───────────────────────────────────────────────── */

  setView(viewName) {
    this.stopTracking();
    const view = this._viewFor(viewName);
    if (viewName === 'reset') this._userMoved = false; // resizing keeps the model framed again
    this._startTween(view.position, view.target, view.duration);
    return viewName;
  }

  focusComponent(componentId) {
    if (!this.twin || !componentId) return false;
    const object = this.twin.getComponentObject(componentId);
    if (!object) return false;
    const box = this.twin.getComponentBounds(componentId, new THREE.Box3());
    if (box.isEmpty()) return false;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() * 0.8, 1.6);
    // Well-balanced camera distance framing (prevents over-zooming / clipping into geometry)
    const distance = Math.min(Math.max(radius * 3.8, 8.5), 28);

    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    if (direction.lengthSq() < 0.001) direction.set(0.6, 0.25, 0.76).normalize();
    const position = center.clone().add(direction.multiplyScalar(distance));
    position.y = Math.max(position.y, DIMS.pitY + 1.5);

    this.trackedComponentId = componentId;
    this._trackingLastPosition = center.clone();
    this._userMoved = true;
    this._startTween(position, center, 0.75);
    return true;
  }

  stopTracking() {
    this.trackedComponentId = null;
    this._trackingLastPosition = null;
  }

  _startTween(position, target, duration) {
    this._tween = {
      fromPosition: this.camera.position.clone(),
      toPosition: position.clone(),
      fromTarget: this.controls.target.clone(),
      toTarget: target.clone(),
      elapsed: 0,
      duration: Math.max(0.2, duration || 0.8)
    };
    // Controls stay enabled: grabbing the model mid-flight cancels the tween (see 'start' handler).
  }

  _updateTween(dt) {
    const tween = this._tween;
    if (!tween) return;
    tween.elapsed += dt;
    const raw = Math.min(1, tween.elapsed / tween.duration);
    const eased = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
    this.camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased);
    this.controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
    if (raw >= 1) this._tween = null;
  }

  get frameCount() {
    return this._frames || 0;
  }

  /* ── render loop ──────────────────────────────────────────────────── */

  _loop() {
    if (this.disposed) return;
    const dt = Math.min(this._clock.getDelta(), 0.05);

    this._updateTween(dt);
    this.controls.update();
    this._processHover(performance.now());

    const state = this.getState() || {};
    this._applyState(state);
    this._watchHealth(state);
    this.twin.update(dt, state);
    this._updateTracking();
    this._updateHalos(state);

    this.renderer.render(this.scene, this.camera);
    this._frames = (this._frames || 0) + 1;
    this.lastFrameTime = performance.now();

    if (!this.firstFrameDone) {
      this.firstFrameDone = true;
      this.onFirstFrame();
    }
  }

  _applyState(state) {
    if (this.trackedComponentId && this.trackedComponentId !== state.selected_component) this.stopTracking();
    if (state.components) this.twin.setComponentStates(state.components);
    this.twin.setSelectedComponent(state.selected_component || null);
  }

  /**
   * When a component newly enters WARNING / HIGH_RISK / FAULT (e.g. a fault was
   * simulated), select it and fly the camera to it. The worst one wins.
   * The first snapshot is only a baseline, so opening the twin keeps the full view.
   */
  _watchHealth(state) {
    const components = state.components;
    if (!components) return;
    let worstId = null;
    let worstRank = 0;
    for (const id of Object.keys(components)) {
      const rank = HEALTH_RANK[components[id]] || 0;
      const before = HEALTH_RANK[this._prevHealth[id]] || 0;
      if (this._healthSeen && rank > before && rank > worstRank) {
        worstId = id;
        worstRank = rank;
      }
      this._prevHealth[id] = components[id];
    }
    this._healthSeen = true;
    if (worstId) {
      this.onSelect(worstId);
      this.focusComponent(worstId);
    }
  }

  _updateTracking() {
    if (!this.trackedComponentId || this._tween) return;
    const object = this.twin.getComponentObject(this.trackedComponentId);
    if (!object) {
      this.stopTracking();
      return;
    }
    const currentPosition = object.getWorldPosition(new THREE.Vector3());
    if (!this._trackingLastPosition) {
      this._trackingLastPosition = currentPosition.clone();
      return;
    }
    const movement = currentPosition.clone().sub(this._trackingLastPosition);
    const follow = Math.min(1, this.trackingSmoothing);
    this.controls.target.lerp(this.controls.target.clone().add(movement), follow);
    this.camera.position.lerp(this.camera.position.clone().add(movement), follow);
    this._trackingLastPosition.lerp(currentPosition, follow);
  }

  _updateHalos(state) {
    const selected = state.selected_component;
    const hovered = this._hoveredId;
    const halo = this.selectionHalo;

    if (selected) {
      const box = this.twin.getComponentBounds(selected, new THREE.Box3());
      if (!box.isEmpty()) {
        halo.box.copy(box).expandByScalar(0.08);
        halo.visible = true;
        const record = this.twin.getComponent(selected);
        const stateHealth = record ? record.state : null;
        const themeEntry = stateHealth && stateHealth !== HEALTH.NORMAL ? HEALTH_THEME[stateHealth] : null;
        const tint = themeEntry ? themeEntry.tint : null;
        if (tint !== null && tint !== undefined) {
          // Faulty component: halo blinks in the health colour
          halo.material.color.setHex(tint);
          halo.material.opacity = 0.35 + 0.65 * Math.abs(Math.sin(this._clock.elapsedTime * 6));
        } else {
          halo.material.color.setHex(this.themeCfg.select);
          halo.material.opacity = 0.7 + Math.sin(this._clock.elapsedTime * 3) * 0.22;
        }
      } else {
        halo.visible = false;
      }
    } else {
      halo.visible = false;
    }

    if (hovered && hovered !== selected) {
      const box = this.twin.getComponentBounds(hovered, new THREE.Box3());
      if (!box.isEmpty()) {
        this.hoverHalo.box.copy(box).expandByScalar(0.06);
        this.hoverHalo.visible = true;
      } else {
        this.hoverHalo.visible = false;
      }
    } else {
      this.hoverHalo.visible = false;
    }
  }

  /* ── teardown ─────────────────────────────────────────────────────── */

  dispose() {
    this.disposed = true;
    this._abort.abort();
    this.renderer.setAnimationLoop(null);
    if (this._resizeObserver) this._resizeObserver.disconnect();
    this.controls.dispose();
    if (this.grid) {
      this.grid.geometry.dispose();
      this.grid.material.dispose();
    }
    if (this.twin) this.twin.dispose();
    this.renderer.dispose();
  }
}
