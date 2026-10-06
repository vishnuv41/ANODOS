/**
 * ANODOS Digital Twin — Health scoring engine.
 *
 * Pure functions that turn a telemetry snapshot into:
 *   • a per-component risk score (0..1)
 *   • a per-component health state (normal / warning / high_risk / fault)
 *   • human-readable explanations ("what is wrong and why")
 *
 * The rules themselves live in src/scene/components.js so that component
 * metadata and thresholds stay together. This module only applies them.
 *
 * This local scoring is the *placeholder* for the ML model: when the backend is
 * connected, `prediction` from the API overrides these values (see
 * src/integration/api.js and the applyPrediction step in src/main.js).
 */

import {
  COMPONENTS,
  TELEMETRY_FIELDS,
  HEALTH,
  clamp01,
  healthRank,
  scoreToHealth,
  formatTelemetryValue
} from '../scene/components.js';

/** Relative weight of the worst component vs. the mean of all components. */
const OVERALL_MAX_WEIGHT = 0.7;
const OVERALL_MEAN_WEIGHT = 0.3;

/** A rule only becomes an "explanation" once it crosses this weighted score. */
const EXPLANATION_THRESHOLD = 0.3;

/**
 * Normalises a single rule into a 0..1 severity.
 * @returns {number} un-weighted severity (0 = healthy, 1 = at/over critical)
 */
export function scoreRule(rule, telemetry) {
  const field = TELEMETRY_FIELDS[rule.metric];
  const value = Number(telemetry ? telemetry[rule.metric] : NaN);
  if (!field || !Number.isFinite(value)) return 0;

  const direction = rule.direction || field.direction || 'up';
  const span = Math.abs(rule.crit - rule.safe);
  if (span === 0) return 0;

  let severity = 0;
  if (direction === 'up') {
    severity = (value - rule.safe) / span;
  } else if (direction === 'down') {
    severity = (rule.safe - value) / span;
  } else {
    const nominal = Number.isFinite(field.nominal) ? field.nominal : rule.safe;
    severity = (Math.abs(value - nominal) - rule.safe) / span;
  }

  return clamp01(severity);
}

/**
 * Scores one component against the current telemetry.
 * @param {object} component entry from COMPONENTS
 * @param {object} telemetry flat telemetry map
 */
export function scoreComponent(component, telemetry) {
  const breakdown = [];
  let score = 0;

  for (const rule of component.rules || []) {
    const severity = scoreRule(rule, telemetry);
    const weight = rule.weight === undefined ? 1 : rule.weight;
    const weighted = clamp01(severity * weight);
    const value = Number(telemetry ? telemetry[rule.metric] : NaN);
    const field = TELEMETRY_FIELDS[rule.metric];

    breakdown.push({
      metric: rule.metric,
      label: field ? field.label : rule.metric,
      value,
      formatted: formatTelemetryValue(rule.metric, value),
      severity: Number(severity.toFixed(3)),
      weighted: Number(weighted.toFixed(3)),
      weight,
      reason: rule.reason,
      safe: rule.safe,
      crit: rule.crit,
      direction: rule.direction || (field ? field.direction : 'up')
    });

    if (weighted > score) score = weighted;
  }

  breakdown.sort((a, b) => b.weighted - a.weighted);

  return {
    id: component.id,
    score: clamp01(score),
    state: scoreToHealth(score),
    breakdown,
    reasons: breakdown
      .filter((entry) => entry.weighted >= EXPLANATION_THRESHOLD)
      .map((entry) => entry.reason)
  };
}

/**
 * Scores every registered component and computes the unit-level risk.
 */
export function evaluateAll(telemetry) {
  const components = {};
  const scores = {};
  const breakdown = {};
  const reasons = {};
  const evaluations = [];

  for (const component of COMPONENTS) {
    const result = scoreComponent(component, telemetry);
    components[component.id] = result.state;
    scores[component.id] = Number(result.score.toFixed(4));
    breakdown[component.id] = result.breakdown;
    reasons[component.id] = result.reasons;
    evaluations.push(result);
  }

  const riskScore = computeOverallRisk(evaluations);

  return {
    components,
    scores,
    breakdown,
    reasons,
    evaluations,
    risk_score: riskScore,
    health: scoreToHealth(riskScore),
    explanations: buildExplanations(evaluations, breakdown)
  };
}

/**
 * Overall risk = 0.7 × worst component + 0.3 × mean of all components.
 * Weighting toward the worst component matches how maintenance triage works:
 * one failing subsystem dominates the unit's risk.
 */
export function computeOverallRisk(evaluations) {
  if (!evaluations.length) return 0;
  const scores = evaluations.map((entry) => entry.score);
  const worst = Math.max.apply(null, scores);
  const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  return Number(clamp01(OVERALL_MAX_WEIGHT * worst + OVERALL_MEAN_WEIGHT * mean).toFixed(4));
}

/** Worst health state across all components (headline badge). */
export function worstComponentHealth(components) {
  let worst = HEALTH.NORMAL;
  const values = components ? Object.values(components) : [];
  for (const state of values) {
    if (healthRank(state) > healthRank(worst)) worst = state;
  }
  return worst;
}

/**
 * Minimum risk implied by a reported health state.
 *
 * A fault can pin a component's state (see simulation/faultInjection.js) while
 * the numeric score stays moderate — for example a sensor corruption that only
 * moves a couple of metrics. This floor keeps the headline risk consistent with
 * what the component badges and the 3D model are showing.
 */
export const STATE_RISK_FLOOR = {
  [HEALTH.NORMAL]: 0,
  [HEALTH.WARNING]: 0.34,
  [HEALTH.HIGH_RISK]: 0.68,
  [HEALTH.FAULT]: 0.9
};

export function riskFloorFromStates(components) {
  const values = components ? Object.values(components) : [];
  let floor = 0;
  for (const state of values) {
    const candidate = STATE_RISK_FLOOR[state];
    if (Number.isFinite(candidate) && candidate > floor) floor = candidate;
  }
  return floor;
}

/** Backend-shaped explanation records (contract: `explanations: []`). */
function buildExplanations(evaluations, breakdown) {
  const severityOf = (value) => (value >= 0.8 ? 'critical' : value >= 0.55 ? 'high' : 'medium');
  const rank = { critical: 3, high: 2, medium: 1 };
  const explanations = [];

  for (const evaluation of evaluations) {
    const entries = breakdown[evaluation.id] || [];
    for (const entry of entries) {
      if (entry.weighted < EXPLANATION_THRESHOLD) continue;
      explanations.push({
        component_id: evaluation.id,
        metric: entry.metric,
        value: entry.value,
        formatted_value: entry.formatted,
        severity: severityOf(entry.severity),
        message: entry.reason,
        text: `${entry.label} ${entry.formatted} — ${entry.reason}.`
      });
    }
  }

  return explanations
    .sort((a, b) => rank[b.severity] - rank[a.severity])
    .slice(0, 12);
}

/** Ranked list of components by risk — used by the dashboard and alerts panel. */
export function rankComponents(scores) {
  const entries = scores ? Object.entries(scores) : [];
  return entries
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
