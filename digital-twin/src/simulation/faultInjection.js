/**
 * ANODOS Digital Twin — Fault injection engine.
 *
 * Every fault is declared as data (see FAULT_CATALOGUE) and applied by one
 * generic function, so adding a new fault — or a new severity — is a data change,
 * not a code change.
 *
 * A fault can do four things:
 *   • shift control inputs      → `controlsDelta`   (feeds the derived model)
 *   • offset derived telemetry  → `telemetryDelta`  (applied after derivation)
 *   • force a telemetry value   → `telemetrySet`
 *   • pin a component state     → `componentState`
 *
 * `injectFault` returns the resulting state *and* a diff of what changed, which
 * the UI renders as "what changed" and which is packaged for the later
 * backend/AI integration.
 */

import { COMPONENT_MAP, TELEMETRY_FIELDS, formatTelemetryValue } from '../scene/components.js';
import { deriveTelemetry, sanitizeControls } from './simulator.js';

export const FAULT_SEVERITIES = ['mild', 'moderate', 'critical'];

export const SEVERITY_LABELS = {
  mild: 'Mild',
  moderate: 'Moderate',
  critical: 'Critical'
};

/**
 * Fault catalogue.
 *
 * `controlsDelta` and `telemetryDelta` are additive; `telemetrySet` is absolute.
 * `componentState` pins the component's reported health state so that the 3D
 * visualisation is deterministic regardless of scoring — the numeric risk score
 * is still computed from the corrupted telemetry.
 */
export const FAULT_CATALOGUE = {
  bearing_degradation: {
    id: 'bearing_degradation',
    label: 'Bearing Degradation',
    component: 'bearing',
    category: 'mechanical',
    icon: 'bearing',
    description: 'Raceway pitting and lubrication breakdown in the sheave bearing set.',
    levels: {
      mild: {
        controlsDelta: { vibration: 1.2 },
        telemetryDelta: { bearing_temperature: 6 },
        componentState: 'warning'
      },
      moderate: {
        controlsDelta: { vibration: 3.6 },
        telemetryDelta: { bearing_temperature: 12 },
        componentState: 'high_risk'
      },
      critical: {
        controlsDelta: { vibration: 7.5 },
        telemetryDelta: { bearing_temperature: 26, sheave_wear: 20 },
        componentState: 'fault'
      }
    }
  },

  motor_overheating: {
    id: 'motor_overheating',
    label: 'Motor Overheating',
    component: 'motor',
    category: 'thermal',
    icon: 'motor',
    description: 'Winding insulation stress from sustained thermal overload.',
    levels: {
      mild: {
        controlsDelta: { motor_temperature: 12, motor_current: 1.5 },
        componentState: 'warning'
      },
      moderate: {
        controlsDelta: { motor_temperature: 28, motor_current: 3.8 },
        telemetryDelta: { control_latency: 6 },
        componentState: 'high_risk'
      },
      critical: {
        controlsDelta: { motor_temperature: 55, motor_current: 9 },
        telemetryDelta: { control_latency: 22 },
        componentState: 'fault'
      }
    }
  },

  door_misalignment: {
    id: 'door_misalignment',
    label: 'Door Misalignment',
    component: 'door',
    category: 'mechanical',
    icon: 'door',
    description: 'Sill and track wear pushing the doors out of alignment.',
    levels: {
      mild: {
        controlsDelta: { door_cycles: 25 },
        telemetryDelta: { door_alignment: 1.3 },
        componentState: 'warning'
      },
      moderate: {
        controlsDelta: { door_cycles: 80 },
        telemetryDelta: { door_alignment: 2.4 },
        componentState: 'high_risk'
      },
      critical: {
        controlsDelta: { door_cycles: 160 },
        telemetryDelta: { door_alignment: 4.6, control_latency: 12 },
        componentState: 'fault'
      }
    }
  },

  brake_wear: {
    id: 'brake_wear',
    label: 'Brake Wear',
    component: 'brake',
    category: 'safety',
    icon: 'brake',
    description: 'Pad wear and coil ageing reducing holding force margin.',
    levels: {
      mild: {
        controlsDelta: { brake_force: -12 },
        componentState: 'warning'
      },
      moderate: {
        controlsDelta: { brake_force: -27 },
        telemetryDelta: { control_latency: 8 },
        componentState: 'high_risk'
      },
      critical: {
        controlsDelta: { brake_force: -52 },
        telemetryDelta: { control_latency: 20 },
        componentState: 'fault'
      }
    }
  },

  rope_tension_abnormality: {
    id: 'rope_tension_abnormality',
    label: 'Rope Tension Abnormality',
    component: 'rope',
    category: 'mechanical',
    icon: 'rope',
    description: 'Unequal tension across the rope set, loading some ropes harder.',
    levels: {
      mild: {
        controlsDelta: { rope_tension: -0.09 },
        componentState: 'warning'
      },
      moderate: {
        controlsDelta: { rope_tension: -0.22 },
        telemetryDelta: { counterweight_offset: 1.6 },
        componentState: 'high_risk'
      },
      critical: {
        controlsDelta: { rope_tension: -0.42 },
        telemetryDelta: { counterweight_offset: 3.4, rope_stretch: 0.9 },
        componentState: 'fault'
      }
    }
  },

  sensor_abnormality: {
    id: 'sensor_abnormality',
    label: 'Sensor Abnormality',
    component: 'controller',
    category: 'electrical',
    icon: 'sensor',
    description:
      'Encoder / feedback channel corruption — readings become noisy and biased ' +
      'while the machine itself may still be healthy.',
    levels: {
      mild: {
        telemetryDelta: { control_latency: 18, bearing_temperature: 4 },
        componentState: 'warning'
      },
      moderate: {
        telemetryDelta: { control_latency: 42, bearing_temperature: 11, vibration: 1.4 },
        componentState: 'high_risk'
      },
      critical: {
        telemetryDelta: { control_latency: 85, bearing_temperature: 22, vibration: 3.2, motor_temperature: 16 },
        componentState: 'fault'
      }
    }
  }
};

export const FAULT_IDS = Object.keys(FAULT_CATALOGUE);

export function getFault(faultId) {
  return FAULT_CATALOGUE[faultId] || null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * SCENARIO PRESETS
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * A few ready-made operating scenarios for the demo. Each is just a fault with a
 * severity, so they exercise exactly the same code path as manual injection.
 */
export const SCENARIO_PRESETS = [
  { id: 'nominal', label: 'Nominal Duty', fault: null, severity: null, hint: 'sliders at design point' },
  { id: 'peak_traffic', label: 'Peak Traffic', fault: null, severity: null, hint: 'high load, high cycles' },
  { id: 'bearing_risk', label: 'Degrading Bearing', fault: 'bearing_degradation', severity: 'moderate' },
  { id: 'brake_critical', label: 'Brake Critical', fault: 'brake_wear', severity: 'critical' },
  { id: 'sensor_noise', label: 'Sensor Noise', fault: 'sensor_abnormality', severity: 'moderate' }
];

/* ────────────────────────────────────────────────────────────────────────────
 * APPLICATION
 * ──────────────────────────────────────────────────────────────────────────── */

const NUMERIC_TOLERANCE = 1e-6;

/**
 * Applies a fault to a simulator instance without running it.
 *
 * @param {object} params
 * @param {import('./simulator.js').Simulator} params.simulator
 * @param {string} params.faultId
 * @param {'mild'|'moderate'|'critical'} params.severity
 * @returns {object} injection result (never throws for bad input — returns {ok:false})
 */
export function injectFault({ simulator, faultId, severity = 'moderate' }) {
  const fault = getFault(faultId);
  if (!fault) {
    return { ok: false, error: `Unknown fault "${faultId}"`, changes: [] };
  }
  if (!FAULT_SEVERITIES.includes(severity)) {
    return { ok: false, error: `Unknown severity "${severity}"`, changes: [] };
  }

  const level = fault.levels[severity];
  if (!level) {
    return { ok: false, error: `Fault "${faultId}" has no "${severity}" level`, changes: [] };
  }

  // ── 1. snapshot the "before" state ──
  const beforeControls = simulator.getControls();
  const beforeTelemetry = deriveTelemetry(beforeControls, { operatingHours: simulator.operatingHours });

  // ── 2. build the corrupted control set ──
  const requested = { ...beforeControls };
  for (const [key, delta] of Object.entries(level.controlsDelta || {})) {
    requested[key] = Number(requested[key] || 0) + delta;
  }
  const { controls: afterControls, issues } = sanitizeControls(requested);

  // ── 3. build the corrupted telemetry ──
  const baseAfter = deriveTelemetry(afterControls, { operatingHours: simulator.operatingHours });
  const afterTelemetry = { ...baseAfter };
  for (const [key, delta] of Object.entries(level.telemetryDelta || {})) {
    afterTelemetry[key] = Number(afterTelemetry[key] || 0) + delta;
  }
  for (const [key, absolute] of Object.entries(level.telemetrySet || {})) {
    afterTelemetry[key] = absolute;
  }

  // ── 4. commit to the simulator ──
  simulator.applyControls(afterControls);

  const componentOverrides = {};
  if (level.componentState) componentOverrides[fault.component] = level.componentState;
  // Secondary effects: a corrupted rope set tugs the counterweight, etc.
  for (const [id, state] of Object.entries(level.extraComponentStates || {})) {
    componentOverrides[id] = state;
  }

  // ── 5. diff: what actually changed ──
  const changes = diffTelemetry(beforeTelemetry, afterTelemetry);

  return {
    ok: true,
    fault: {
      id: fault.id,
      label: fault.label,
      component: fault.component,
      component_label: COMPONENT_MAP[fault.component] ? COMPONENT_MAP[fault.component].label : fault.component,
      category: fault.category,
      severity,
      severity_label: SEVERITY_LABELS[severity],
      description: fault.description
    },
    controls: afterControls,
    telemetryOverrides: afterTelemetry,
    componentOverrides,
    changes,
    issues,
    alert: buildAlert(fault, severity, changes)
  };
}

/** Numeric diff of two telemetry maps, limited to fields that moved. */
export function diffTelemetry(before, after, limit = 8) {
  const changes = [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  for (const key of keys) {
    const from = Number(before ? before[key] : NaN);
    const to = Number(after ? after[key] : NaN);
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    const delta = to - from;
    if (Math.abs(delta) < NUMERIC_TOLERANCE) continue;

    changes.push({
      metric: key,
      label: TELEMETRY_FIELDS[key] ? TELEMETRY_FIELDS[key].label : key,
      before: from,
      after: to,
      delta: Number(delta.toFixed(3)),
      direction: delta > 0 ? 'up' : 'down',
      formatted_before: formatTelemetryValue(key, from),
      formatted_after: formatTelemetryValue(key, to),
      unit: TELEMETRY_FIELDS[key] ? TELEMETRY_FIELDS[key].unit : ''
    });
  }

  // Biggest relative movers first, so the panel shows what matters.
  changes.sort((a, b) => Math.abs(b.delta) / (Math.abs(b.after) || 1) - Math.abs(a.delta) / (Math.abs(a.after) || 1));
  return changes.slice(0, limit);
}

function buildAlert(fault, severity, changes) {
  const componentLabel = COMPONENT_MAP[fault.component]
    ? COMPONENT_MAP[fault.component].label
    : fault.component;
  const headline =
    severity === 'critical' ? `${fault.label} — CRITICAL` : `${fault.label} — ${SEVERITY_LABELS[severity]}`;

  const detail = changes
    .slice(0, 3)
    .map((change) => `${change.label} ${change.direction === 'up' ? '↑' : '↓'} ${change.formatted_after}`)
    .join(' · ');

  return {
    severity,
    title: headline,
    component: fault.component,
    message: detail ? `${componentLabel}: ${detail}` : `${componentLabel}: ${fault.description}`,
    fault_category: `${fault.id}`,
    at: new Date().toISOString()
  };
}

/** Human-readable one-line summary of a fault level, for the UI. */
export function describeFaultEffects(faultId, severity) {
  const fault = getFault(faultId);
  if (!fault) return '';
  const level = fault.levels[severity] || {};
  const parts = [];
  for (const [key, delta] of Object.entries(level.controlsDelta || {})) {
    parts.push(`${labelOf(key)} ${delta > 0 ? '+' : ''}${round(delta)}`);
  }
  for (const [key, delta] of Object.entries(level.telemetryDelta || {})) {
    parts.push(`${labelOf(key)} ${delta > 0 ? '+' : ''}${round(delta)}`);
  }
  return parts.join(' · ');
}

function labelOf(key) {
  return TELEMETRY_FIELDS[key] ? TELEMETRY_FIELDS[key].label : key;
}

function round(value) {
  return Number(Number(value).toFixed(3));
}
