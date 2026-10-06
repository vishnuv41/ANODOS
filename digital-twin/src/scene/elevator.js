/**
 * ANODOS Digital Twin — 3D elevator model.
 *
 * Builds a *procedural* elevator from Three.js primitives so the digital twin
 * always works with no external assets, and can additionally load a realistic
 * `public/models/elevator.glb` when one is provided later.
 *
 * Model layout (1 world unit ≈ 1 metre)
 *
 *      y = +12  ── machine room: motor · pulley · bearing · brake · controller
 *      y = +10  ── rope anchor line
 *      y =  …   ── hoistway: cabin on guide rails, counterweight behind
 *      y = −10  ── pit
 *
 * Every mesh carries `userData.componentId`, one of the stable component IDs
 * declared in components.js, plus `userData.partId` for finer-grained naming
 * (e.g. the cabin floor is `partId: 'cabin_floor'` inside component `cabin`).
 *
 * The class owns no application state: it is told what to look like
 * (`setComponentStates`) and how to move (`update`).
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { COMPONENT_IDS, COMPONENT_MAP, HEALTH, createComponentRegistry } from './components.js';
import {
  createComponentMaterial,
  createShaftMaterial,
  createAccentMaterial,
  createRopeMaterial,
  createPolymerMaterial,
  applyHealth,
  resetMaterial,
  updatePulse,
  adoptMaterial,
  disposeObject
} from './materials.js';

/* ────────────────────────────────────────────────────────────────────────────
 * DIMENSIONS
 * ──────────────────────────────────────────────────────────────────────────── */

export const DIMS = {
  shaftWidth: 3.0,
  shaftDepth: 2.8,
  shaftHeight: 22,
  pitY: -10,
  topY: 12,

  carWidth: 1.7,
  carHeight: 2.25,
  carDepth: 1.75,
  carZ: 0,
  carBottomY: -8,
  carTopY: 8,

  cwWidth: 0.52,
  cwHeight: 1.9,
  cwDepth: 0.3,
  cwZ: -1.75,

  machineY: 11.2,
  sheaveY: 10.6,
  sheaveZ: -0.85,
  pulleyRadius: 0.58,
  railX: 1.12
};

const ROPE_COUNT = 3;

/* ────────────────────────────────────────────────────────────────────────────
 * SMALL GEOMETRY HELPERS
 * ──────────────────────────────────────────────────────────────────────────── */

/** Creates a mesh tagged with its component + part identity. */
function partMesh(geometry, material, componentId, partId, options = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = partId || componentId;
  mesh.userData.componentId = componentId;
  mesh.userData.partId = partId || componentId;
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  if (options.position) mesh.position.set(...options.position);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  return mesh;
}

/** Empty group tagged as a component, for animated assemblies. */
function partGroup(componentId, partId) {
  const group = new THREE.Group();
  group.name = partId || componentId;
  group.userData.componentId = componentId;
  group.userData.partId = partId || componentId;
  return group;
}

function box(width, height, depth) {
  return new THREE.BoxGeometry(width, height, depth);
}

function cylinder(radiusTop, radiusBottom, height, segments = 24) {
  return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
}

/* ────────────────────────────────────────────────────────────────────────────
 * NORMALISATION OF GLB NODE NAMES
 * ──────────────────────────────────────────────────────────────────────────── */

/** Node names that should map onto one of our stable component IDs. */
const NAME_ALIASES = {
  door_l: 'door',
  door_r: 'door',
  door_left: 'door',
  door_right: 'door',
  doors: 'door',
  landing_door: 'door',
  car_door: 'door',
  lift_car: 'cabin',
  car: 'cabin',
  cab: 'cabin',
  car_frame: 'cabin',
  sling: 'cabin',
  car_floor: 'cabin',
  cabin_floor: 'cabin',
  floor: 'cabin',
  traction_motor: 'motor',
  machine: 'motor',
  hoist_motor: 'motor',
  sheave: 'pulley',
  traction_sheave: 'pulley',
  drive_pulley: 'pulley',
  bearings: 'bearing',
  bearing_l: 'bearing',
  bearing_r: 'bearing',
  roller_bearing: 'bearing',
  brake_unit: 'brake',
  safety_brake: 'brake',
  control_cabinet: 'controller',
  control: 'controller',
  vvvf: 'controller',
  drive_unit: 'controller',
  ropes: 'rope',
  suspension_ropes: 'rope',
  hoist_ropes: 'rope',
  cable: 'rope',
  counter_weight: 'counterweight',
  weight: 'counterweight',
  balancing_weight: 'counterweight',
  rails: 'guide_rail',
  rail: 'guide_rail',
  guide: 'guide_rail',
  guide_rails: 'guide_rail',
  hoistway: 'shaft',
  shaft_shell: 'shaft',
  enclosure: 'shaft'
};

/** Normalises a GLB node name to a lookup key. */
export function normalizeNodeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Maps an arbitrary GLB node name onto a component ID, or null when unknown.
 * Handles suffixed names such as `bearing_L.001` or `Door_Right_02`.
 */
export function componentIdFromName(name) {
  const key = normalizeNodeName(name);
  if (!key) return null;
  if (COMPONENT_MAP[key]) return key;
  if (NAME_ALIASES[key]) return NAME_ALIASES[key];

  // Longest-first substring match so `guide_rail` wins over `rail`.
  const candidates = [...COMPONENT_IDS, ...Object.keys(NAME_ALIASES)].sort(
    (a, b) => b.length - a.length
  );
  for (const candidate of candidates) {
    if (key === candidate || key.startsWith(`${candidate}_`) || key.endsWith(`_${candidate}`)) {
      return COMPONENT_MAP[candidate] ? candidate : NAME_ALIASES[candidate];
    }
  }
  for (const candidate of candidates) {
    if (key.includes(candidate)) {
      return COMPONENT_MAP[candidate] ? candidate : NAME_ALIASES[candidate];
    }
  }
  return null;
}
/* ────────────────────────────────────────────────────────────────────────────
 * PART BUILDERS — each returns a Group tagged with its component ID
 * ──────────────────────────────────────────────────────────────────────────── */

/** Hoistway shell, floor sills and pit. Transparent so machinery stays visible. */
function buildShaft() {
  const group = partGroup('shaft', 'shaft');
  const material = createShaftMaterial();
  const { shaftWidth: w, shaftDepth: d, shaftHeight: h, pitY, topY } = DIMS;

  const wallThickness = 0.08;
  const backWall = partMesh(box(w, h, wallThickness), material, 'shaft', 'shaft_wall_back', {
    position: [0, (pitY + topY) / 2, -d / 2],
    castShadow: false
  });
  const leftWall = partMesh(box(wallThickness, h, d), material, 'shaft', 'shaft_wall_left', {
    position: [-w / 2, (pitY + topY) / 2, 0],
    castShadow: false
  });
  const rightWall = partMesh(box(wallThickness, h, d), material, 'shaft', 'shaft_wall_right', {
    position: [w / 2, (pitY + topY) / 2, 0],
    castShadow: false
  });
  group.add(backWall, leftWall, rightWall);

  // Floor sills at each served level.
  const sillMaterial = createComponentMaterial(0x3d4d64, { roughness: 0.7, metalness: 0.35 });
  for (let floorIndex = 0; floorIndex < FLOOR_COUNT; floorIndex += 1) {
    const level = getFloorY(floorIndex);
    const sill = partMesh(box(w, 0.1, d), sillMaterial, 'shaft', `shaft_sill_${level}`, {
      position: [0, level - DIMS.carHeight / 2 - 0.05, 0],
      castShadow: false
    });
    group.add(sill);
  }

  // Pit floor.
  const pit = partMesh(box(w, 0.14, d), sillMaterial, 'shaft', 'shaft_pit', {
    position: [0, pitY, 0],
    castShadow: false
  });
  group.add(pit);

  return group;
}

/** Car and counterweight guide rails. */
function buildGuideRails() {
  const group = partGroup('guide_rail', 'guide_rails');
  const material = createComponentMaterial(COMPONENT_MAP.guide_rail.color, {
    roughness: 0.35,
    metalness: 0.92
  });
  const { railX, pitY, topY, cwWidth } = DIMS;
  const railHeight = topY - pitY;
  const railCenterY = (pitY + topY) / 2;

  const railGeometry = box(0.07, railHeight, 0.16);

  for (const side of [-1, 1]) {
    const rail = partMesh(railGeometry, material, 'guide_rail', `guide_rail_car_${side > 0 ? 'r' : 'l'}`, {
      position: [side * railX, railCenterY, DIMS.carZ + DIMS.carDepth / 2 - 0.08]
    });
    group.add(rail);
  }

  const cwRailGeometry = box(0.06, railHeight, 0.14);
  for (const side of [-1, 1]) {
    const rail = partMesh(
      cwRailGeometry,
      material,
      'guide_rail',
      `guide_rail_cw_${side > 0 ? 'r' : 'l'}`,
      { position: [side * (cwWidth / 2 + 0.09), railCenterY, DIMS.cwZ] }
    );
    group.add(rail);
  }

  return group;
}

/** Machine room: motor, pulley, bearings, brake, controller cabinet. */
function buildMachineRoom() {
  const group = new THREE.Group();
  group.name = 'machine_room';

  const { sheaveY, sheaveZ, pulleyRadius } = DIMS;

  /* ── traction motor (axis along Z, coaxial with the sheave) ── */
  const motorGroup = partGroup('motor', 'motor');
  motorGroup.position.set(0, sheaveY, sheaveZ - 1.15);
  const motorBody = partMesh(
    cylinder(0.44, 0.44, 1.0, 28),
    createComponentMaterial(COMPONENT_MAP.motor.color, { roughness: 0.4, metalness: 0.85 }),
    'motor',
    'motor_housing',
    { rotation: [Math.PI / 2, 0, 0] }
  );
  const motorFin = partMesh(
    cylinder(0.47, 0.47, 0.1, 28),
    createComponentMaterial(0x2f4463, { roughness: 0.6, metalness: 0.8 }),
    'motor',
    'motor_cooling_ring',
    { rotation: [Math.PI / 2, 0, 0], position: [0, 0, 0.1] }
  );
  const motorCap = partMesh(
    cylinder(0.3, 0.38, 0.22, 24),
    createComponentMaterial(0x40597d, { roughness: 0.45, metalness: 0.9 }),
    'motor',
    'motor_end_cap',
    { rotation: [Math.PI / 2, 0, 0], position: [0, 0, 0.58] }
  );
  motorGroup.add(motorBody, motorFin, motorCap);
  const motorShaft = partMesh(
    cylinder(0.09, 0.09, 1.9, 16),
    createComponentMaterial(0x9aa6b8, { roughness: 0.25, metalness: 0.95 }),
    'motor',
    'motor_shaft',
    { rotation: [Math.PI / 2, 0, 0], position: [0, 0, 0.95] }
  );
  motorGroup.add(motorShaft);
  group.add(motorGroup);

  /* ── pulley / traction sheave ── */
  const pulleyGroup = partGroup('pulley', 'pulley');
  pulleyGroup.position.set(0, sheaveY, sheaveZ);
  const pulleyBody = partMesh(
    cylinder(pulleyRadius, pulleyRadius, 0.34, 40),
    createComponentMaterial(COMPONENT_MAP.pulley.color, { roughness: 0.3, metalness: 0.95 }),
    'pulley',
    'pulley_sheave',
    { rotation: [Math.PI / 2, 0, 0] }
  );
  pulleyGroup.add(pulleyBody);

  // Rope grooves — three thin rings read as sheave grooves.
  const grooveMaterial = createComponentMaterial(0x4a5568, { roughness: 0.5, metalness: 0.85 });
  for (let i = 0; i < ROPE_COUNT; i += 1) {
    const offset = (i - (ROPE_COUNT - 1) / 2) * 0.11;
    const groove = partMesh(
      new THREE.TorusGeometry(pulleyRadius, 0.022, 8, 40),
      grooveMaterial,
      'pulley',
      `pulley_groove_${i}`,
      { position: [0, 0, offset] }
    );
    pulleyGroup.add(groove);
  }

  const pulleyHub = partMesh(
    cylinder(0.16, 0.16, 0.5, 20),
    createComponentMaterial(0x6f7c92, { roughness: 0.35, metalness: 0.9 }),
    'pulley',
    'pulley_hub',
    { rotation: [Math.PI / 2, 0, 0] }
  );
  pulleyGroup.add(pulleyHub);
  group.add(pulleyGroup);

  /* ── bearings (one at each end of the sheave shaft) ── */
  const bearingGroup = partGroup('bearing', 'bearings');
  const bearingMaterial = createComponentMaterial(COMPONENT_MAP.bearing.color, {
    roughness: 0.28,
    metalness: 0.95
  });
  const housingMaterial = createComponentMaterial(0x55617a, { roughness: 0.55, metalness: 0.75 });

  for (const [index, z] of [-0.36, 0.36].entries()) {
    const bearing = partMesh(
      cylinder(0.24, 0.24, 0.2, 26),
      bearingMaterial,
      'bearing',
      `bearing_${index === 0 ? 'front' : 'rear'}`,
      { rotation: [Math.PI / 2, 0, 0], position: [0, sheaveY, sheaveZ + z] }
    );
    const inner = partMesh(
      cylinder(0.11, 0.11, 0.26, 20),
      createComponentMaterial(0xb7c0d0, { roughness: 0.2, metalness: 0.98 }),
      'bearing',
      `bearing_inner_race_${index}`,
      { rotation: [Math.PI / 2, 0, 0], position: [0, sheaveY, sheaveZ + z] }
    );
    // Pillow block bolted to the machine bed.
    const block = partMesh(
      box(0.62, 0.3, 0.42),
      housingMaterial,
      'bearing',
      `bearing_housing_${index}`,
      { position: [0, sheaveY - 0.42, sheaveZ + z] }
    );
    const boltMaterial = createComponentMaterial(0x8d97a8, { roughness: 0.4, metalness: 0.95 });
    for (const x of [-0.22, 0.22]) {
      const bolt = partMesh(
        cylinder(0.035, 0.035, 0.06, 12),
        boltMaterial,
        'bearing',
        `bearing_bolt_${index}_${x > 0 ? 'r' : 'l'}`,
        { position: [x, sheaveY - 0.24, sheaveZ + z] }
      );
      bearingGroup.add(bolt);
    }
    bearingGroup.add(bearing, inner, block);
  }
  group.add(bearingGroup);
/* ── brake: disc on the motor shaft with a caliper ── */
  const brakeGroup = partGroup('brake', 'brake');
  brakeGroup.position.set(0, sheaveY, sheaveZ - 1.75);
  const brakeDisc = partMesh(
    cylinder(0.42, 0.42, 0.06, 32),
    createComponentMaterial(COMPONENT_MAP.brake.color, { roughness: 0.45, metalness: 0.9 }),
    'brake',
    'brake_disc',
    { rotation: [Math.PI / 2, 0, 0] }
  );
  const brakeCaliper = partMesh(
    box(0.24, 0.34, 0.5),
    createComponentMaterial(0x8d4f38, { roughness: 0.55, metalness: 0.8 }),
    'brake',
    'brake_caliper',
    { position: [0.42, 0.06, 0] }
  );
  const brakeCoil = partMesh(
    box(0.42, 0.2, 0.22),
    createComponentMaterial(0x6d4536, { roughness: 0.7, metalness: 0.6 }),
    'brake',
    'brake_coil',
    { position: [0, -0.44, 0] }
  );
  brakeGroup.add(brakeDisc, brakeCaliper, brakeCoil);
  group.add(brakeGroup);

  /* ── controller cabinet with live indicator strips ── */
  const controllerGroup = partGroup('controller', 'controller');
  controllerGroup.position.set(1.55, sheaveY - 0.55, 0.9);
  const cabinet = partMesh(
    box(0.85, 1.75, 0.55),
    createComponentMaterial(COMPONENT_MAP.controller.color, { roughness: 0.6, metalness: 0.5 }),
    'controller',
    'controller_cabinet'
  );
  const cabinetDoor = partMesh(
    box(0.78, 1.6, 0.04),
    createComponentMaterial(0x4a4d86, { roughness: 0.5, metalness: 0.6 }),
    'controller',
    'controller_door_panel',
    { position: [0, 0, 0.3] }
  );
  controllerGroup.add(cabinet, cabinetDoor);

  const indicatorMaterial = createAccentMaterial(0x59ffc8, 1.6);
  const indicatorHeights = [0.55, 0.3, 0.05, -0.2];
  indicatorHeights.forEach((y, index) => {
    const indicator = partMesh(
      box(0.34, 0.05, 0.03),
      indicatorMaterial,
      'controller',
      `controller_indicator_${index}`,
      { position: [0, y, 0.33], castShadow: false }
    );
    controllerGroup.add(indicator);
  });

  // Cooling vents.
  const ventMaterial = createComponentMaterial(0x2b2f52, { roughness: 0.8, metalness: 0.3 });
  for (let i = 0; i < 4; i += 1) {
    const vent = partMesh(
      box(0.6, 0.03, 0.02),
      ventMaterial,
      'controller',
      `controller_vent_${i}`,
      { position: [0, -0.45 - i * 0.1, 0.32], castShadow: false }
    );
    controllerGroup.add(vent);
  }
  group.add(controllerGroup);

  /* ── machine bed ── */
  const bedMaterial = createComponentMaterial(0x2f3a4d, { roughness: 0.75, metalness: 0.5 });
  const bed = partMesh(box(2.6, 0.2, 2.4), bedMaterial, 'shaft', 'machine_bed', {
    position: [0, sheaveY - 0.75, sheaveZ - 0.2],
    castShadow: false
  });
  group.add(bed);

  return group;
}

/** Suspension ropes: one bundle to the car, one to the counterweight. */
function buildRopes() {
  const group = partGroup('rope', 'ropes');
  const material = createRopeMaterial();
  const geometry = cylinder(0.022, 0.022, 1, 10);
  const ropes = [];

  const make = (partId, x, z) => {
    const rope = partMesh(geometry.clone(), material, 'rope', partId, { position: [x, 0, z] });
    rope.castShadow = false;
    group.add(rope);
    ropes.push(rope);
    return rope;
  };

  for (let i = 0; i < ROPE_COUNT; i += 1) {
    const offset = (i - (ROPE_COUNT - 1) / 2) * 0.16;
    make(`rope_car_${i}`, offset, DIMS.carZ);
    make(`rope_cw_${i}`, offset, DIMS.cwZ);
  }

  return { group, ropes };
}

/** Passenger car: sling, walls, floor, ceiling light and doors. */
function buildCabin() {
  const cabin = partGroup('cabin', 'cabin');
  const { carWidth: w, carHeight: h, carDepth: d } = DIMS;

  const shellMaterial = createComponentMaterial(COMPONENT_MAP.cabin.color, {
    roughness: 0.35,
    metalness: 0.6
  });
  const panelMaterial = createComponentMaterial(0x5fb3cb, {
    roughness: 0.25,
    metalness: 0.4,
    transparent: true,
    opacity: 0.34
  });
  const frameMaterial = createComponentMaterial(0x33465c, { roughness: 0.5, metalness: 0.8 });

  // Sling (top cross-beam + uprights).
  const topBeam = partMesh(box(w + 0.2, 0.12, d + 0.14), frameMaterial, 'cabin', 'cabin_sling_top', {
    position: [0, h / 2 + 0.06, 0]
  });
  const bottomBeam = partMesh(
    box(w + 0.2, 0.12, d + 0.14),
    frameMaterial,
    'cabin',
    'cabin_sling_bottom',
    { position: [0, -h / 2 - 0.06, 0] }
  );
  cabin.add(topBeam, bottomBeam);

  for (const x of [-1, 1]) {
    const upright = partMesh(
      box(0.1, h + 0.24, 0.12),
      frameMaterial,
      'cabin',
      `cabin_upright_${x > 0 ? 'r' : 'l'}`,
      { position: [x * (w / 2 + 0.05), 0, -d / 2 - 0.04] }
    );
    cabin.add(upright);
  }

  // Ceiling.
  const ceiling = partMesh(box(w, 0.06, d), shellMaterial, 'cabin', 'cabin_ceiling', {
    position: [0, h / 2 - 0.03, 0]
  });
  const lightPanel = partMesh(
    box(w * 0.7, 0.03, d * 0.55),
    createAccentMaterial(0xdff3ff, 0.85),
    'cabin',
    'cabin_ceiling_light',
    { position: [0, h / 2 - 0.08, 0], castShadow: false }
  );
  cabin.add(ceiling, lightPanel);

  // Side and rear walls (translucent so passengers "inside" read as glass).
  const leftWall = partMesh(box(0.05, h, d), panelMaterial, 'cabin', 'cabin_wall_left', {
    position: [-w / 2, 0, 0],
    castShadow: false
  });
  const rightWall = partMesh(box(0.05, h, d), panelMaterial, 'cabin', 'cabin_wall_right', {
    position: [w / 2, 0, 0],
    castShadow: false
  });
  const rearWall = partMesh(box(w, h, 0.05), panelMaterial, 'cabin', 'cabin_wall_rear', {
    position: [0, 0, -d / 2],
    castShadow: false
  });
  cabin.add(leftWall, rightWall, rearWall);

  // Floor — its own named part inside the cabin component.
  const floorMaterial = createComponentMaterial(0x8a97a8, { roughness: 0.55, metalness: 0.45 });
  const floor = partMesh(box(w, 0.08, d), floorMaterial, 'cabin', 'cabin_floor', {
    position: [0, -h / 2 + 0.04, 0]
  });
  cabin.add(floor);

  // Car operating panel + handrail detail.
  const handrailMaterial = createComponentMaterial(0xc0c8d4, { roughness: 0.3, metalness: 0.95 });
  const handrailRear = partMesh(box(w * 0.8, 0.05, 0.05), handrailMaterial, 'cabin', 'cabin_handrail_rear', {
    position: [0, 0.05, -d / 2 + 0.12]
  });
  const handrailLeft = partMesh(box(0.05, 0.05, d * 0.7), handrailMaterial, 'cabin', 'cabin_handrail_left', {
    position: [-w / 2 + 0.12, 0.05, 0]
  });
  const handrailRight = partMesh(box(0.05, 0.05, d * 0.7), handrailMaterial, 'cabin', 'cabin_handrail_right', {
    position: [w / 2 - 0.12, 0.05, 0]
  });
  cabin.add(handrailRear, handrailLeft, handrailRight);

  /* ── doors: two panels sliding in ±X on the front face ── */
  const doorGroup = partGroup('door', 'doors');
  const doorMaterial = createComponentMaterial(COMPONENT_MAP.door.color, {
    roughness: 0.25,
    metalness: 0.85
  });
  const doorEdgeMaterial = createAccentMaterial(0x5fc0a8, 0.7);
  const doorWidth = w * 0.46;
  const doors = {};

  for (const side of [-1, 1]) {
    const key = side > 0 ? 'right' : 'left';
    const panel = partMesh(box(doorWidth, h - 0.22, 0.05), doorMaterial, 'door', `door_${key}`, {
      position: [side * doorWidth / 2, 0, d / 2 + 0.02]
    });
    const edge = partMesh(
      box(0.03, h - 0.24, 0.06),
      doorEdgeMaterial,
      'door',
      `door_${key}_edge`,
      { position: [side * doorWidth / 2 - side * doorWidth / 2, 0, d / 2 + 0.03], castShadow: false }
    );
    panel.userData.closedX = panel.position.x;
    edge.userData.closedX = edge.position.x;
    doorGroup.add(panel, edge);
    doors[key] = { panel, edge };
  }

  const sill = partMesh(
    box(w + 0.1, 0.05, 0.16),
    createComponentMaterial(0xa8b4c4, { roughness: 0.4, metalness: 0.9 }),
    'door',
    'door_sill',
    { position: [0, -h / 2 + 0.02, d / 2 + 0.04] }
  );
  doorGroup.add(sill);

  cabin.add(doorGroup);
  cabin.position.set(0, 0, DIMS.carZ);

  return { cabin, doors };
}

/** Counterweight assembly with guide shoes. */
function buildCounterweight() {
  const group = partGroup('counterweight', 'counterweight');
  const { cwWidth: w, cwHeight: h, cwDepth: d } = DIMS;

  const blockMaterial = createComponentMaterial(COMPONENT_MAP.counterweight.color, {
    roughness: 0.7,
    metalness: 0.45
  });
  const frameMaterial = createComponentMaterial(0x455163, { roughness: 0.5, metalness: 0.8 });
  const shoeMaterial = createPolymerMaterial();

  // Stacked weight plates read as a real counterweight.
  const plateCount = 7;
  const plateHeight = h / plateCount - 0.02;
  for (let i = 0; i < plateCount; i += 1) {
    const plate = partMesh(
      box(w, plateHeight, d),
      blockMaterial,
      'counterweight',
      `counterweight_plate_${i}`,
      { position: [0, h / 2 - plateHeight / 2 - i * (plateHeight + 0.02), 0] }
    );
    group.add(plate);
  }

  const tieRodMaterial = createComponentMaterial(0x9aa6b8, { roughness: 0.3, metalness: 0.95 });
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) {
    const rod = partMesh(
      cylinder(0.018, 0.018, h + 0.24, 10),
      tieRodMaterial,
      'counterweight',
      `counterweight_tie_rod_${x > 0 ? 'r' : 'l'}`,
      { position: [x, 0, 0] }
    );
    group.add(rod);
  }

  for (const side of [-1, 1]) {
    for (const y of [h / 2 - 0.12, -h / 2 + 0.12]) {
      const shoe = partMesh(
        box(d + 0.08, 0.16, 0.1),
        shoeMaterial,
        'counterweight',
        `counterweight_shoe_${side > 0 ? 'r' : 'l'}_${y > 0 ? 'top' : 'bottom'}`,
        { position: [side * (w / 2 + 0.02), y, 0] }
      );
      group.add(shoe);
    }
  }

  const hanger = partMesh(box(0.3, 0.18, d), frameMaterial, 'counterweight', 'counterweight_hanger', {
    position: [0, h / 2 + 0.18, 0]
  });
  group.add(hanger);

  group.position.set(0, 0, DIMS.cwZ);
  return group;
}
/* ────────────────────────────────────────────────────────────────────────────
 * ELEVATOR TWIN
 * ──────────────────────────────────────────────────────────────────────────── */

export const FLOOR_HEIGHT = 4;
export const FLOOR_COUNT = 5;
export const FLOOR_ORIGIN_Y = -8;

export const MOTION_STATES = Object.freeze({
  IDLE: 'IDLE',
  MOVING: 'MOVING',
  ARRIVING: 'ARRIVING',
  DOOR_OPENING: 'DOOR_OPENING',
  DOOR_OPEN: 'DOOR_OPEN',
  DOOR_CLOSING: 'DOOR_CLOSING',
  SAFETY_STOP: 'SAFETY_STOP',
  FAULT_LOCKOUT: 'FAULT_LOCKOUT'
});

/** Demo-only safety limits. Replace with calibrated service limits later. */
export const SAFETY_LIMITS = Object.freeze({
  motorTemperatureCritical: 115,
  vibrationCritical: 9,
  brakeEffectivenessCritical: 48,
  ropeTensionMin: 0.5,
  ropeTensionMax: 1.5,
  controllerLatencyCritical: 80,
  overallRiskCritical: 0.8,
  controlledStopAcceleration: 1.7
});

function isCriticalComponent(components, componentId) {
  return components[componentId] === HEALTH.FAULT;
}

/** Evaluates current Digital Twin data without producing or changing predictions. */
export function evaluateMotionSafety(state = {}) {
  const components = state.components || {};
  const telemetry = state.telemetry || {};
  const risk = Number(state.prediction?.risk_score ?? state.overall_risk);
  const checks = [
    [isCriticalComponent(components, 'brake') || Number(telemetry.brake_force) < SAFETY_LIMITS.brakeEffectivenessCritical, 'Critical brake effectiveness', 'critical'],
    [isCriticalComponent(components, 'motor') || Number(telemetry.motor_temperature) >= SAFETY_LIMITS.motorTemperatureCritical, 'Critical motor condition', 'critical'],
    [Number(telemetry.vibration) >= SAFETY_LIMITS.vibrationCritical, 'Critical vibration', 'critical'],
    [isCriticalComponent(components, 'rope') || Number(telemetry.rope_tension) < SAFETY_LIMITS.ropeTensionMin || Number(telemetry.rope_tension) > SAFETY_LIMITS.ropeTensionMax, 'Critical rope condition', 'critical'],
    [isCriticalComponent(components, 'controller') || Number(telemetry.control_latency) >= SAFETY_LIMITS.controllerLatencyCritical, 'Critical controller condition', 'critical'],
    [isCriticalComponent(components, 'door'), 'Critical door condition while moving', 'critical'],
    [Number.isFinite(risk) && risk >= SAFETY_LIMITS.overallRiskCritical, 'Critical overall risk', 'critical']
  ];
  const critical = checks.find(([active]) => active);
  if (critical) return { canMove: false, reason: critical[1], severity: critical[2] };

  const warning = Object.values(components).some((value) => value === HEALTH.WARNING || value === HEALTH.HIGH_RISK);
  return { canMove: true, reason: warning ? 'Warning condition under observation' : 'Within demo safety limits', severity: warning ? 'warning' : 'normal' };
}

export function getFloorY(floorIndex) {
  const index = Math.min(FLOOR_COUNT - 1, Math.max(0, Math.round(floorIndex)));
  return FLOOR_ORIGIN_Y + index * FLOOR_HEIGHT;
}

const FLOOR_EPSILON = 0.002;
const ARRIVAL_PAUSE = [0.3, 0.8];
const DOOR_DURATION = [0.8, 1.2];
const DOOR_DWELL = [1.5, 3.5];
const DOOR_SAFETY_PAUSE = [0.25, 0.55];
const DESTINATION_HISTORY_LIMIT = 3;
const DOOR_ALIGNMENT_PROFILES = Object.freeze({
  normal: { leftOffset: 0, rightOffset: 0, leftTravel: 1, rightTravel: 1, closeRate: 1 },
  warning: { leftOffset: -0.035, rightOffset: 0.012, leftTravel: 0.96, rightTravel: 1, closeRate: 0.92 },
  high_risk: { leftOffset: -0.06, rightOffset: 0.022, leftTravel: 0.92, rightTravel: 1, closeRate: 0.78 },
  fault: { leftOffset: -0.085, rightOffset: 0.03, leftTravel: 0.88, rightTravel: 1, closeRate: 0.64 }
});

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * The elevator model plus everything the rest of the app needs from it:
 *   • a component registry (stable IDs → meshes + materials)
 *   • health visualisation (setComponentStates)
 *   • animation                        (update)
 *   • raycast targets                  (selectableMeshes)
 */
export class ElevatorTwin {
  constructor(options = {}) {
    this.options = options;
    this.group = new THREE.Group();
    this.group.name = 'elevator-twin';

    /** @type {Map<string, {id:string, meshes:THREE.Mesh[], materials:THREE.Material[], root:THREE.Object3D, state:string}>} */
    this.registry = createComponentRegistry();
    /** Flat list of meshes used for picking. */
    this.selectableMeshes = [];
    /** Named animation handles. */
    this.refs = {};
    /** Base transforms so animation can offset rather than accumulate. */
    this.baseTransforms = new Map();

    this.source = 'procedural';
    this.hoveredComponent = null;
    this.selectedComponent = null;

    // motion state
    this._elapsed = 0;
    this._carY = getFloorY(0);
    this._currentFloor = 0;
    this._destinationFloor = null;
    this._targetY = this._carY;
    this._phase = MOTION_STATES.IDLE;
    this._phaseTimer = 0;
    this._velocity = 0;
    this._doorOpen = 0;
    this._destinationHistory = [];
    this._pulleyAngle = 0;
    this._brakeEngagement = 1;
    this._safetyReason = null;
    this._safetyLatched = false;
    this._safetyDirection = 1;
  }

  /** Builds the procedural model. Safe to call again to rebuild from scratch. */
  build() {
    this._clear();

    const shaft = buildShaft();
    const rails = buildGuideRails();
    const machineRoom = buildMachineRoom();
    const ropes = buildRopes();
    const { cabin, doors } = buildCabin();
    const counterweight = buildCounterweight();

    this.group.add(shaft, rails, machineRoom, ropes.group, cabin, counterweight);

    this.refs = {
      cabin,
      counterweight,
      doors,
      pulley: machineRoom.getObjectByName('pulley') || null,
      motor: machineRoom.getObjectByName('motor') || null,
      brake: machineRoom.getObjectByName('brake') || null,
      brakeCaliper: machineRoom.getObjectByName('brake_caliper') || null,
      brakeCoil: machineRoom.getObjectByName('brake_coil') || null,
      controller: machineRoom.getObjectByName('controller') || null,
      shafts: machineRoom.getObjectByName('bearings') || null,
      carRopes: ropes.ropes.filter((rope) => rope.userData.partId.startsWith('rope_car')),
      cwRopes: ropes.ropes.filter((rope) => rope.userData.partId.startsWith('rope_cw'))
    };

    this.source = 'procedural';
    this._indexGroup();
    this._captureBaseTransforms();
    this._resetMotion();
    return this;
  }

  /* ── indexing & lookup ─────────────────────────────────────────────── */

  _clear() {
    this.group.clear();
    this.registry = createComponentRegistry();
    this.selectableMeshes = [];
    this.baseTransforms.clear();
    this.refs = {};
  }

  _indexGroup() {
    const self = this;
    this.group.traverse((object) => {
      const componentId = object.userData ? object.userData.componentId : null;
      if (!componentId) return;
      const record = self._record(componentId);
      if (!record.root) {
        record.root = object;
        record.object = object;
      }
      if (object.isMesh) {
        record.meshes.push(object);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (material && !record.materials.includes(material)) record.materials.push(material);
        }
        self.selectableMeshes.push(object);
      }
    });
  }

  /** Ensures a registry record exists for a component ID. */
  _record(componentId) {
    let record = this.registry.get(componentId);
    if (!record) {
      record = {
        id: componentId,
        object: null,
        displayName: COMPONENT_MAP[componentId]?.label || componentId,
        telemetry: [...(COMPONENT_MAP[componentId]?.sensors || [])],
        meshes: [],
        materials: [],
        root: null,
        state: HEALTH.NORMAL
      };
      this.registry.set(componentId, record);
    }
    return record;
  }

  _captureBaseTransforms() {
    for (const record of this.registry.values()) {
      if (record.root && !this.baseTransforms.has(record.root)) {
        this.baseTransforms.set(record.root, {
          position: record.root.position.clone(),
          rotation: record.root.rotation.clone(),
          scale: record.root.scale.clone()
        });
      }
    }
    // Animated assemblies that are not components themselves.
    for (const key of ['cabin', 'counterweight']) {
      const object = this.refs[key];
      if (object && !this.baseTransforms.has(object)) {
        this.baseTransforms.set(object, {
          position: object.position.clone(),
          rotation: object.rotation.clone(),
          scale: object.scale.clone()
        });
      }
    }
  }

  /** Registry record for a component ID (or null). */
  getComponent(componentId) {
    return this.registry.get(componentId) || null;
  }

  /** First 3D object bound to a component ID (or null). */
  getComponentObject(componentId) {
    const record = this.registry.get(componentId);
    return record ? record.root : null;
  }

  /** World-space bounds of a component, for the selection halo. */
  getComponentBounds(componentId, target = new THREE.Box3()) {
    const record = this.registry.get(componentId);
    if (!record || !record.root || !record.meshes.length) return target.makeEmpty();
    target.makeEmpty();
    for (const mesh of record.meshes) {
      mesh.updateWorldMatrix(true, false);
      target.expandByObject(mesh);
    }
    return target;
  }

  /** Walks up the ancestor chain to find the owning component ID. */
  resolveComponentId(object) {
    let current = object;
    while (current) {
      if (current.userData && current.userData.componentId) return current.userData.componentId;
      current = current.parent;
    }
    return null;
  }

  /** All component IDs currently present in the model. */
  getComponentIds() {
    return [...this.registry.keys()];
  }

  /* ── health visualisation ──────────────────────────────────────────── */

  /** Applies a map of `{ componentId: healthState }` to the model. */
  setComponentStates(states) {
    if (!states) return;
    for (const componentId of Object.keys(states)) {
      this.setComponentState(componentId, states[componentId]);
    }
  }

  setComponentState(componentId, state) {
    const record = this.registry.get(componentId);
    if (!record || !state) return;
    if (record.state === state) return;
    record.state = state;
    for (const material of record.materials) {
      if (state === HEALTH.NORMAL) resetMaterial(material);
      else applyHealth(material, state);
    }
  }

  setSelectedComponent(componentId) {
    this.selectedComponent = componentId;
  }

  setHoveredComponent(componentId) {
    this.hoveredComponent = componentId;
  }

  /* ── animation ─────────────────────────────────────────────────────── */

  _resetMotion() {
    this._carY = getFloorY(0);
    this._currentFloor = 0;
    this._destinationFloor = null;
    this._targetY = this._carY;
    this._phase = MOTION_STATES.IDLE;
    this._phaseTimer = randomBetween(0.35, 0.7);
    this._velocity = 0;
    this._doorOpen = 0;
    this._destinationHistory = [];
    this._setDoorProgress(0);
    this._pulleyAngle = 0;
    this._brakeEngagement = 1;
    this._safetyReason = null;
    this._safetyLatched = false;
    this._safetyDirection = 1;
    if (this.refs.cabin) this.refs.cabin.position.y = this._carY;
    if (this.refs.counterweight) this.refs.counterweight.position.y = -this._carY;
  }

  /**
   * Advances the animation by `dt` seconds using the current telemetry.
   * Reads only `telemetry.speed` and `telemetry.vibration` — every other visual
   * difference comes from the health states set via setComponentStates().
   *
   * @param {number} dt seconds since the previous frame
   * @param {object} twinState central application state
   */
  update(dt, twinState) {
    const telemetry = (twinState && twinState.telemetry) || {};
    const speed = Number.isFinite(Number(telemetry.speed)) ? Number(telemetry.speed) : 0;
    const vibration = Number.isFinite(Number(telemetry.vibration)) ? Number(telemetry.vibration) : 0;

    this._elapsed += dt;
    const safety = evaluateMotionSafety(twinState);
    this._updateSafety(safety, twinState);
    this._updateTravel(dt, speed);
    this._updateDoors(dt);
    this._updateBrake(dt);
    this._updateRotation(dt);
    this._updateRopes();
    this._updateVibration(vibration, twinState);
    this._updatePulses();
  }

  _updateTravel(dt, speed) {
    if (this._phase === MOTION_STATES.SAFETY_STOP || this._phase === MOTION_STATES.FAULT_LOCKOUT) {
      this._updateSafetyStop(dt);
      this._applyCabinPosition();
      return;
    }

    if (this._phase !== MOTION_STATES.MOVING) {
      if (this._phase === MOTION_STATES.IDLE) {
        this._phaseTimer -= dt;
        if (this._phaseTimer <= 0) this._chooseDestination();
      } else if (this._phase === MOTION_STATES.ARRIVING) {
        this._phaseTimer -= dt;
        if (this._phaseTimer <= 0) {
          this._phase = MOTION_STATES.DOOR_OPENING;
          this._phaseTimer = randomBetween(...DOOR_DURATION);
        }
      }
      this._applyCabinPosition();
      return;
    }

    // A destination may be selected while the brake is still engaged. Give
    // the existing brake animation time to release before the car accelerates.
    if (this._brakeEngagement > 0.05) {
      this._velocity = 0;
      this._applyCabinPosition();
      return;
    }

    const direction = Math.sign(this._targetY - this._carY) || 1;
    const remaining = Math.abs(this._targetY - this._carY);
    const brakeState = this.registry.get('brake')?.state || HEALTH.NORMAL;
    const brakingFactor = brakeState === HEALTH.FAULT
      ? 0.68
      : brakeState === HEALTH.HIGH_RISK
        ? 0.82
        : brakeState === HEALTH.WARNING
          ? 0.92
          : 1;
    const acceleration = 3.2 * brakingFactor;
    const requestedSpeed = Number(speed);
    const cruiseSpeed = (Number.isFinite(requestedSpeed) && requestedSpeed > 0.05)
      ? Math.min(4.8, Math.max(3.0, requestedSpeed * 1.35))
      : 3.8;
    const brakingDistance = (this._velocity * this._velocity) / (2 * acceleration);
    const desiredVelocity = remaining <= brakingDistance
      ? Math.sqrt(Math.max(0, remaining * 2 * acceleration))
      : cruiseSpeed;
    this._velocity += Math.sign(desiredVelocity - this._velocity) * acceleration * dt;
    this._velocity = Math.max(0, Math.min(cruiseSpeed, this._velocity));

    const step = Math.min(remaining, this._velocity * dt);
    this._carY += direction * step;
    if (remaining <= FLOOR_EPSILON || Math.abs(this._targetY - this._carY) <= FLOOR_EPSILON) {
      this._carY = this._targetY;
      this._velocity = 0;
      this._currentFloor = this._destinationFloor;
      this._phase = MOTION_STATES.ARRIVING;
      this._phaseTimer = randomBetween(...ARRIVAL_PAUSE);
    }

    this._applyCabinPosition();
  }

  _updateDoors(dt) {
    if (this._phase === MOTION_STATES.DOOR_OPENING) {
      this._doorOpen = Math.min(1, this._doorOpen + dt / Math.max(0.2, this._phaseTimer));
      if (this._doorOpen >= 1) {
        this._phase = MOTION_STATES.DOOR_OPEN;
        this._phaseTimer = randomBetween(...DOOR_DWELL);
      }
    } else if (this._phase === MOTION_STATES.DOOR_OPEN) {
      this._phaseTimer -= dt;
      if (this._phaseTimer <= 0) {
        this._phase = MOTION_STATES.DOOR_CLOSING;
        this._phaseTimer = randomBetween(...DOOR_DURATION);
      }
    } else if (this._phase === MOTION_STATES.DOOR_CLOSING) {
      const doorState = this.registry.get('door')?.state || HEALTH.NORMAL;
      const profile = DOOR_ALIGNMENT_PROFILES[doorState] || DOOR_ALIGNMENT_PROFILES.normal;
      this._doorOpen = Math.max(0, this._doorOpen - dt * profile.closeRate / Math.max(0.2, this._phaseTimer));
      if (this._doorOpen <= 0) {
        this._setDoorProgress(0);
        this._phase = MOTION_STATES.IDLE;
        this._phaseTimer = randomBetween(...DOOR_SAFETY_PAUSE);
      }
    }

    if (this._phase !== MOTION_STATES.DOOR_OPENING && this._phase !== MOTION_STATES.DOOR_CLOSING) {
      this._setDoorProgress(this._doorOpen);
      return;
    }
    this._setDoorProgress(this._doorOpen);
  }

  _setDoorProgress(progress) {
    this._doorOpen = Math.max(0, Math.min(1, progress));

    const doors = this.refs.doors;
    if (!doors) return;
    const doorState = this.registry.get('door')?.state || HEALTH.NORMAL;
    const profile = DOOR_ALIGNMENT_PROFILES[doorState] || DOOR_ALIGNMENT_PROFILES.normal;
    for (const side of ['left', 'right']) {
      const door = doors[side];
      if (!door) continue;
      const width = door.panel.geometry.parameters.width;
      const travelScale = side === 'left' ? profile.leftTravel : profile.rightTravel;
      const alignmentOffset = side === 'left' ? profile.leftOffset : profile.rightOffset;
      const travel = width * 0.98 * travelScale * this._doorOpen;
      const sign = side === 'right' ? 1 : -1;
      const base = door.panel.userData.closedX + alignmentOffset;
      door.panel.position.x = base + sign * travel;
      if (door.edge) {
        const edgeBase = door.edge.userData.closedX + alignmentOffset;
        door.edge.position.x = edgeBase + sign * travel;
      }
    }
  }

  _chooseDestination() {
    if (this._safetyLatched) return;
    const candidates = [];
    for (let floor = 0; floor < FLOOR_COUNT; floor += 1) {
      if (floor !== this._currentFloor && !this._destinationHistory.includes(floor)) candidates.push(floor);
    }
    const pool = candidates.length ? candidates : [...Array(FLOOR_COUNT).keys()].filter((floor) => floor !== this._currentFloor);
    const destination = pool[Math.floor(Math.random() * pool.length)];
    this._destinationFloor = destination;
    this._targetY = getFloorY(destination);
    this._destinationHistory = [...this._destinationHistory, destination].slice(-DESTINATION_HISTORY_LIMIT);
    this._phase = MOTION_STATES.MOVING;
    this._velocity = 0;
  }

  _updateSafety(safety, twinState) {
    if (safety.severity === 'critical' && !this._safetyLatched) {
      this._safetyLatched = true;
      this._safetyReason = safety.reason;
      this._safetyDirection = Math.sign(this._targetY - this._carY) || 1;
      this._destinationFloor = null;
      this._targetY = this._carY;
      this._doorOpen = 0;
      this._setDoorProgress(0);
      if (this._phase === MOTION_STATES.MOVING && this._velocity > 0) {
        this._phase = MOTION_STATES.SAFETY_STOP;
      } else {
        this._velocity = 0;
        this._phase = MOTION_STATES.FAULT_LOCKOUT;
      }
    }

    // A cleared snapshot is the existing explicit reset signal for this model.
    if (this._safetyLatched && safety.canMove && twinState?.controls) {
      this._safetyLatched = false;
      this._safetyReason = null;
      if (this._phase === MOTION_STATES.SAFETY_STOP || this._phase === MOTION_STATES.FAULT_LOCKOUT) {
        this._phase = MOTION_STATES.IDLE;
        this._phaseTimer = 0.45;
      }
    }
  }

  _updateSafetyStop(dt) {
    if (this._phase !== MOTION_STATES.SAFETY_STOP) return;
    this._velocity = Math.max(0, this._velocity - SAFETY_LIMITS.controlledStopAcceleration * dt);
    if (this._velocity <= 0.001) {
      this._velocity = 0;
      this._phase = MOTION_STATES.FAULT_LOCKOUT;
      return;
    }
    this._carY += this._safetyDirection * this._velocity * dt;
    this._carY = Math.min(DIMS.carTopY, Math.max(DIMS.carBottomY, this._carY));
  }

  _updateBrake(dt) {
    const state = this.registry.get('brake')?.state || HEALTH.NORMAL;
    const target = this._phase === MOTION_STATES.MOVING ? 0 : 1;
    const response = state === HEALTH.FAULT ? 0.75 : state === HEALTH.HIGH_RISK ? 1.1 : 1.8;
    this._brakeEngagement += (target - this._brakeEngagement) * Math.min(1, dt * response);

    if (this.refs.brakeCaliper) {
      const baseX = this.refs.brakeCaliper.userData.baseX ?? this.refs.brakeCaliper.position.x;
      this.refs.brakeCaliper.userData.baseX = baseX;
      this.refs.brakeCaliper.position.x = baseX - this._brakeEngagement * 0.055;
    }
    if (this.refs.brakeCoil) {
      const baseScale = this.refs.brakeCoil.userData.baseScale ?? this.refs.brakeCoil.scale.x;
      this.refs.brakeCoil.userData.baseScale = baseScale;
      this.refs.brakeCoil.scale.x = baseScale * (1 + this._brakeEngagement * 0.025);
    }
  }

  _applyCabinPosition() {
    if (this.refs.cabin) this.refs.cabin.position.y = this._carY;
    if (this.refs.counterweight) {
      const counterweightY = Math.min(DIMS.carTopY, Math.max(DIMS.carBottomY, -this._carY));
      this.refs.counterweight.position.y = counterweightY;
    }
  }

  _updateRotation(dt) {
    // The drive only turns while the car is moving, with direction preserved.
    const direction = this._targetY >= this._carY ? 1 : -1;
    this._pulleyAngle += direction * (this._velocity / DIMS.pulleyRadius) * dt;
    for (const key of ['pulley', 'motor', 'brake']) {
      const object = this.refs[key];
      if (!object) continue;
      // The sheave, rotor and brake disc all spin about the world Z axis.
      object.rotation.z = -this._pulleyAngle;
    }
  }

  _updateRopes() {
    const { sheaveY, carHeight, cwHeight } = DIMS;
    const carTop = this._carY + carHeight / 2 + 0.2;
    const cwTop = -this._carY + cwHeight / 2 + 0.18;

    for (const rope of this.refs.carRopes || []) this._stretchRope(rope, sheaveY, carTop);
    for (const rope of this.refs.cwRopes || []) this._stretchRope(rope, sheaveY, cwTop);
  }

  /** Scales a unit-height rope cylinder so it spans from `top` to `bottom`. */
  _stretchRope(rope, top, bottom) {
    const length = Math.max(0.05, top - bottom);
    rope.scale.y = length;
    rope.position.y = bottom + length / 2;
  }

  _updateVibration(vibration, twinState) {
    // Gentle, non-distracting shake that grows once vibration is above ~2.2 mm/s.
    const severity = Math.max(0, Math.min(1, (vibration - 2.2) / 7));
    const state = twinState && twinState.components ? twinState.components : {};
    const t = this._elapsed;
    const amplitude = severity * 0.05;

    if (this.refs.cabin) {
      const carAmplitude = amplitude + (state.cabin === HEALTH.NORMAL ? 0 : 0.02);
      this.refs.cabin.position.x = Math.sin(t * 26.4) * carAmplitude;
      // Keep Y owned by the floor state machine; vibration is lateral only.
      this.refs.cabin.position.y = this._carY;
      this.refs.cabin.rotation.z = Math.sin(t * 18.2) * carAmplitude * 0.12;
    }

    // Bearing / motor shake only when they are actually unhealthy.
    const bearingShake =
      state.bearing && state.bearing !== HEALTH.NORMAL
        ? (state.bearing === HEALTH.FAULT ? 0.035 : 0.018) * (0.6 + severity)
        : amplitude * 0.25;
    const shafts = this.refs.shafts;
    if (shafts) {
      const base = this.baseTransforms.get(shafts);
      if (base) {
        shafts.position.y = Math.sin(t * 41.3) * bearingShake;
        shafts.position.x = base.position.x + Math.sin(t * 37.7 + 1.3) * bearingShake * 0.6;
      }
    }
  }

  _updatePulses() {
    for (const record of this.registry.values()) {
      if (record.state === HEALTH.NORMAL) continue;
      for (const material of record.materials) updatePulse(material, this._elapsed);
    }
  }

  /* ── GLB support ───────────────────────────────────────────────────── */

  /**
   * Adopts a loaded glTF scene as the model, mapping its node names onto our
   * component IDs. Returns true when at least one component was recognised —
   * otherwise the caller should keep the procedural model.
   */
  applyGLTF(gltf) {
    const scene = gltf && gltf.scene ? gltf.scene : null;
    if (!scene) return false;

    let matched = 0;
    scene.traverse((object) => {
      if (!object.isMesh) return;
      const componentId =
        componentIdFromName(object.name) ||
        componentIdFromName(object.parent ? object.parent.name : '') ||
        (object.userData && object.userData.componentId) ||
        null;
      if (!componentId || !COMPONENT_MAP[componentId]) return;
      object.userData.componentId = componentId;
      object.userData.partId = object.userData.partId || normalizeNodeName(object.name);
      object.material = adoptMaterial(object.material);
      matched += 1;
    });

    if (!matched) return false;

    this._clear();
    this._fitModel(scene);
    this.group.add(scene);

    this.refs = {
      cabin: this._findByName(scene, 'cabin'),
      counterweight: this._findByName(scene, 'counterweight'),
      doors: this._collectDoors(scene),
      pulley: this._findByName(scene, 'pulley'),
      motor: this._findByName(scene, 'motor'),
      brake: this._findByName(scene, 'brake'),
      controller: this._findByName(scene, 'controller'),
      shafts: this._findByName(scene, 'bearing'),
      carRopes: [],
      cwRopes: []
    };

    this.source = 'glb';
    this._indexGroup();
    this._captureBaseTransforms();
    this._resetMotion();
    return true;
  }

  /**
   * Scales and centres an imported model so it occupies roughly the same
   * envelope as the procedural hoistway.
   */
  _fitModel(scene) {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const targetHeight = DIMS.topY - DIMS.pitY;
    const scale = size.y > 0.001 ? targetHeight / size.y : 1;
    scene.scale.setScalar(scale);
    // Re-centre horizontally and drop the model onto the pit floor.
    scene.position.set(-center.x * scale, DIMS.pitY - box.min.y * scale, -center.z * scale);
  }

  _findByName(root, componentId) {
    let found = null;
    root.traverse((object) => {
      if (found) return;
      if (object.userData && object.userData.componentId === componentId) found = object;
    });
    return found;
  }

  _collectDoors(root) {
    let left = null;
    let right = null;
    root.traverse((object) => {
      if (!object.userData || object.userData.componentId !== 'door') return;
      if (!object.isMesh) return;
      object.updateWorldMatrix(true, false);
      const x = object.getWorldPosition(new THREE.Vector3()).x;
      if (x < 0 && !left) left = { panel: object, edge: null };
      else if (x >= 0 && !right) right = { panel: object, edge: null };
    });
    if (!left && !right) return null;
    for (const entry of [left, right]) {
      if (entry && entry.panel) entry.panel.userData.closedX = entry.panel.position.x;
    }
    return { left, right };
  }

  /**
   * Loads a GLB and adopts it. Never throws: resolves to
   * `{ ok, reason }` so the caller can fall back to the procedural model.
   */
  async loadFromGLB(url) {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(url);
      const adopted = this.applyGLTF(gltf);
      if (!adopted) {
        return { ok: false, reason: 'no component nodes matched — using procedural model' };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error && error.message ? error.message : 'model could not be loaded' };
    }
  }

  /** Frees GPU resources held by the model. */
  dispose() {
    disposeObject(this.group);
    this._clear();
  }
}

/** Convenience factory: builds a procedural twin ready to be added to a scene. */
export function createElevatorTwin(options) {
  const twin = new ElevatorTwin(options);
  twin.build();
  return twin;
}
