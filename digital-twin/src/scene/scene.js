/**
 * ANODOS Digital Twin — Three.js viewer.
 *
 * Owns everything that is *presentation*: renderer, camera, lights, orbit
 * controls, raycast picking, selection halos and the render loop. It reads the
 * digital twin through a `getState()` callback and never writes to the store
 * directly — user intent is reported back through the `onSelect` / `onHover`
 * callbacks so the state stays the single source of truth.
 *
 * The viewer is resilient by design: a WebGL context failure or a bad GLB file
 * results in an error callback, never an exception that kills the page.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createElevatorTwin, DIMS } from './elevator.js';

/* ────────────────────────────────────────────────────────────────────────────
 * CAMERA PRESETS
 * ──────────────────────────────────────────────────────────────────────────── */

export const CAMERA_VIEWS = {
  reset: { position: [7.4, 4.2, 9.6], target: [0, 0.6, 0], label: 'Reset View', duration: 0.85 },
  top: { position: [0.01, 18.5, 0.02], target: [0, 0, 0], label: 'Top View', duration: 0.9 },
  front: { position: [0, 1.4, 14.5], target: [0, 0.8, 0], label: 'Front View', duration: 0.85 },
  side: { position: [14.5, 2.2, 0.02], target: [0, 0.6, 0], label: 'Side View', duration: 0.85 },
  machine: { position: [5.5, 13.2, 5.0], target: [0, DIMS.sheaveY, DIMS.sheaveZ], label: 'Machine Room', duration: 0.9 }
};

const RENDERER_BACKGROUND = 0x070b14;
const GROUND_COLOR = 0x0b1220;
const SELECT_COLOR = 0x4fd1ff;
const HOVER_COLOR = 0x8fe6ff;

const CLICK_MAX_DISTANCE_PX = 6;
const CLICK_MAX_DURATION_MS = 450;

/**
 * Scene wrapper.
 *
 * @param {object} options
 * @param {HTMLCanvasElement} options.canvas
 * @param {HTMLElement} options.container  element used for size + pointer events
 * @param {() => object} options.getState  returns the central twin state
 * @param {(componentId:string|null) => void} [options.onSelect]
 * @param {(componentId:string|null) => void} [options.onHover]
 * @param {(message:string) => void} [options.onError]
  * @param {(modelSource:string) => void} [options.onModelSource]
 * @param {() => void} [options.onFirstFrame]
 */
export function createViewer(options) {
  return new TwinViewer(options);
}

class TwinViewer {
  constructor({
    canvas,
    container,
    getState,
    onSelect,
    onHover,
    onError,
    onModelSource,
    onFirstFrame,
    modelUrl = '/models/elevator.glb'
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

    this.disposed = false;
    this.firstFrameDone = false;
    this.lastFrameTime = 0;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerDown = null;

    this._tween = null;
    this._hoveredId = null;
    this.trackedComponentId = null;
    this._trackingLastPosition = null;
    this.trackingSmoothing = 0.14;

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._initHelpers();
    this._initModel();
    this._initHalos();
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(RENDERER_BACKGROUND, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Modern colour pipeline: linear working space, sRGB output.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    if ('outputColorSpace' in this.renderer) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(RENDERER_BACKGROUND);
    this.scene.fog = new THREE.Fog(RENDERER_BACKGROUND, 26, 62);
  }

  _initCamera() {
    const view = CAMERA_VIEWS.reset;
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    this.camera.position.set(...view.position);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.rotateSpeed = 0.75;
    this.controls.zoomSpeed = 0.9;
    this.controls.panSpeed = 0.7;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 42;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.target.set(...view.target);
    this.controls.update();
  }

  _initLights() {
    const hemi = new THREE.HemisphereLight(0x9ec6ff, 0x0a1018, 0.75);
    this.scene.add(hemi);

    // Key light with shadows covering the whole hoistway.
    const key = new THREE.DirectionalLight(0xdce9ff, 1.35);
    key.position.set(9, 18, 11);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 70;
    key.shadow.camera.left = -16;
    key.shadow.camera.right = 16;
    key.shadow.camera.top = 18;
    key.shadow.camera.bottom = -14;
    key.shadow.bias = -0.0012;
    this.scene.add(key);
    this.keyLight = key;

    // Cool rim light from behind, warm fill from the front-left.
    const rim = new THREE.DirectionalLight(0x3f7bff, 0.7);
    rim.position.set(-10, 8, -12);
    this.scene.add(rim);

    const fill = new THREE.DirectionalLight(0x38e0c0, 0.32);
    fill.position.set(-8, -2, 9);
    this.scene.add(fill);

    // Small practical light so the machine room reads even when the car is low.
    const machineLight = new THREE.PointLight(0xbfe4ff, 22, 14, 2);
    machineLight.position.set(0, DIMS.sheaveY + 0.6, 1.2);
    this.scene.add(machineLight);
  }

  _initHelpers() {
    const grid = new THREE.GridHelper(48, 48, 0x1d3253, 0x111d31);
    grid.position.y = DIMS.pitY - 0.02;
    grid.material.transparent = true;
    grid.material.opacity = 0.55;
    this.scene.add(grid);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(30, 64),
      new THREE.MeshStandardMaterial({ color: GROUND_COLOR, roughness: 0.95, metalness: 0.05 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = DIMS.pitY - 0.06;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _initModel() {
    this.twin = createElevatorTwin();
    this.scene.add(this.twin.group);
    this.onModelSource(this.twin.source);

    // Try the optional GLB, but never block on it: the procedural model is
    // already visible and stays if the file is missing or unusable.
    this._tryLoadModel();
  }

  async _tryLoadModel() {
    if (!this.modelUrl) return;
    try {
      const head = await fetch(this.modelUrl, { method: 'HEAD' });
      if (!head.ok) return; // no model supplied — procedural model stands
      const contentType = head.headers.get('content-type') || '';
      if (contentType.includes('text/html')) return; // Vite SPA fallback, not a GLB
    } catch (error) {
      return; // dev server without the file: expected, stay procedural
    }

    const result = await this.twin.loadFromGLB(this.modelUrl);
    if (!result.ok) {
      // Report but keep running — this is an expected state, not a failure.
      this.onError(`GLB not used (${result.reason})`, 'warning');
      return;
    }
    // Re-apply current health colours to the freshly adopted model.
    const state = this.getState();
    if (state && state.components) {
      this.twin.setComponentStates(state.components);
    }
    this.onModelSource(this.twin.source);
    this.onError('Loaded elevator.glb', 'info');
  }

  _initHalos() {
    this.selectionHalo = new THREE.Box3Helper(new THREE.Box3(), SELECT_COLOR);
    this.selectionHalo.material.transparent = true;
    this.selectionHalo.material.opacity = 0.95;
    this.selectionHalo.material.depthTest = false;
    this.selectionHalo.renderOrder = 999;
    this.selectionHalo.visible = false;
    this.scene.add(this.selectionHalo);

    this.hoverHalo = new THREE.Box3Helper(new THREE.Box3(), HOVER_COLOR);
    this.hoverHalo.material.transparent = true;
    this.hoverHalo.material.opacity = 0.4;
    this.hoverHalo.material.depthTest = false;
    this.hoverHalo.renderOrder = 998;
    this.hoverHalo.visible = false;
    this.scene.add(this.hoverHalo);
  }

  _bindEvents() {
    this.canvas.addEventListener('pointermove', (event) => this._onPointerMove(event));
    this.canvas.addEventListener('pointerdown', (event) => this._onPointerDown(event));
    this.canvas.addEventListener('pointerup', (event) => this._onPointerUp(event));
    this.canvas.addEventListener('pointerleave', () => this._setHovered(null));

    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(this.container);
    this.resize();

    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.onError('WebGL context lost — the 3D view will resume automatically.', 'error');
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
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
  }

  /* ── picking ───────────────────────────────────────────────────────── */

  _updatePointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /** Raycasts against the model and returns the component ID under the cursor. */
  pickAt(event) {
    if (!this.twin) return null;
    this._updatePointer(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.twin.selectableMeshes, false);
    if (!hits.length) return null;
    return this.twin.resolveComponentId(hits[0].object);
  }

  _onPointerMove(event) {
    if (this.pointerDown) {
      // A drag is in progress — skip hover work for performance.
      return;
    }
    const id = this.pickAt(event);
    this._setHovered(id);
  }

  _onPointerDown(event) {
    this.pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() };
  }

  _onPointerUp(event) {
    const down = this.pointerDown;
    this.pointerDown = null;
    if (!down) return;

    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    const elapsed = performance.now() - down.time;
    if (moved > CLICK_MAX_DISTANCE_PX || elapsed > CLICK_MAX_DURATION_MS) return; // orbit, not a click

    const id = this.pickAt(event);
    this.onSelect(id || null);
  }

  _setHovered(id) {
    if (this._hoveredId === id) return;
    this._hoveredId = id;
    this.canvas.style.cursor = id ? 'pointer' : 'grab';
    this.canvas.title = id ? (this.twin.getComponent(id)?.displayName || id) : '';
    this.twin.setHoveredComponent(id);
    this.onHover(id);
  }

  /* ── camera control ───────────────────────────────────────────────── */

  /**
   * Moves the camera to a named preset.
   * @param {keyof typeof CAMERA_VIEWS} viewName
   */
  setView(viewName) {
    this.stopTracking();
    const view = CAMERA_VIEWS[viewName] || CAMERA_VIEWS.reset;
    this._startTween(
      new THREE.Vector3(...view.position),
      new THREE.Vector3(...view.target),
      view.duration
    );
    return viewName;
  }

  /** Flies the camera to frame a component. */
  focusComponent(componentId) {
    if (!this.twin || !componentId) return false;
    const object = this.twin.getComponentObject(componentId);
    if (!object) return false;
    const box = this.twin.getComponentBounds(componentId, new THREE.Box3());
    if (box.isEmpty()) return false;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() * 0.6, 1.1);
    const distance = Math.min(Math.max(radius * 3.4, 3.2), 26);

    // Keep the current viewing direction so the move never feels disorienting.
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    if (direction.lengthSq() < 0.001) direction.set(0.6, 0.25, 0.76).normalize();
    const position = center.clone().add(direction.multiplyScalar(distance));
    position.y = Math.max(position.y, DIMS.pitY + 1.5);

    this.trackedComponentId = componentId;
    this._trackingLastPosition = center.clone();
    this._startTween(position, center, 0.7);
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
    this.controls.enabled = false;
  }

  _updateTween(dt) {
    const tween = this._tween;
    if (!tween) return;
    tween.elapsed += dt;
    const raw = Math.min(1, tween.elapsed / tween.duration);
    const eased = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;

    this.camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased);
    this.controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);

    if (raw >= 1) {
      this._tween = null;
      this.controls.enabled = true;
    }
  }

  /** Frame counter, handy for tests and the loading overlay. */
  get frameCount() {
    return this._frames || 0;
  }

  /* ── render loop ──────────────────────────────────────────────────── */

  _loop() {
    if (this.disposed) return;
    const dt = Math.min(this._clock.getDelta(), 0.05); // clamp after tab switches

    this._updateTween(dt);
    this.controls.update();

    const state = this.getState() || {};
    this._applyState(state);
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

  /**
   * Pushes state-driven appearance onto the model. Cheap because
   * setComponentStates() ignores components whose state did not change.
   */
  _applyState(state) {
    if (this.trackedComponentId && this.trackedComponentId !== state.selected_component) {
      this.stopTracking();
    }
    if (state.components) this.twin.setComponentStates(state.components);
    this.twin.setSelectedComponent(state.selected_component || null);
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
    const desiredTarget = this.controls.target.clone().add(movement);
    const desiredPosition = this.camera.position.clone().add(movement);
    const follow = Math.min(1, this.trackingSmoothing);
    this.controls.target.lerp(desiredTarget, follow);
    this.camera.position.lerp(desiredPosition, follow);
    this._trackingLastPosition.lerp(currentPosition, follow);
  }

  _updateHalos(state) {
    const selected = state.selected_component;
    const hovered = this._hoveredId;

    if (selected) {
      const box = this.twin.getComponentBounds(selected, new THREE.Box3());
      if (!box.isEmpty()) {
        this.selectionHalo.box.copy(box).expandByScalar(0.08);
        this.selectionHalo.visible = true;
        // Slow breathing so the selection reads as "active".
        this.selectionHalo.material.opacity = 0.7 + Math.sin(this._clock.elapsedTime * 3) * 0.22;
      } else {
        this.selectionHalo.visible = false;
      }
    } else {
      this.selectionHalo.visible = false;
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
    this.renderer.setAnimationLoop(null);
    if (this._resizeObserver) this._resizeObserver.disconnect();
    this.controls.dispose();
    if (this.twin) this.twin.dispose();
    this.renderer.dispose();
  }
}
