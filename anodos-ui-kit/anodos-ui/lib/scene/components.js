/**
 * ANODOS Digital Twin — Component & sensor domain model.
 *
 * This file is the single source of truth for:
 *   • the stable component IDs used by the 3D model, the UI and the backend contract
 *   • the virtual sensor catalogue (telemetry fields)
 *   • the scoring rules that turn telemetry into a per-component health state
 *
 * Everything here is data. Nothing in this file touches Three.js or the DOM, so it
 * can be imported by the simulator, the UI and the 3D layer alike.
 *
 * NOTE: all telemetry values are VIRTUAL / SIMULATED. They are not physical
 * measurements. The scoring rules below are an engineering approximation used to
 * drive the visualisation — the real risk classification is produced by the ML
 * service and consumed through src/integration/api.js.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * HEALTH STATES
 * ──────────────────────────────────────────────────────────────────────────── */

export const HEALTH = {
  NORMAL: 'normal',
  WARNING: 'warning',
  HIGH_RISK: 'high_risk',
  FAULT: 'fault'
};

/** Ordered from best to worst — used for comparisons and "worst wins" merges. */
export const HEALTH_ORDER = [HEALTH.NORMAL, HEALTH.WARNING, HEALTH.HIGH_RISK, HEALTH.FAULT];

export const HEALTH_LABELS = {
  [HEALTH.NORMAL]: 'NORMAL',
  [HEALTH.WARNING]: 'WARNING',
  [HEALTH.HIGH_RISK]: 'HIGH RISK',
  [HEALTH.FAULT]: 'FAULT'
};

/** Score thresholds (0..1) that separate the health states. */
export const HEALTH_THRESHOLDS = {
  warning: 0.3,
  high_risk: 0.55,
  fault: 0.8
};

export function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function clampTo(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Maps a 0..1 risk score onto a health state. */
export function scoreToHealth(score) {
  const value = clamp01(score);
  if (value >= HEALTH_THRESHOLDS.fault) return HEALTH.FAULT;
  if (value >= HEALTH_THRESHOLDS.high_risk) return HEALTH.HIGH_RISK;
  if (value >= HEALTH_THRESHOLDS.warning) return HEALTH.WARNING;
  return HEALTH.NORMAL;
}

export function healthRank(state) {
  const index = HEALTH_ORDER.indexOf(state);
  return index < 0 ? 0 : index;
}

/** Returns the worse of two health states. */
export function worstHealth(a, b) {
  return HEALTH_ORDER[Math.max(healthRank(a), healthRank(b))];
}

export function isHealthy(state) {
  return state === HEALTH.NORMAL;
}

/* ────────────────────────────────────────────────────────────────────────────
 * VIRTUAL SENSOR CATALOGUE
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Every readable value in the digital twin lives here.
 *
 * `source: 'control'`  → exposed as a slider in the Simulation panel
 * `source: 'derived'`  → computed by the simulator from the control inputs
 * `source: 'counter'`  → monotonically increasing lifetime counter
 *
 * `direction` describes what "bad" means for the metric:
 *   'up'        bad when it rises above nominal
 *   'down'      bad when it falls below nominal
 *   'deviation' bad when it drifts away from nominal in either direction
 */
export const TELEMETRY_FIELDS = {
  load: {
    key: 'load', label: 'Load', unit: 'kg', digits: 0, group: 'Mechanical',
    min: 0, max: 1600, step: 10, nominal: 650, source: 'control', direction: 'deviation'
  },
  speed: {
    key: 'speed', label: 'Speed', unit: 'm/s', digits: 2, group: 'Mechanical',
    min: 0, max: 6, step: 0.1, nominal: 2.5, source: 'control', direction: 'deviation'
  },
  vibration: {
    key: 'vibration', label: 'Vibration', unit: 'mm/s', digits: 2, group: 'Mechanical',
    min: 0, max: 12, step: 0.1, nominal: 1.8, source: 'control', direction: 'up'
  },
  motor_current: {
    key: 'motor_current', label: 'Motor Current', unit: 'A', digits: 2, group: 'Electrical',
    min: 0, max: 30, step: 0.1, nominal: 8.4, source: 'control', direction: 'up'
  },
  motor_temperature: {
    key: 'motor_temperature', label: 'Motor Temperature', unit: '°C', digits: 1, group: 'Thermal',
    min: 0, max: 140, step: 1, nominal: 65, source: 'control', direction: 'up'
  },
  door_cycles: {
    key: 'door_cycles', label: 'Door Cycles', unit: 'cyc/h', digits: 0, group: 'Mechanical',
    min: 0, max: 300, step: 1, nominal: 40, source: 'control', direction: 'up'
  },
  brake_force: {
    key: 'brake_force', label: 'Brake Force', unit: '%', digits: 0, group: 'Mechanical',
    min: 0, max: 100, step: 1, nominal: 92, source: 'control', direction: 'down'
  },
  rope_tension: {
    key: 'rope_tension', label: 'Rope Tension', unit: '×', digits: 2, group: 'Mechanical',
    min: 0.4, max: 1.6, step: 0.01, nominal: 1.0, source: 'control', direction: 'deviation'
  },
  ambient_temperature: {
    key: 'ambient_temperature', label: 'Ambient Temperature', unit: '°C', digits: 1, group: 'Thermal',
    min: -10, max: 60, step: 1, nominal: 30, source: 'control', direction: 'up'
  },

  /* ── derived ───────────────────────────────────────────────────────────── */
  bearing_temperature: {
    key: 'bearing_temperature', label: 'Bearing Temperature', unit: '°C', digits: 1, group: 'Thermal',
    min: 0, max: 140, step: 1, nominal: 58, source: 'control', direction: 'up'
  },
  pulley_rpm: {
    key: 'pulley_rpm', label: 'Sheave Speed', unit: 'rpm', digits: 0, group: 'Mechanical',
    nominal: 340, source: 'derived', direction: 'deviation'
  },
  sheave_wear: {
    key: 'sheave_wear', label: 'Sheave Wear', unit: '%', digits: 1, group: 'Mechanical',
    nominal: 12, source: 'derived', direction: 'up'
  },
  door_alignment: {
    key: 'door_alignment', label: 'Door Alignment', unit: 'mm', digits: 2, group: 'Mechanical',
    nominal: 0.3, source: 'derived', direction: 'up'
  },
  rail_friction: {
    key: 'rail_friction', label: 'Guide Rail Friction', unit: 'N', digits: 0, group: 'Mechanical',
    nominal: 180, source: 'derived', direction: 'up'
  },
  control_latency: {
    key: 'control_latency', label: 'Control Latency', unit: 'ms', digits: 0, group: 'Electrical',
    nominal: 12, source: 'derived', direction: 'up'
  },
  counterweight_offset: {
    key: 'counterweight_offset', label: 'Counterweight Offset', unit: 'mm', digits: 2, group: 'Mechanical',
    nominal: 1.5, source: 'derived', direction: 'up'
  },
  rope_stretch: {
    key: 'rope_stretch', label: 'Rope Stretch', unit: '%', digits: 2, group: 'Mechanical',
    nominal: 0.3, source: 'derived', direction: 'up'
  },
  cabin_ride_quality: {
    key: 'cabin_ride_quality', label: 'Ride Quality', unit: 'ISO', digits: 2, group: 'Comfort',
    nominal: 0.6, source: 'derived', direction: 'up'
  },
  motor_load_factor: {
    key: 'motor_load_factor', label: 'Motor Load', unit: '%', digits: 0, group: 'Electrical',
    nominal: 46, source: 'derived', direction: 'up'
  },
  operating_hours: {
    key: 'operating_hours', label: 'Operating Hours', unit: 'h', digits: 0, group: 'Lifetime',
    min: 0, max: 20000, step: 10, nominal: 8421, source: 'control', direction: 'up'
  }
};

const CONTROL_ORDER = [
  'load',
  'speed',
  'vibration',
  'motor_current',
  'motor_temperature',
  'bearing_temperature',
  'door_cycles',
  'brake_force',
  'operating_hours'
];

/** Control inputs rendered as sliders in the Simulation panel (ordered). */
export const CONTROL_FIELDS = CONTROL_ORDER
  .map((key) => TELEMETRY_FIELDS[key])
  .filter(Boolean);

export const TELEMETRY_ORDER = [
  'speed',
  'load',
  'vibration',
  'motor_current',
  'motor_temperature',
  'bearing_temperature',
  'door_cycles',
  'door_alignment',
  'brake_force',
  'rope_tension',
  'rope_stretch',
  'pulley_rpm',
  'sheave_wear',
  'rail_friction',
  'counterweight_offset',
  'control_latency',
  'cabin_ride_quality',
  'motor_load_factor',
  'ambient_temperature',
  'operating_hours'
];

/** Human-readable rendering of a telemetry value, e.g. "71.2 °C". */
export function formatTelemetryValue(fieldKey, value) {
  const field = TELEMETRY_FIELDS[fieldKey];
  if (!field || value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const digits = field.digits ?? 2;
  const numeric = Number(value);
  if (field.group === 'Lifetime' || Math.abs(numeric) >= 10000) {
    const formatted = numeric.toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
    return `${formatted} ${field.unit}`;
  }
  return `${numeric.toFixed(digits)} ${field.unit}`;
}

/** Value + unit split, for compact UI rows. */
export function formatTelemetryParts(fieldKey, value) {
  const field = TELEMETRY_FIELDS[fieldKey];
  if (!field) return { value: '—', unit: '' };
  const full = formatTelemetryValue(fieldKey, value);
  const unit = field.unit;
  return { value: full.slice(0, Math.max(0, full.length - unit.length)).trim(), unit };
}
/* ────────────────────────────────────────────────────────────────────────────
 * COMPONENT REGISTRY
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Rule shape
 *   metric     telemetry key the rule reads
 *   safe       value (or deviation from nominal) still considered healthy
 *   crit       value (or deviation) considered critical
 *   direction  'up' | 'down' | 'deviation'  — defaults to the field's direction
 *   weight     0..1 relative influence inside the component score
 *   reason     short engineering explanation shown in the inspector
 */
const RULE = (metric, safe, crit, reason, weight = 1, direction = null) => ({
  metric, safe, crit, weight, reason, direction
});

/**
 * The canonical component list. `id` values are the stable identifiers shared
 * with the backend contract and the 3D scene (`mesh.userData.componentId`).
 */
export const COMPONENTS = [
  {
    id: 'motor',
    label: 'Traction Motor',
    subtitle: 'Gearless PMSM drive unit',
    critical: true,
    category: 'Drive',
    color: 0x5b7fb8,
    accent: '#5b8dd6',
    description:
      'Gearless permanent-magnet synchronous motor driving the traction sheave. ' +
      'Thermal and current behaviour are the leading indicators of insulation ageing.',
    sensors: ['motor_temperature', 'motor_current', 'motor_load_factor', 'vibration'],
    rules: [
      RULE('motor_temperature', 70, 105, 'Motor winding temperature above design envelope', 1),
      RULE('motor_current', 12, 24, 'Motor current draw above nominal band', 0.9),
      RULE('motor_load_factor', 70, 100, 'Sustained high motor load factor', 0.6),
      RULE('vibration', 3.2, 9, 'Vibration transmitted into the motor frame', 0.5)
    ],
    maintenance: {
      interval: '12 months',
      lastService: '2026-03-14',
      nextService: '2027-03-14',
      note: 'Check winding insulation resistance and encoder coupling.'
    }
  },
  {
    id: 'bearing',
    label: 'Bearing',
    subtitle: 'Traction sheave bearing set',
    critical: true,
    category: 'Drive',
    color: 0x8f96a8,
    accent: '#a6adbd',
    description:
      'Rolling element bearings supporting the traction sheave. ' +
      'Vibration RMS and raceway temperature are the primary degradation signals.',
    sensors: ['bearing_temperature', 'vibration', 'sheave_wear', 'operating_hours'],
    rules: [
      RULE('vibration', 2.8, 8.5, 'High vibration + elevated bearing temperature', 1),
      RULE('bearing_temperature', 68, 95, 'Bearing raceway running hot', 1),
      RULE('operating_hours', 22000, 45000, 'Operating hours beyond expected bearing life', 0.6),
      RULE('sheave_wear', 40, 85, 'Sheave wear accelerating bearing load', 0.7)
    ],
    maintenance: {
      interval: '6 months',
      lastService: '2026-06-02',
      nextService: '2026-12-02',
      note: 'Re-grease bearing housing, measure radial play.'
    }
  },
  {
    id: 'brake',
    label: 'Brake',
    subtitle: 'Electromagnetic safety brake',
    critical: true,
    category: 'Safety',
    color: 0xc46a4a,
    accent: '#d97f5c',
    description:
      'Dual-circuit fail-safe brake holding the car at floor level. ' +
      'Holding force decay and release latency are the critical safety metrics.',
    sensors: ['brake_force', 'door_cycles', 'control_latency'],
    rules: [
      RULE('brake_force', 85, 45, 'Braking force has degraded below safe holding margin', 1, 'down'),
      RULE('door_cycles', 120, 260, 'Heavy start/stop duty cycle accelerating pad wear', 0.6),
      RULE('control_latency', 25, 90, 'Brake release latency elevated', 0.5)
    ],
    maintenance: {
      interval: '3 months',
      lastService: '2026-07-21',
      nextService: '2026-10-21',
      note: 'Measure pad thickness and holding torque.'
    }
  },
  {
    id: 'door',
    label: 'Doors',
    subtitle: 'Car & landing door operator',
    critical: true,
    category: 'Access',
    color: 0x4f9d8a,
    accent: '#5fc0a8',
    description:
      'Automatic door operator with sill alignment tracking. ' +
      'Misalignment drives nuisance stops and is an early indicator of track wear.',
    sensors: ['door_alignment', 'door_cycles', 'control_latency'],
    rules: [
      RULE('door_alignment', 0.8, 3.2, 'Door sill alignment drifting out of tolerance', 1),
      RULE('door_cycles', 90, 240, 'Door cycle rate above design duty', 0.7),
      RULE('control_latency', 25, 90, 'Door operator responding slowly', 0.4)
    ],
    maintenance: {
      interval: '3 months',
      lastService: '2026-08-05',
      nextService: '2026-11-05',
      note: 'Align sill, clean tracks, verify door-closed contact.'
    }
  },
  {
    id: 'controller',
    label: 'Controller',
    subtitle: 'VVVF drive & control cabinet',
    critical: true,
    category: 'Electrical',
    color: 0x6d6fb0,
    accent: '#8a8ce0',
    description:
      'Variable voltage variable frequency drive and the elevator control cabinet. ' +
      'Cabinet temperature and command latency indicate electronics stress.',
    sensors: ['control_latency', 'motor_current', 'ambient_temperature'],
    rules: [
      RULE('control_latency', 20, 80, 'Controller command latency above nominal', 1),
      RULE('ambient_temperature', 40, 56, 'Control cabinet running hot', 0.7),
      RULE('motor_current', 13, 26, 'Drive current stress', 0.5)
    ],
    maintenance: {
      interval: '6 months',
      lastService: '2026-05-18',
      nextService: '2026-11-18',
      note: 'Clean cabinet filters, verify drive parameters and error log.'
    }
  },
  {
    id: 'pulley',
    label: 'Pulley',
    subtitle: 'Traction sheave',
    critical: false,
    category: 'Drive',
    color: 0x7c8698,
    accent: '#98a2b5',
    description:
      'Traction sheave transferring motor torque to the suspension ropes. ' +
      'Groove wear reduces rope contact area and increases slip.',
    sensors: ['pulley_rpm', 'sheave_wear', 'vibration'],
    rules: [
      RULE('sheave_wear', 35, 85, 'Sheave groove wear reducing rope traction', 1),
      RULE('pulley_rpm', 60, 170, 'Sheave speed deviating from commanded speed', 0.8, 'deviation'),
      RULE('vibration', 3, 9, 'Sheave vibration indicating imbalance', 0.6)
    ],
    maintenance: {
      interval: '12 months',
      lastService: '2026-04-09',
      nextService: '2027-04-09',
      note: 'Measure groove depth and rope contact geometry.'
    }
  },
  {
    id: 'rope',
    label: 'Ropes',
    subtitle: 'Suspension rope set',
    critical: true,
    category: 'Suspension',
    color: 0xb9a06a,
    accent: '#d8bd80',
    description:
      'Steel suspension ropes carrying the car and counterweight. ' +
      'Tension imbalance and stretch drive uneven loading across the set.',
    sensors: ['rope_tension', 'rope_stretch', 'load'],
    rules: [
      RULE('rope_tension', 0.08, 0.32, 'Rope tension balance outside tolerance', 1, 'deviation'),
      RULE('rope_stretch', 0.7, 2.5, 'Rope elongation beyond elastic range', 0.8)
    ],
    maintenance: {
      interval: '6 months',
      lastService: '2026-06-30',
      nextService: '2026-12-30',
      note: 'Check tension equalisation and broken-wire count.'
    }
  },
  {
    id: 'counterweight',
    label: 'Counterweight',
    subtitle: 'Balancing mass & guide shoes',
    critical: false,
    category: 'Suspension',
    color: 0x5f6b7c,
    accent: '#7d8b9e',
    description:
      'Balances the car mass so the motor only lifts the payload difference. ' +
      'Tracking offset indicates guide shoe or rope imbalance.',
    sensors: ['counterweight_offset', 'rope_tension', 'load'],
    rules: [
      RULE('counterweight_offset', 3, 12, 'Counterweight tracking offset from guide centre', 1),
      RULE('rope_tension', 0.1, 0.34, 'Tension imbalance pulling the counterweight', 0.7, 'deviation')
    ],
    maintenance: {
      interval: '12 months',
      lastService: '2026-02-11',
      nextService: '2027-02-11',
      note: 'Inspect guide shoes and weight block fasteners.'
    }
  },
  {
    id: 'guide_rail',
    label: 'Guide Rails',
    subtitle: 'Car & counterweight guide rails',
    critical: false,
    category: 'Structure',
    color: 0x6a7480,
    accent: '#8b95a3',
    description:
      'Vertical guide rails constraining car travel. ' +
      'Increasing friction shows lubrication breakdown or rail misalignment.',
    sensors: ['rail_friction', 'vibration', 'load'],
    rules: [
      RULE('rail_friction', 260, 620, 'Guide rail friction rising above baseline', 1),
      RULE('vibration', 3.2, 9, 'Lateral vibration coupling into the rails', 0.7),
      RULE('load', 420, 980, 'Sustained off-balance loading on the guide system', 0.4, 'deviation')
    ],
    maintenance: {
      interval: '6 months',
      lastService: '2026-07-02',
      nextService: '2027-01-02',
      note: 'Lubricate rail surfaces, verify bracket torque and plumb.'
    }
  },
  {
    id: 'cabin',
    label: 'Cabin',
    subtitle: 'Passenger car & frame',
    critical: false,
    category: 'Structure',
    color: 0x4a90a4,
    accent: '#5fb3cb',
    description:
      'Passenger car assembly with sling, floor and load weighing device. ' +
      'Ride quality summarises the felt effect of every upstream component.',
    sensors: ['cabin_ride_quality', 'load', 'speed'],
    rules: [
      RULE('cabin_ride_quality', 1.0, 3.0, 'Ride quality degrading — felt as jerk and noise', 1),
      RULE('load', 420, 980, 'Car load far from balanced design point', 0.5, 'deviation')
    ],
    maintenance: {
      interval: '12 months',
      lastService: '2026-01-27',
      nextService: '2027-01-27',
      note: 'Verify levelling accuracy and load weighing calibration.'
    }
  },
  {
    id: 'shaft',
    label: 'Shaft',
    subtitle: 'Hoistway environment',
    critical: false,
    category: 'Structure',
    color: 0x39465a,
    accent: '#546380',
    description:
      'Hoistway enclosure modelled as the thermal and structural environment. ' +
      'Ambient heat is a shared stressor for every component inside.',
    sensors: ['ambient_temperature', 'rail_friction'],
    rules: [
      RULE('ambient_temperature', 40, 56, 'Hoistway ambient temperature above design range', 1),
      RULE('rail_friction', 300, 700, 'Hoistway friction load elevated', 0.4)
    ],
    maintenance: {
      interval: '12 months',
      lastService: '2026-01-05',
      nextService: '2027-01-05',
      note: 'Check pit ventilation, lighting and hoistway cleanliness.'
    }
  }
];

export const COMPONENT_IDS = COMPONENTS.map((component) => component.id);

export const COMPONENT_MAP = COMPONENTS.reduce((map, component) => {
  map[component.id] = component;
  return map;
}, {});

/** Runtime registry shared by the 3D scene and integration layer. */
export function createComponentRegistry() {
  return new Map(COMPONENTS.map((component) => [component.id, {
    id: component.id,
    object: null,
    displayName: component.label,
    telemetry: [...(component.sensors || [])],
    state: HEALTH.NORMAL,
    meshes: [],
    materials: [],
    root: null
  }]));
}

export function getComponent(componentId) {
  return COMPONENT_MAP[componentId] || null;
}

/** Suggested action per health state, shown in the inspector. */
export const RECOMMENDATIONS = {
  [HEALTH.NORMAL]: 'Within design envelope — continue scheduled maintenance plan.',
  [HEALTH.WARNING]: 'Trending outside nominal band — schedule inspection.',
  [HEALTH.HIGH_RISK]: 'Plan corrective maintenance within the next service window.',
  [HEALTH.FAULT]: 'Immediate intervention required — take unit out of normal duty.'
};
