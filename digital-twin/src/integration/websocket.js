/**
 * ANODOS Digital Twin — WebSocket integration.
 *
 * Target endpoint (implemented later by the backend):
 *
 *     /ws/elevator/{elevator_id}
 *
 * Responsibilities
 *   • connect / disconnect / reconnect with exponential backoff
 *   • application-level heartbeat (`{"type":"ping"}`)
 *   • normalise incoming frames into the same contract shape used by REST
 *   • provide a MOCK stream so the live view works before the backend exists
 *
 * Guarantees
 *   • never throws at the caller: connection problems arrive through `onStatus`
 *     and `onError`
 *   • a failed or unavailable socket never affects the 3D scene
 */

import { WS_CONFIG } from './config.js';

export const SOCKET_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  MOCK: 'mock',
  CLOSED: 'closed',
  ERROR: 'error'
};

/** Message kinds the client understands. Everything else is treated as data. */
export const MESSAGE_TYPE = {
  TELEMETRY: 'telemetry',
  SNAPSHOT: 'snapshot',
  PREDICTION: 'prediction',
  ALERT: 'alert',
  PING: 'ping',
  PONG: 'pong'
};

/**
 * A resilient elevator telemetry socket.
 *
 * @param {object} options
 * @param {string} options.elevatorId
 * @param {string} [options.url]              explicit ws:// URL (defaults to the proxied path)
 * @param {boolean} [options.mock]            use the local mock stream
 * @param {() => object} [options.getSnapshot] supplies mock frames from the app state
 * @param {(message:object, event:MessageEvent) => void} [options.onMessage]
 * @param {(status:string, detail:object) => void} [options.onStatus]
 * @param {(error:Error|string) => void} [options.onError]
 */
export class ElevatorSocket {
  constructor(options = {}) {
    this.elevatorId = options.elevatorId || 'E001';
    this.url = options.url || WS_CONFIG.absoluteUrl(this.elevatorId);
    this.useMock = options.mock !== undefined ? options.mock : WS_CONFIG.mockEnabled;
    this.getSnapshot = options.getSnapshot || (() => ({}));

    this.onMessage = options.onMessage || (() => {});
    this.onStatus = options.onStatus || (() => {});
    this.onError = options.onError || (() => {});

    this.socket = null;
    this.status = SOCKET_STATUS.IDLE;
    this.attempts = 0;
    this.manualClose = false;

    this._reconnectTimer = null;
    this._mockTimer = null;
    this._pingTimer = null;
    this._lastFrameAt = 0;
  }

  /* ── lifecycle ─────────────────────────────────────────────────────── */

  /** Opens the connection (or starts the mock stream). Idempotent. */
  connect() {
    if (this.status === SOCKET_STATUS.CONNECTED || this.status === SOCKET_STATUS.MOCK) return this;
    if (this.status === SOCKET_STATUS.CONNECTING) return this;

    this.manualClose = false;

    if (this.useMock) {
      this._startMock();
      return this;
    }

    this._open();
    return this;
  }

  /** Closes the connection and stops all timers. */
  disconnect() {
    this.manualClose = true;
    this._clearTimers();

    if (this.socket) {
      try {
        this.socket.onopen = null;
        this.socket.onmessage = null;
        this.socket.onerror = null;
        this.socket.onclose = null;
        if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
          this.socket.close(1000, 'client disconnect');
        }
      } catch (error) {
        /* already gone */
      }
      this.socket = null;
    }

    this._setStatus(SOCKET_STATUS.CLOSED, { reason: 'disconnected by client' });
    return this;
  }

  /** Switches between the mock stream and a real socket at runtime. */
  async setMock(enabled) {
    const next = Boolean(enabled);
    if (next === this.useMock) return this.useMock;
    this.disconnect();
    this.useMock = next;
    this.attempts = 0;
    this.manualClose = false;
    this.connect();
    return this.useMock;
  }

  /** Sends a frame when connected; silently ignored otherwise. */
  send(payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    try {
      this.socket.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
      return true;
    } catch (error) {
      this.onError(error);
      return false;
    }
  }

  /* ── real socket ───────────────────────────────────────────────────── */

  _open() {
    this._setStatus(this.attempts > 0 ? SOCKET_STATUS.RECONNECTING : SOCKET_STATUS.CONNECTING, {
      attempt: this.attempts,
      url: this.url
    });

    let socket;
    try {
      socket = new WebSocket(this.url);
    } catch (error) {
      // Bad URL / blocked by the browser: fall back to the mock stream so the
      // dashboard keeps updating instead of going silent.
      this.onError(error);
      this._setStatus(SOCKET_STATUS.ERROR, { reason: 'could not construct WebSocket' });
      this._fallbackToMock();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.attempts = 0;
      this._setStatus(SOCKET_STATUS.CONNECTED, { url: this.url });
      this._startHeartbeat();
      // Ask for an initial snapshot — the backend may or may not implement it.
      this.send({ type: 'subscribe', elevator_id: this.elevatorId });
    };

    socket.onmessage = (event) => {
      this._lastFrameAt = performance.now();
      const message = this._parse(event.data);
      if (!message) return;
      if (message.type === MESSAGE_TYPE.PONG) return;
      if (message.type === MESSAGE_TYPE.PING) {
        this.send({ type: MESSAGE_TYPE.PONG, at: new Date().toISOString() });
        return;
      }
      this.onMessage(message, event);
    };

    socket.onerror = () => {
      // The browser intentionally hides details here; onclose carries the story.
      this.onError(`WebSocket error on ${this.url}`);
    };

    socket.onclose = (event) => {
      this._stopHeartbeat();
      this.socket = null;
      if (this.manualClose) {
        this._setStatus(SOCKET_STATUS.CLOSED, { code: event.code });
        return;
      }
      this._scheduleReconnect(event);
    };
  }

  _scheduleReconnect(event) {
    const { reconnectDelaysMs, maxReconnectAttempts } = WS_CONFIG;
    const exhausted = maxReconnectAttempts > 0 && this.attempts >= maxReconnectAttempts;

    if (exhausted) {
      this._setStatus(SOCKET_STATUS.ERROR, {
        reason: `giving up after ${this.attempts} attempts`,
        code: event ? event.code : 0
      });
      if (WS_CONFIG.mockEnabled) this._fallbackToMock();
      return;
    }

    const wait = reconnectDelaysMs[Math.min(this.attempts, reconnectDelaysMs.length - 1)];
    this.attempts += 1;
    this._setStatus(SOCKET_STATUS.RECONNECTING, { attempt: this.attempts, retryInMs: wait });

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._open();
    }, wait);
  }

  /**
   * Keeps the dashboard alive when the backend socket is unavailable: switches
   * to the local mock stream and reports it clearly.
   */
  _fallbackToMock() {
    if (!WS_CONFIG.mockEnabled || !this.useMock) return;
    this.useMock = true;
    this._startMock({ fallback: true });
  }

  /* ── heartbeat ─────────────────────────────────────────────────────── */

  _startHeartbeat() {
    this._stopHeartbeat();
    this._pingTimer = setInterval(() => {
      this.send({ type: MESSAGE_TYPE.PING, at: new Date().toISOString() });
    }, WS_CONFIG.pingIntervalMs);
  }

  _stopHeartbeat() {
    if (this._pingTimer) clearInterval(this._pingTimer);
    this._pingTimer = null;
  }

  /* ── mock stream ───────────────────────────────────────────────────── */

  /**
   * Emits telemetry frames derived from the live application state, shaped
   * exactly like the frames the backend will send. This is what makes the "live"
   * view demonstrable before the backend exists.
   */
  _startMock(detail = {}) {
    this._stopMock();
    this._setStatus(SOCKET_STATUS.MOCK, {
      intervalMs: WS_CONFIG.mockIntervalMs,
      ...detail
    });

    const emit = () => {
      let frame;
      try {
        frame = this.getSnapshot() || {};
      } catch (error) {
        this.onError(error);
        return;
      }

      const message = {
        type: MESSAGE_TYPE.TELEMETRY,
        elevator_id: this.elevatorId,
        mode: 'live',
        source: 'mock-stream',
        at: new Date().toISOString(),
        telemetry: frame.telemetry || {},
        components: frame.components || {},
        prediction: frame.prediction || {},
        drift: true
      };

      this._lastFrameAt = performance.now();
      this.onMessage(message, null);
    };

    emit();
    this._mockTimer = setInterval(emit, WS_CONFIG.mockIntervalMs);
  }

  _stopMock() {
    if (this._mockTimer) clearInterval(this._mockTimer);
    this._mockTimer = null;
  }

  _clearTimers() {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    this._stopHeartbeat();
    this._stopMock();
  }

  /* ── helpers ───────────────────────────────────────────────────────── */

  /** Parses a frame, tolerating plain text and malformed JSON. */
  _parse(raw) {
    if (typeof raw !== 'string') return null;
    const text = raw.trim();
    if (!text) return null;
    if (text[0] !== '{' && text[0] !== '[') {
      // Plain-text frames are wrapped so downstream code sees one shape.
      return { type: MESSAGE_TYPE.TELEMETRY, message: text };
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      this.onError(`Could not parse WebSocket frame: ${text.slice(0, 60)}…`);
      return null;
    }
  }

  _setStatus(status, detail = {}) {
    this.status = status;
    this.onStatus(status, detail);
  }

  /** Milliseconds since the last frame (or null when nothing arrived yet). */
  get staleness() {
    return this._lastFrameAt ? performance.now() - this._lastFrameAt : null;
  }
}

/** Convenience factory used by main.js. */
export function createElevatorSocket(options) {
  return new ElevatorSocket(options);
}

/** Human-readable label for a socket status (used by the connection badge). */
export const SOCKET_STATUS_LABELS = {
  [SOCKET_STATUS.IDLE]: 'Idle',
  [SOCKET_STATUS.CONNECTING]: 'Connecting…',
  [SOCKET_STATUS.CONNECTED]: 'Live',
  [SOCKET_STATUS.RECONNECTING]: 'Reconnecting…',
  [SOCKET_STATUS.MOCK]: 'Live (mock)',
  [SOCKET_STATUS.CLOSED]: 'Closed',
  [SOCKET_STATUS.ERROR]: 'Offline'
};
