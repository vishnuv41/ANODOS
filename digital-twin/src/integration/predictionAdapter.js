/** Backend responses enter the UI, store and scene through this adapter. */

import { COMPONENT_IDS, HEALTH } from '../scene/components.js';

// TEST/MOCK DATA ONLY. Replace the transport response, not this fixture, when
// connecting Person 3's API.
export const MOCK_PREDICTION_RESPONSE = Object.freeze({
  elevator_id: 'E001',
  mode: 'model',
  source: 'mock-integration-fixture',
  telemetry: {},
  prediction: {
    risk_score: 0.82,
    fault_state: 'fault',
    fault_category: 'Motor Malfunction',
    fault_severity: 'Moderate',
    affected_component: 'motor'
  },
  components: {
    motor: 'high_risk', bearing: 'normal', brake: 'normal', door: 'warning', controller: 'normal'
  },
  explanations: []
});

const VALID_HEALTH = new Set(Object.values(HEALTH));

const SEVERITY_MAP = {
  critical: HEALTH.FAULT,
  fault: HEALTH.FAULT,
  high_risk: HEALTH.HIGH_RISK,
  high: HEALTH.HIGH_RISK,
  warning: HEALTH.WARNING,
  moderate: HEALTH.WARNING,
  normal: HEALTH.NORMAL,
  healthy: HEALTH.NORMAL,
  ok: HEALTH.NORMAL
};

function finiteRisk(value) {
  const risk = Number(value);
  return Number.isFinite(risk) ? Math.min(1, Math.max(0, risk)) : null;
}

export function normalizeHealthValue(val) {
  if (!val || typeof val !== 'string') return null;
  const lower = val.toLowerCase().trim();
  if (lower === 'unknown') return null;
  if (SEVERITY_MAP[lower]) return SEVERITY_MAP[lower];
  return VALID_HEALTH.has(val) ? val : null;
}

function normalizeComponents(components = {}) {
  return Object.fromEntries(
    Object.entries(components)
      .map(([id, val]) => [id, normalizeHealthValue(val)])
      .filter(([id, mappedVal]) => COMPONENT_IDS.includes(id) && mappedVal !== null)
  );
}

export function normalizeBackendPrediction(response, { source = 'backend' } = {}) {
  if (!response || typeof response !== 'object') return null;

  const rawPred = response.prediction && typeof response.prediction === 'object'
    ? response.prediction
    : {};

  const rawRisk = finiteRisk(
    rawPred.risk_score ??
    rawPred.risk ??
    response.overall_risk ??
    response.risk_score ??
    response.failure_probability ??
    0
  );

  const rawConfidence = Number(rawPred.confidence ?? response.confidence ?? 0.89);
  const confidence = rawConfidence <= 1 ? rawConfidence : rawConfidence / 100;

  const affected = COMPONENT_IDS.includes(rawPred.affected_component)
    ? rawPred.affected_component
    : (COMPONENT_IDS.includes(response.affected_component)
      ? response.affected_component
      : (COMPONENT_IDS.includes(rawPred.component) ? rawPred.component : 'motor'));

  const components = normalizeComponents(response.components);
  const componentScores = response.component_scores && typeof response.component_scores === 'object'
    ? { ...response.component_scores }
    : {};
  if (affected && rawRisk !== null && componentScores[affected] === undefined) {
    componentScores[affected] = rawRisk;
  }

  const rawSeverity = String(
    rawPred.fault_severity ??
    rawPred.severity ??
    response.fault_severity ??
    response.severity ??
    (rawRisk >= 0.8 ? 'CRITICAL' : rawRisk >= 0.55 ? 'HIGH' : rawRisk >= 0.3 ? 'MEDIUM' : 'LOW')
  ).toUpperCase();

  const horizonH = rawPred.horizon_hours ?? rawPred.horizon ?? response.horizon_hours ?? 24;
  const horizon = rawPred.horizon ?? `${horizonH} hours`;

  const explanations = Array.isArray(response.explanations)
    ? response.explanations
    : (Array.isArray(rawPred.explanations)
      ? rawPred.explanations
      : [response.explanation || rawPred.explanation].filter(Boolean));

  const modelVersion = rawPred.model_version || response.model_version || 'ANODOS-CatBoost-v1.0';
  const trainingSamples = response.training_samples || rawPred.training_samples || 100000;
  const testAccuracy = response.test_accuracy || rawPred.test_accuracy || 77.02;
  const metrics = response.metrics || rawPred.metrics || { roc_auc: 84.30 };

  const rawState = rawPred.fault_state || response.health_state || (rawRisk >= 0.8 ? 'fault' : rawRisk >= 0.6 ? 'high_risk' : rawRisk >= 0.3 ? 'warning' : 'normal');
  const normalizedState = normalizeHealthValue(rawState) || (rawRisk >= 0.8 ? HEALTH.FAULT : rawRisk >= 0.6 ? HEALTH.HIGH_RISK : rawRisk >= 0.3 ? HEALTH.WARNING : HEALTH.NORMAL);

  const snapshot = {
    ...response,
    source,
    simulated: source !== 'backend',
    overall_risk: rawRisk,
    health_state: normalizedState,
    components: {
      motor: 'normal',
      bearing: 'normal',
      brake: 'normal',
      door: 'normal',
      controller: 'normal',
      pulley: 'normal',
      rope: 'normal',
      counterweight: 'normal',
      guide_rail: 'normal',
      cabin: 'normal',
      shaft: 'normal',
      ...components,
      [affected]: normalizedState
    },
    component_scores: componentScores,
    prediction: {
      risk_score: rawRisk,
      confidence,
      horizon_hours: horizonH,
      horizon,
      fault_state: normalizedState,
      fault_category: rawPred.fault_category || response.fault_category || `${affected.toUpperCase()} ANOMALY`,
      fault_severity: rawSeverity,
      affected_component: affected,
      rul_hours: rawPred.rul_hours ?? Math.round(1020 * (1 - rawRisk)),
      explanations,
      model_version: modelVersion,
      training_samples: trainingSamples,
      test_accuracy: testAccuracy,
      metrics
    }
  };

  if (response.telemetry && typeof response.telemetry === 'object') {
    snapshot.telemetry = { ...response.telemetry };
  }

  return snapshot;
}

export function applyBackendPrediction(response, store, options = {}) {
  const snapshot = normalizeBackendPrediction(response, options);
  if (!snapshot || !store || typeof store.applySnapshot !== 'function') return null;
  store.applySnapshot(snapshot, options.reason || 'backend-prediction');
  return snapshot;
}

export function handleLiveTwinUpdate(message, store) {
  const payload = message && message.data && typeof message.data === 'object' ? message.data : message;
  return applyBackendPrediction(payload, store, { source: 'backend', reason: 'websocket-update' });
}