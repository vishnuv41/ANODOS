/**
 * ANODOS Digital Twin — Integration configuration.
 *
 * Configured for backend connection via VITE_BACKEND_URL (e.g. http://10.20.20.92:8001).
 * Supports REST & WebSocket connections for dynamic elevator IDs (E001, E002, E003).
 */

const getBackendBase = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '');
  }
  return '';
};

export const API_CONFIG = {
  /** Base URL for REST calls. Relative when empty (proxied by Vite in dev). */
  baseUrl: getBackendBase() ? `${getBackendBase()}` : '',

  /** When true, API calls are served by the in-browser mock backend. */
  useMock: false,

  /** Abort a request after this many milliseconds. */
  timeoutMs: 8000,

  /** The mock backend answers after a small delay (min/max ms). */
  mockLatencyMs: [140, 380],

  /** Simulated failure rate of mock backend. */
  mockFailureRate: 0,

  /** Default elevator under test. */
  elevatorId: 'E001',

  /** Available elevators in backend. */
  availableElevators: ['E001', 'E002', 'E003']
};

/**
 * REST endpoints matching ANODOS backend contract.
 */
export const ENDPOINTS = {
  health: '/health',
  healthApi: '/api/health',
  state: (elevatorId) => `/api/elevator/${encodeURIComponent(elevatorId)}/state`,
  statePlural: (elevatorId) => `/api/elevators/${encodeURIComponent(elevatorId)}/state`,
  simulate: (elevatorId) => `/api/elevator/${encodeURIComponent(elevatorId)}/simulate`,
  predict: (elevatorId) => `/api/elevator/${encodeURIComponent(elevatorId)}/predict`,
  batchPredict: (elevatorId) => `/api/elevator/${encodeURIComponent(elevatorId)}/batch-predict`,
  timeline: (elevatorId) => `/api/elevators/${encodeURIComponent(elevatorId)}/timeline`,
  rul: (elevatorId) => `/api/elevators/${encodeURIComponent(elevatorId)}/rul`,
  explain: (elevatorId) => `/api/elevator/${encodeURIComponent(elevatorId)}/explain`,
  history: (elevatorId) => `/api/elevator/${encodeURIComponent(elevatorId)}/history`
};

export const WS_CONFIG = {
  /** `/ws/elevator/{elevator_id}` — the path served by backend. */
  path: (elevatorId) => `/ws/elevator/${encodeURIComponent(elevatorId)}`,

  /** Absolute ws:// URL, computed from VITE_BACKEND_URL or current browser origin. */
  absoluteUrl: (elevatorId, origin) => {
    const backendBase = getBackendBase();
    if (backendBase) {
      const wsHost = backendBase.replace(/^http/, 'ws');
      return `${wsHost}${WS_CONFIG.path(elevatorId)}`;
    }
    const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
    const protocol = base.startsWith('https') ? 'wss' : 'ws';
    const host = base.replace(/^https?:\/\//, '');
    return `${protocol}://${host}${WS_CONFIG.path(elevatorId)}`;
  },

  /** Exponential backoff used by reconnect loop (ms). */
  reconnectDelaysMs: [1000, 2000, 4000, 8000, 15000],

  /** Give up after this many consecutive failed reconnects (0 = forever). */
  maxReconnectAttempts: 8,

  /** When true, a local mock stream produces telemetry ticks. */
  mockEnabled: false,

  /** Interval between mock telemetry ticks (ms). */
  mockIntervalMs: 2500,

  /** Application-level heartbeat. */
  pingIntervalMs: 20000
};

/** Runtime switch flag. */
export const USE_MOCK = API_CONFIG.useMock;
