/**
 * ANODOS Digital Twin — Central application state.
 *
 * ONE store for the whole application. The 3D scene, every UI panel and the
 * integration layer read from here and write through the actions below — no
 * module keeps its own copy of the twin state, so the model, the numbers and the
 * colours can never disagree.
 *
 * The state object mirrors the backend contract documented in the project README
 * (`elevator_id`, `mode`, `telemetry`, `prediction`, `components`, `explanations`)
 * and adds presentation-only fields (selection, alerts, history, connection).
 *
 * Implementation: a tiny observable store. `setState` performs a shallow merge
 * and notifies subscribers with the new state and a `reason` string, so listeners
 * can skip work when the change is not relevant to them.
 */

import { HEALTH, TELEMETRY_FIELDS } from '../scene/components.js';

export const MODE = {
  SIMULATION: 'simulation',
  LIVE: 'live',
  DIAGNOSTIC: 'diagnostic'
};

/** Where the data currently comes from. */
export const DATA_SOURCE = {
  MOCK: 'mock',
  BACKEND: 'backend'
};

export const CONNECTION = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error',
  OFFLINE: 'offline'
};

export const STATUS = {
  INITIALISING: 'initialising',
  READY: 'ready',
  RUNNING: 'running',
  ERROR: 'error'
};

const ALERT_LIMIT = 40;
const HISTORY_LIMIT = 120;

/** Empty (but structurally complete) initial state. */
function createInitialState(overrides = {}) {
  const components = {};
  for (const key of Object.keys(TELEMETRY_FIELDS)) {
    // no-op: kept for clarity — components are seeded below
    void key;
  }

  return {
    /* ── contract fields ── */
    elevator_id: 'E001',
    mode: MODE.SIMULATION,
    telemetry: {},
    prediction: {},
    components: {},
    explanations: [],

    /* ── derived / display fields ── */
    component_scores: {},
    component_breakdown: {},
    component_reasons: {},
    overall_risk: 0,
    health_state: HEALTH.NORMAL,
    controls: {},
    run: 0,
    source: 'local-model',
    simulated: true,

    /* ── app-level fields ── */
    status: STATUS.INITIALISING,
    data_source: DATA_SOURCE.BACKEND,
    connection: {
      api: CONNECTION.IDLE,
      ws: CONNECTION.IDLE,
      last_update: null,
      last_error: null,
      attempts: 0
    },
    selected_component: null,
    hovered_component: null,
    alerts: [],
    history: [],
    issues: [],
    annotations: [],
    model_source: 'procedural',
    camera_view: 'reset',

    ...overrides
  };
}

/**
 * Creates the store.
 * @param {object} [initial] partial initial state
 */
export function createTwinState(initial = {}) {
  let state = createInitialState(initial);
  const listeners = new Set();

  function notify(reason) {
    for (const listener of listeners) {
      try {
        listener(state, reason);
      } catch (error) {
        // A broken panel must never take down the store or the 3D scene.
        console.error(`[twin-state] listener failed on "${reason}"`, error);
      }
    }
  }

  return {
    /* ── core store API ─────────────────────────────────────────────── */

    getState() {
      return state;
    },

    /** Shallow merge of top-level keys. Nested objects should be replaced whole. */
    setState(patch, reason = 'setState') {
      if (!patch) return state;
      const next = { ...state, ...patch };
      if (shallowEqual(state, next)) return state;
      state = next;
      notify(reason);
      return state;
    },

    /** Functional update helper. */
    update(updater, reason = 'update') {
      const patch = updater(state);
      return this.setState(patch, reason);
    },

    /** @returns {() => void} unsubscribe */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /* ── domain actions ─────────────────────────────────────────────── */

    /**
     * Applies a full snapshot (from the simulator, the mock backend or the real
     * backend). Only known contract fields are copied, so a malformed payload
     * cannot corrupt the store.
     */
    applySnapshot(snapshot, reason = 'snapshot') {
      if (!snapshot || typeof snapshot !== 'object') return state;
      const patch = {};
      const copyIfPresent = (key, target = key) => {
        if (snapshot[key] !== undefined && snapshot[key] !== null) patch[target] = snapshot[key];
      };

      copyIfPresent('elevator_id');
      copyIfPresent('mode');
      copyIfPresent('telemetry');
      copyIfPresent('prediction');
      copyIfPresent('components');
      copyIfPresent('explanations');
      copyIfPresent('component_scores');
      copyIfPresent('component_breakdown');
      copyIfPresent('component_reasons');
      copyIfPresent('overall_risk');
      copyIfPresent('health_state');
      copyIfPresent('controls');
      copyIfPresent('run');
      copyIfPresent('source');
      copyIfPresent('issues');
      copyIfPresent('annotations');

      patch.connection = {
        ...state.connection,
        last_update: new Date().toISOString(),
        last_error: null
      };
      patch.simulated = snapshot.source !== 'backend';
      patch.status = STATUS.READY;

      return this.setState(patch, reason);
    },

    /** Applies only a telemetry delta (used by the live WebSocket stream). */
    applyTelemetry(telemetry, reason = 'telemetry') {
      if (!telemetry) return state;
      return this.setState({ telemetry: { ...state.telemetry, ...telemetry } }, reason);
    },

    /** Sets one component's health state. */
    setComponentState(componentId, healthState, reason = 'component') {
      if (!componentId || !healthState) return state;
      return this.setState(
        { components: { ...state.components, [componentId]: healthState } },
        reason
      );
    },

    /** Replaces several component states at once. */
    setComponentStates(componentStates, reason = 'components') {
      if (!componentStates) return state;
      return this.setState({ components: { ...state.components, ...componentStates } }, reason);
    },

    /** Selection / hover (presentation only — never affects the health model). */
    selectComponent(componentId) {
      if (state.selected_component === componentId) return state;
      return this.setState({ selected_component: componentId }, 'select');
    },

    clearSelection() {
      return this.selectComponent(null);
    },

    setHoveredComponent(componentId) {
      if (state.hovered_component === componentId) return state;
      return this.setState({ hovered_component: componentId }, 'hover');
    },

    /* ── alerts ─────────────────────────────────────────────────────── */

    /**
     * Adds an alert. Newest first, capped, with identical consecutive alerts
     * collapsed into a repeat counter to avoid flooding the feed.
     */
    addAlert(alert) {
      if (!alert) return state;
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        at: alert.at || new Date().toISOString(),
        severity: alert.severity || 'info',
        title: alert.title || 'Notice',
        message: alert.message || '',
        component: alert.component || null,
        changes: alert.changes || [],
        repeat: 1,
        ...alert
      };

      const previous = state.alerts[0];
      if (
        previous &&
        previous.title === entry.title &&
        previous.message === entry.message &&
        previous.severity === entry.severity
      ) {
        entry.id = previous.id;
        entry.repeat = previous.repeat + 1;
        entry.at = previous.at;
        const alerts = [entry, ...state.alerts.slice(1)];
        return this.setState({ alerts }, 'alert');
      }

      const alerts = [entry, ...state.alerts].slice(0, ALERT_LIMIT);
      return this.setState({ alerts }, 'alert');
    },

    clearAlerts() {
      return this.setState({ alerts: [] }, 'alert');
    },

    dismissAlert(alertId) {
      return this.setState(
        { alerts: state.alerts.filter((alert) => alert.id !== alertId) },
        'alert'
      );
    },

    /* ── history (health trend chart) ───────────────────────────────── */

    pushHistoryPoint(point) {
      if (!point) return state;
      const history = [...state.history, point].slice(-HISTORY_LIMIT);
      return this.setState({ history }, 'history');
    },

    /* ── connection / status ────────────────────────────────────────── */

    setConnection(patch, reason = 'connection') {
      return this.setState({ connection: { ...state.connection, ...patch } }, reason);
    },

    setStatus(status, reason = 'status') {
      return this.setState({ status }, reason);
    },

    setDataSource(dataSource, reason = 'data-source') {
      return this.setState({ data_source: dataSource }, reason);
    },

    setModelSource(modelSource) {
      return this.setState({ model_source: modelSource }, 'model-source');
    },

    setCameraView(cameraView) {
      return this.setState({ camera_view: cameraView }, 'camera-view');
    },

    setPrediction(prediction, reason = 'prediction') {
      if (!prediction) return state;
      return this.setState({ prediction: { ...state.prediction, ...prediction } }, reason);
    },

    setRun(run, reason = 'run') {
      return this.setState({ run }, reason);
    },

    /** Records non-fatal validation problems (e.g. clamped slider input). */
    setIssues(issues) {
      return this.setState({ issues: issues || [] }, 'issues');
    }
  };
}

/* ────────────────────────────────────────────────────────────────────────── */

/** Shallow equality for the store's "did anything actually change" check. */
function shallowEqual(a, b) {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
