/**
 * ANODOS Digital Twin — Simulation engine.
 *
 * Responsibilities
 *   1. Hold the *control inputs* (the sliders in the Simulation panel).
 *   2. Derive the full virtual telemetry snapshot from those inputs using a
 *      deterministic engineering model (documented per formula below).
 *   3. Run the health scoring engine to obtain component states + risk score.
 *   4. Package everything into the backend-shaped contract object.
 *
 * The derived model is intentionally simple and explainable — it exists to drive
 * the digital twin visuals, not to be a physical simulation. When Person 3's
 * backend is available, its response replaces the derived values (see
 * src/integration/api.js).
 */

import {
  CONTROL_FIELDS,
  TELEMETRY_FIELDS,
  HEALTH,
  clampTo,
  clamp01,
  scoreToHealth
} from '../scene/components.js';
import { evaluateAll, rankComponents, riskFloorFromStates, worstComponentHealth } from './scoring.js';

export const MAX_LOAD_KG = 1600;
export const MAX_SPEED_MS = 6;

/** Neutral / nominal operating point (matches the demo example values). */
export const DEFAULT_CONTROLS = Object.freeze({
  load: 650,
  speed: 2.5,
  vibration: 1.8,
  motor_current: 8.4,
  motor_temperature: 65,
  bearing_temperature: 58,
  door_cycles: 40,
  brake_force: 92,
  operating_hours: 8421
});

/** Component → fault category label used in the prediction payload. */
export const FAULT_CATEGORY_BY_COMPONENT = {
  motor: 'motor_overheating',
  bearing: 'bearing_failure',
  brake: 'brake_degradation',
  door: 'door_misalignment',
  controller: 'controller_fault',
  pulley: 'pulley_wear',
  rope: 'rope_tension_anomaly',
  counterweight: 'counterweight_imbalance',
  guide_rail: 'guide_rail_wear',
  cabin: 'cabin_ride_degradation',
  shaft: 'environment_stress'
};

/* ────────────────────────────────────────────────────────────────────────────
 * INPUT VALIDATION
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Cleans arbitrary user input into a valid control set.
 * Invalid / missing / non-numeric entries fall back to the defaults and are
 * reported back so the UI can surface them.
 *
 * @returns {{controls: object, issues: Array<{field:string, message:string}>}}
 */
export function sanitizeControls(input) {
  const controls = {};
  const issues = [];

  for (const field of CONTROL_FIELDS) {
    const fallback = DEFAULT_CONTROLS[field.key];
    const raw = input ? input[field.key] : undefined;

    if (raw === undefined || raw === null || raw === '') {
      controls[field.key] = fallback;
      continue;
    }

    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) {
      controls[field.key] = fallback;
      issues.push({ field: field.key, message: `${field.label} must be a number — using ${fallback}` });
      continue;
    }

    const clamped = clampTo(numeric, field.min, field.max);
    if (clamped !== numeric) {
      issues.push({
        field: field.key,
        message: `${field.label} clamped to ${clamped} ${field.unit} (allowed ${field.min}–${field.max})`
      });
    }
    controls[field.key] = clamped;
  }

  return { controls, issues };
}

/* ────────────────────────────────────────────────────────────────────────────
 * DERIVED TELEMETRY MODEL
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Derives every non-control telemetry value from the control inputs.
 *
 * Formulas are linear blends of the load factor (LF = load / 1600) and the speed
 * factor (SF = speed / 6) so the behaviour stays monotonic and explainable.
 */
export function deriveTelemetry(controls, context = {}) {
  const telemetry = {};

  // ── pass-through control inputs ──
  for (const field of CONTROL_FIELDS) {
    telemetry[field.key] = Number(controls[field.key]);
  }

  const LF = clamp01(telemetry.load / MAX_LOAD_KG);
  const SF = clamp01(telemetry.speed / MAX_SPEED_MS);
  const tensionDev = Math.abs(telemetry.rope_tension - 1);
  const ambient = telemetry.ambient_temperature;

  // Lifetime counter — only ever moves forward.
  const hours = Number.isFinite(context.operatingHours) ? context.operatingHours : 8421;
  telemetry.operating_hours = hours;

  // ── electrical / drive ──
  telemetry.motor_load_factor = clampTo(18 + 55 * LF + 30 * SF, 0, 130);
  telemetry.pulley_rpm = Math.round(telemetry.speed * (340 / 2.5));

  // ── thermal ──
  // Bearing heat = ambient + motor conduction + friction from vibration.
  telemetry.bearing_temperature =
    0.35 * ambient + 0.45 * telemetry.motor_temperature + 1.6 * telemetry.vibration + 14;

  // ── mechanical wear ──
  telemetry.sheave_wear = clampTo(
    9 + 8 * LF + 6 * SF + 30 * tensionDev,
    0,
    100
  );

  telemetry.door_alignment = clampTo(
    0.1 + 3.5 * Math.pow(clamp01(telemetry.door_cycles / 300), 1.4) + 0.25 * tensionDev,
    0,
    12
  );

  telemetry.rail_friction = clampTo(
    120 + 90 * LF + 45 * SF + 6 * telemetry.vibration,
    0,
    1200
  );

  telemetry.control_latency = clampTo(
    5 + 8 * SF + Math.max(0, telemetry.motor_temperature - 20) * 0.06 + telemetry.door_cycles * 0.01,
    0,
    250
  );

  telemetry.counterweight_offset = clampTo(
    0.3 + 3.2 * Math.abs(telemetry.load - DEFAULT_CONTROLS.load) / 950 + 2.0 * tensionDev,
    0,
    30
  );

  telemetry.rope_stretch = clampTo(
    0.05 + 1.2 * tensionDev + 0.09 * LF + hours * 0.00002,
    0,
    10
  );

  // Depends on rail_friction + door_alignment, so it is computed last.
  telemetry.cabin_ride_quality = clampTo(
    0.1 +
      0.15 * telemetry.vibration +
      0.05 * telemetry.speed +
      0.0006 * telemetry.rail_friction +
      0.02 * telemetry.door_alignment,
    0,
    6
  );

  return roundTelemetry(telemetry);
}

/** Rounds each value to the display precision of its field. */
function roundTelemetry(telemetry) {
  const rounded = {};
  for (const [key, value] of Object.entries(telemetry)) {
    const field = TELEMETRY_FIELDS[key];
    const digits = field ? field.digits : 2;
    rounded[key] = Number(Number(value).toFixed(digits));
  }
  return rounded;
}

/* ────────────────────────────────────────────────────────────────────────────
 * PREDICTION PACKAGING
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Converts local scores into the backend prediction contract shape.
 * `source: 'local-model'` marks it as the placeholder, so the UI can label it
 * honestly. The real backend response sets `source: 'backend'`.
 */
export function buildPrediction(evaluation, options = {}) {
  const ranked = rankComponents(evaluation.scores);
  const top = ranked[0] || { id: null, score: 0 };
  const health = scoreToHealth(evaluation.risk_score);

  const affecting = ranked.filter((entry) => entry.score >= 0.3 && entry.id !== top.id).map((e) => e.id);

  return {
    risk_score: evaluation.risk_score,
    fault_state: health,
    health_state: health,
    fault_category: top.id ? FAULT_CATEGORY_BY_COMPONENT[top.id] || `${top.id}_degradation` : null,
    fault_severity: severityLabel(evaluation.risk_score),
    affected_component: top.id,
    secondary_components: affecting.slice(0, 3),
    component_risk: evaluation.scores,
    confidence: Number(clamp01(0.55 + evaluation.risk_score * 0.4).toFixed(2)),
    horizon_hours: Math.round(240 - 200 * evaluation.risk_score),
    source: options.source || 'local-model',
    generated_at: new Date().toISOString()
  };
}

export function severityLabel(score) {
  if (score >= 0.8) return 'critical';
  if (score >= 0.55) return 'high';
  if (score >= 0.3) return 'medium';
  if (score > 0.05) return 'low';
  return 'none';
}

/* ────────────────────────────────────────────────────────────────────────────
 * SIMULATOR
 * ──────────────────────────────────────────────────────────────────────────── */

const HISTORY_LIMIT = 120;
const HOURS_PER_RUN = 0.05;

/**
 * Owns the current control inputs, the derived telemetry and the health history.
 * The UI never computes health itself — it calls the simulator and renders the
 * returned snapshot.
 */
export class Simulator {
  constructor(options = {}) {
    this.elevatorId = options.elevatorId || 'E001';
    this.controls = { ...DEFAULT_CONTROLS };
    this.operatingHours = options.operatingHours || 8421;
    this.history = [];
    this.runCount = 0;
    this.lastSnapshot = null;
    this.lastIssues = [];
  }

  /** Current control values (copy). */
  getControls() {
    return { ...this.controls };
  }

  /** Applies a partial control update, sanitising the result. */
  setControls(patch) {
    const { controls, issues } = sanitizeControls({ ...this.controls, ...patch });
    this.controls = controls;
    this.lastIssues = issues;
    return { controls, issues };
  }

  resetControls() {
    this.controls = { ...DEFAULT_CONTROLS };
    this.lastIssues = [];
    return { controls: this.getControls(), issues: [] };
  }

  /** Replaces the control set wholesale (used by scenario presets / faults). */
  applyControls(fullControls) {
    return this.setControls(fullControls);
  }

  hasControlsChanged() {
    return CONTROL_FIELDS.some(
      (field) => Math.abs(this.controls[field.key] - DEFAULT_CONTROLS[field.key]) > 1e-6
    );
  }

  /**
   * Runs one simulation step:
   *   controls → derived telemetry → scoring → snapshot
   * @param {object} options.telemetryOverrides  forced values (fault injection)
   * @param {object} options.componentOverrides  forced component states
   * @param {boolean} options.advanceHours
   */
  run(options = {}) {
    const base = deriveTelemetry(this.controls, { operatingHours: this.operatingHours });

    const telemetry = { ...base, ...(options.telemetryOverrides || {}) };

    if (options.advanceHours !== false) {
      this.operatingHours += HOURS_PER_RUN * Math.max(0.2, this.controls.speed / 2.5);
      telemetry.operating_hours = Number(this.operatingHours.toFixed(2));
    }

    const evaluation = evaluateAll(telemetry);

    // Fault injection may hard-pin a component state on top of the scores.
    if (options.componentOverrides) {
      for (const [id, state] of Object.entries(options.componentOverrides)) {
        if (state) evaluation.components[id] = state;
      }
    }

    const worst = worstComponentHealth(evaluation.components);
    const scoreRisk = Math.max(evaluation.risk_score, ...Object.values(evaluation.scores));
    // A pinned fault state must still show up in the headline risk even when the
    // numeric scores stayed moderate (e.g. a sensor-only corruption).
    const riskScore = Number(Math.max(scoreRisk, riskFloorFromStates(evaluation.components)).toFixed(4));

    const snapshot = {
      elevator_id: this.elevatorId,
      mode: options.mode || 'simulation',
      timestamp: new Date().toISOString(),
      run: ++this.runCount,
      controls: this.getControls(),
      telemetry,
      prediction: buildPrediction({ ...evaluation, risk_score: riskScore }, options),
      components: evaluation.components,
      component_scores: evaluation.scores,
      component_breakdown: evaluation.breakdown,
      component_reasons: evaluation.reasons,
      health_state: worst,
      overall_risk: Number(riskScore.toFixed(4)),
      explanations: evaluation.explanations,
      source: options.source || 'local-model',
      issues: this.lastIssues.slice(),
      annotations: options.annotations || []
    };

    this.lastSnapshot = snapshot;
    this._pushHistory(snapshot);
    return snapshot;
  }

  /** Telemetry snapshot without re-scoring (used by the WebSocket mock). */
  preview() {
    return {
      controls: this.getControls(),
      telemetry: deriveTelemetry(this.controls, { operatingHours: this.operatingHours })
    };
  }

  /** Last produced snapshot, or a freshly computed one if none exists yet. */
  latest() {
    return this.lastSnapshot || this.run({ advanceHours: false, mode: 'live' });
  }

  getHistory() {
    return this.history.slice();
  }

  _pushHistory(snapshot) {
    this.history.push({
      t: snapshot.timestamp,
      risk: snapshot.overall_risk,
      heat: snapshot.telemetry.motor_temperature,
      vibration: snapshot.telemetry.vibration,
      load: snapshot.telemetry.load,
      fault_state: snapshot.prediction.fault_state
    });
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
  }
}

/** Convenience factory so callers do not need `new`. */
export function createSimulator(options) {
  return new Simulator(options);
}

/** Health state of a component, defaulting to NORMAL when unknown. */
export function componentHealth(components, id) {
  if (!components || !(id in components)) return HEALTH.NORMAL;
  return components[id];
}

export { evaluateAll as evaluateTelemetry } from './scoring.js';
