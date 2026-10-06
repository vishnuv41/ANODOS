/**
 * ANODOS Digital Twin — Backend integration (REST).
 *
 * Public surface
 *   simulateElevator(payload)          → full twin snapshot + prediction
 *   fetchElevatorState(id)             → last known state of a unit (/api/elevator/{id}/state)
 *   fetchElevatorStatePlural(id)       → state via plural route (/api/elevators/{id}/state)
 *   predictFault(payload)              → prediction only (/api/elevator/{id}/predict)
 *   fetchBatchPrediction(id, chunkSize)→ batch inference result (/api/elevator/{id}/batch-predict)
 *   fetchElevatorTimeline(id)          → incident history (/api/elevators/{id}/timeline)
 *   fetchElevatorRul(id)               → remaining useful life (/api/elevators/{id}/rul)
 *   checkBackendHealth()               → { ok, status, latency_ms }
 *   setDataSource('mock'|'backend'), getDataSource()
 */

import { API_CONFIG, ENDPOINTS } from './config.js';
import { createSimulator, deriveTelemetry, sanitizeControls, buildPrediction } from '../simulation/simulator.js';
import { evaluateAll, riskFloorFromStates, worstComponentHealth } from '../simulation/scoring.js';
import { injectFault } from '../simulation/faultInjection.js';

/* ────────────────────────────────────────────────────────────────────────────
 * ERRORS
 * ──────────────────────────────────────────────────────────────────────────── */

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status || 0;
    this.code = options.code || 'api_error';
    this.kind = options.kind || 'unknown'; // 'network' | 'timeout' | 'http' | 'invalid'
    this.payload = options.payload || null;
    this.endpoint = options.endpoint || '';
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * SMALL UTILITIES
 * ──────────────────────────────────────────────────────────────────────────── */

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

/** Joins configured base URL with an endpoint path. */
export function buildUrl(path) {
  const base = (API_CONFIG.baseUrl || '').replace(/\/$/, '');
  const suffix = String(path || '').startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

function safeClone(value) {
  if (!value || typeof value !== 'object') return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return null;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * MOCK BACKEND
 * ──────────────────────────────────────────────────────────────────────────── */

const mockStats = { calls: 0, failures: 0, lastLatencyMs: 0 };

export function mockSimulateElevator(payload = {}, options = {}) {
  const elevatorId = payload.elevator_id || API_CONFIG.elevatorId;

  const { controls, issues } = sanitizeControls(payload.controls || {});
  const operatingHours = Number.isFinite(Number(payload.operating_hours))
    ? Number(payload.operating_hours)
    : 8421;

  let telemetry = deriveTelemetry(controls, { operatingHours });
  let componentOverrides = safeClone(payload.component_overrides) || {};
  let faultInfo = null;
  let faultChanges = [];
  let faultAlert = null;

  if (payload.fault && payload.fault.id) {
    const adapter = {
      getControls: () => ({ ...controls }),
      applyControls: () => {},
      operatingHours
    };
    const injection = injectFault({
      simulator: adapter,
      faultId: payload.fault.id,
      severity: payload.fault.severity || 'moderate'
    });
    if (injection.ok) {
      telemetry = { ...telemetry, ...(injection.telemetryOverrides || {}) };
      componentOverrides = { ...componentOverrides, ...(injection.componentOverrides || {}) };
      faultInfo = injection.fault;
      faultChanges = injection.changes || [];
      faultAlert = injection.alert || null;
    }
  }

  if (payload.telemetry_overrides) {
    telemetry = { ...telemetry, ...safeClone(payload.telemetry_overrides) };
  }

  const evaluation = evaluateAll(telemetry);
  const components = { ...evaluation.components, ...componentOverrides };
  const riskScore = Number(
    Math.max(
      evaluation.risk_score,
      ...Object.values(evaluation.scores),
      riskFloorFromStates(components)
    ).toFixed(4)
  );

  const prediction = buildPrediction(
    { ...evaluation, risk_score: riskScore },
    { source: 'mock-backend' }
  );

  return {
    elevator_id: elevatorId,
    mode: payload.mode || 'simulation',
    simulated: true,
    source: 'mock-backend',
    generated_at: new Date().toISOString(),
    telemetry,
    prediction,
    components,
    component_scores: evaluation.scores,
    component_breakdown: evaluation.breakdown,
    health_state: worstComponentHealth(components),
    overall_risk: riskScore,
    explanations: evaluation.explanations,
    fault: faultInfo,
    fault_changes: faultChanges,
    fault_alert: faultAlert,
    issues,
    notes: [
      'Served by in-browser mock backend.'
    ]
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * TRANSPORT
 * ──────────────────────────────────────────────────────────────────────────── */

async function request(path, { method = 'GET', body = null, signal = null } = {}) {
  const url = buildUrl(path);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), API_CONFIG.timeoutMs);

  if (signal && typeof signal.addEventListener === 'function') {
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timeout);
    const aborted = error && (error.name === 'AbortError' || error.name === 'TimeoutError');
    throw new ApiError(
      aborted ? `Request to ${url} timed out after ${API_CONFIG.timeoutMs} ms` : `Cannot reach backend at ${url}`,
      { kind: aborted ? 'timeout' : 'network', endpoint: url, code: aborted ? 'timeout' : 'network_error' }
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      `Backend returned ${response.status} ${response.statusText} for ${url}`,
      {
        status: response.status,
        kind: 'http',
        code: `http_${response.status}`,
        payload: data,
        endpoint: url
      }
    );
  }

  return data;
}

/* ────────────────────────────────────────────────────────────────────────────
 * PUBLIC API
 * ──────────────────────────────────────────────────────────────────────────── */

let currentSource = API_CONFIG.useMock ? 'mock' : 'backend';

export function setDataSource(source) {
  currentSource = source === 'backend' ? 'backend' : 'mock';
  return currentSource;
}

export function getDataSource() {
  return currentSource;
}

export function isMock() {
  return currentSource === 'mock';
}

export function getMockStats() {
  return { ...mockStats };
}

/** Health probe. */
export async function checkBackendHealth() {
  const started = performance.now();
  try {
    const url = buildUrl(ENDPOINTS.health);
    const response = await fetch(url);
    const data = await response.json();
    return {
      ok: response.ok,
      status: data && data.status ? data.status : 'ok',
      latency_ms: Math.round(performance.now() - started),
      payload: data
    };
  } catch (error) {
    return {
      ok: false,
      status: 'unreachable',
      latency_ms: Math.round(performance.now() - started),
      error: error instanceof ApiError ? error.message : String(error),
      kind: error instanceof ApiError ? error.kind : 'unknown'
    };
  }
}

/**
 * Simulates elevator and returns twin state + prediction.
 */
export async function simulateElevator(payload = {}) {
  const elevatorId = payload.elevator_id || API_CONFIG.elevatorId;
  const controls = payload.controls || {};

  const body = {
    motor_temperature: Number(controls.motor_temperature ?? 65),
    vibration_level: Number(controls.vibration_level ?? controls.vibration ?? 1.8),
    motor_current: Number(controls.motor_current ?? 8.4),
    bearing_temperature: Number(controls.bearing_temperature ?? 58),
    speed: Number(controls.speed ?? 2.5),
    load: Number(controls.load ?? 650),
    door_cycles: Number(controls.door_cycles ?? 40),
    brake_force: Number(controls.brake_force ?? 92),
    operating_hours: Number(payload.operating_hours ?? controls.operating_hours ?? 8421)
  };

  console.log('[Simulation] payload=', JSON.stringify(body));

  if (isMock()) {
    mockStats.calls += 1;
    const [minDelay, maxDelay] = API_CONFIG.mockLatencyMs;
    await delay(randomBetween(minDelay, maxDelay));
    const latency = API_CONFIG.mockLatencyMs[0];
    mockStats.lastLatencyMs = latency;
    return { ...mockSimulateElevator(payload), latency_ms: latency };
  }

  const data = await request(ENDPOINTS.simulate(elevatorId), { method: 'POST', body, signal: payload.signal || null });
  if (!data || typeof data !== 'object') {
    throw new ApiError('Backend returned an empty simulate response', {
      kind: 'invalid',
      code: 'empty_response'
    });
  }
  return { ...data, source: data.source || 'backend' };
}

/**
 * Fetch last known state of an elevator unit.
 */
export async function fetchElevatorState(elevatorId = API_CONFIG.elevatorId) {
  if (isMock()) {
    await delay(90);
    const base = mockSimulateElevator({ elevator_id: elevatorId, mode: 'live' });
    return { ...base, source: 'mock-backend', latency_ms: 90 };
  }
  return request(ENDPOINTS.state(elevatorId), { method: 'GET' });
}

/**
 * Fetch state via plural endpoint.
 */
export async function fetchElevatorStatePlural(elevatorId = API_CONFIG.elevatorId) {
  if (isMock()) {
    return fetchElevatorState(elevatorId);
  }
  return request(ENDPOINTS.statePlural(elevatorId), { method: 'GET' });
}

/**
 * Request prediction only.
 */
export async function predictFault(payload = {}) {
  const elevatorId = payload.elevator_id || API_CONFIG.elevatorId;
  if (isMock()) {
    await delay(120);
    const snapshot = mockSimulateElevator({ ...payload, mode: 'diagnostic' });
    return {
      elevator_id: elevatorId,
      prediction: snapshot.prediction,
      explanations: snapshot.explanations,
      source: 'mock-backend'
    };
  }
  return request(ENDPOINTS.predict(elevatorId), { method: 'POST', body: payload });
}

/**
 * Trigger batch prediction on unseen dataset.
 */
export async function fetchBatchPrediction(elevatorId = API_CONFIG.elevatorId, chunkSize = 10000) {
  if (isMock()) {
    await delay(200);
    return {
      elevator_id: elevatorId,
      processed_rows: 5000,
      class_0: 1349,
      class_1: 3651,
      risk_min: 0.1916488632,
      risk_max: 0.7527828675,
      risk_mean: 0.5775161204,
      source: 'mock-backend'
    };
  }
  return request(ENDPOINTS.batchPredict(elevatorId), {
    method: 'POST',
    body: { chunk_size: chunkSize }
  });
}

/**
 * Fetch timeline / history for an elevator.
 */
export async function fetchElevatorTimeline(elevatorId = API_CONFIG.elevatorId) {
  if (isMock()) {
    await delay(100);
    return { elevator_id: elevatorId, timeline: [] };
  }
  return request(ENDPOINTS.timeline(elevatorId), { method: 'GET' });
}

/**
 * Fetch Remaining Useful Life (RUL) estimation.
 */
export async function fetchElevatorRul(elevatorId = API_CONFIG.elevatorId) {
  if (isMock()) {
    await delay(100);
    return { elevator_id: elevatorId, remaining_hours: 4200, health_percentage: 92 };
  }
  return request(ENDPOINTS.rul(elevatorId), { method: 'GET' });
}

/** Convenience bundle. */
export function createApi(overrides = {}) {
  return {
    simulateElevator,
    fetchElevatorState,
    fetchElevatorStatePlural,
    predictFault,
    fetchBatchPrediction,
    fetchElevatorTimeline,
    fetchElevatorRul,
    checkBackendHealth,
    setDataSource,
    getDataSource,
    isMock,
    getMockStats,
    ...overrides
  };
}

export const api = createApi();
export { API_CONFIG, ENDPOINTS };
