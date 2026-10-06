# ANODOS Frontend/Backend Integration Contract

This document describes the integration contract currently implemented by the ANODOS frontend. It is based on `src/integration/config.js`, `src/integration/api.js`, `src/integration/websocket.js`, `src/integration/predictionAdapter.js`, and `src/scene/components.js`.

The frontend consumes backend predictions and telemetry. It does not run CatBoost.

## 1. REST Base URL

The frontend uses:

```text
/api
```

In Vite development, `/api` is proxied to the configured backend at `http://127.0.0.1:8000`. The frontend uses relative URLs so deployment behind a reverse proxy does not require application-code changes.

The default elevator ID is `E001`.

## 2. REST Endpoints

The endpoint paths currently defined by the frontend are:

| Purpose | Method | Path |
|---|---:|---|
| Backend health | `GET` | `/api/health` |
| Last known elevator state | `GET` | `/api/elevator/{elevator_id}/state` |
| Simulation / full twin snapshot | `POST` | `/api/elevator/{elevator_id}/simulate` |
| Prediction only | `POST` | `/api/elevator/{elevator_id}/predict` |
| Explanation endpoint | No frontend request currently implemented | `/api/elevator/{elevator_id}/explain` |
| History endpoint | No frontend request currently implemented | `/api/elevator/{elevator_id}/history` |

`{elevator_id}` is URL-encoded by the frontend.

### Health request

`GET /api/health` has no request body. The frontend accepts any JSON object and reads `status` when present. The result is normalized locally to include:

```json
{
  "ok": true,
  "status": "ok",
  "latency_ms": 12,
  "payload": {}
}
```

On failure, the frontend returns a local diagnostic result such as:

```json
{
  "ok": false,
  "status": "unreachable",
  "latency_ms": 12,
  "error": "...",
  "kind": "network"
}
```

## 3. Simulation Request JSON

The frontend sends this JSON body to `POST /api/elevator/{elevator_id}/simulate`:

```json
{
  "elevator_id": "E001",
  "mode": "simulation",
  "controls": {},
  "operating_hours": 8421,
  "fault": null,
  "telemetry_overrides": null,
  "component_overrides": null
}
```

The fields are:

- `elevator_id`: string. Defaults to `E001`.
- `mode`: string. The simulation caller uses `simulation`; the frontend also supports values such as `live` and `diagnostic` in other flows.
- `controls`: object containing the current simulation control values. The current control keys are:
  - `load`
  - `speed`
  - `vibration`
  - `motor_current`
  - `motor_temperature`
  - `door_cycles`
  - `brake_force`
  - `rope_tension`
  - `ambient_temperature`
- `operating_hours`: number, when available.
- `fault`: either `null` or an object with `id` and `severity`, for example `{ "id": "brake_wear", "severity": "critical" }`.
- `telemetry_overrides`: object or `null`. Used by the current mock/simulation path; real backend support is optional unless Person 3 implements it.
- `component_overrides`: object or `null`. Used by the current mock/simulation path; real backend support is optional unless Person 3 implements it.

The frontend sends JSON with `Content-Type: application/json`.

### Prediction request

`POST /api/elevator/{elevator_id}/predict` is exposed by the frontend client and sends the caller-provided payload as JSON. The frontend does not impose a second ML request schema. Person 3 should define the accepted prediction-only input while returning the response shape below.

## 4. Response JSON Consumed by the Frontend

The full snapshot shape is:

```json
{
  "elevator_id": "E001",
  "mode": "model",
  "telemetry": {},
  "prediction": {
    "risk_score": 0.82,
    "fault_state": "fault",
    "fault_category": "Motor Malfunction",
    "fault_severity": "Moderate",
    "affected_component": "motor"
  },
  "components": {
    "motor": "high_risk",
    "bearing": "normal",
    "brake": "normal",
    "door": "warning",
    "controller": "normal"
  },
  "explanations": []
}
```

The frontend also preserves and can consume these optional snapshot fields when supplied:

```json
{
  "source": "backend",
  "simulated": false,
  "overall_risk": 0.82,
  "health_state": "fault",
  "component_scores": {},
  "component_breakdown": {},
  "component_reasons": {},
  "controls": {},
  "issues": [],
  "annotations": []
}
```

The adapter behavior is important:

- `prediction.risk_score` is normalized to the range `0..1` when present.
- `overall_risk` is used as a fallback when `prediction.risk_score` is absent.
- `components` values are accepted only for known component IDs and known health states.
- `telemetry`, `components`, `component_scores`, and `explanations` may be omitted from a partial update. Omitted fields are not replaced by fabricated values.
- `prediction.affected_component` is accepted only when it is a known component ID.
- If an affected component and risk score are supplied but that component has no `component_scores` entry, the adapter associates the supplied risk score with that component. It does not calculate a new model result.
- `source: "backend"` marks a real backend update. Mock/local sources are marked as simulated by the frontend.

## 5. WebSocket Endpoint

The configured endpoint is:

```text
/ws/elevator/{elevator_id}
```

In development, the WebSocket path is proxied by Vite. The browser URL is constructed as:

- `ws://<host>/ws/elevator/E001` for HTTP pages
- `wss://<host>/ws/elevator/E001` for HTTPS pages

On connection, the frontend sends:

```json
{
  "type": "subscribe",
  "elevator_id": "E001"
}
```

The frontend also sends heartbeat frames:

```json
{
  "type": "ping",
  "at": "2026-09-20T12:00:00.000Z"
}
```

When it receives a ping, it responds with:

```json
{
  "type": "pong",
  "at": "2026-09-20T12:00:00.000Z"
}
```

Pong frames are consumed by the socket layer and are not passed to the prediction adapter.

## 6. WebSocket Message Structure

The socket layer recognizes these message types:

```text
telemetry
snapshot
prediction
alert
ping
pong
```

For application data, the frontend accepts a message shaped like a backend snapshot or partial snapshot. A typical message is:

```json
{
  "type": "snapshot",
  "elevator_id": "E001",
  "mode": "live",
  "telemetry": {
    "speed": 2.5,
    "vibration": 1.8
  },
  "prediction": {
    "risk_score": 0.18,
    "fault_state": "normal",
    "fault_category": null,
    "fault_severity": null,
    "affected_component": null
  },
  "components": {
    "motor": "normal",
    "bearing": "normal"
  },
  "explanations": []
}
```

`type` is transport metadata. The frontend passes the message data through the same backend prediction adapter used for REST responses. WebSocket telemetry-only or partial messages are supported; missing fields remain unchanged in central application state.

The current local mock stream emits:

```json
{
  "type": "telemetry",
  "elevator_id": "E001",
  "mode": "live",
  "source": "mock-stream",
  "at": "2026-09-20T12:00:00.000Z",
  "telemetry": {},
  "components": {},
  "prediction": {},
  "drift": true
}
```

## 7. Component IDs

These IDs are stable across the backend contract, central state, procedural Three.js model, selection system, and UI:

```text
motor
bearing
brake
door
controller
pulley
rope
counterweight
guide_rail
cabin
shaft
```

The frontend also maintains component display metadata and telemetry mappings in `src/scene/components.js`. The 3D scene tags selectable objects with `userData.componentId`.

## 8. Component Health States

The accepted component health states are:

```text
normal
warning
high_risk
fault
```

These states drive the existing 3D material visualization and are consumed from the `components` object:

```json
{
  "components": {
    "motor": "normal",
    "bearing": "warning",
    "brake": "high_risk",
    "door": "fault"
  }
}
```

The frontend does not require every component to be present in every partial update.

## 9. Prediction Fields

Prediction fields are under `prediction`:

| Field | Type | Meaning |
|---|---|---|
| `risk_score` | number `0..1` | Overall prediction risk score |
| `fault_state` | string | Overall prediction state, normally one of the health-state values |
| `fault_category` | string or `null` | Backend-provided fault category |
| `fault_severity` | string or `null` | Backend-provided fault severity |
| `affected_component` | string or `null` | One of the stable component IDs |

The frontend also consumes top-level `overall_risk` as a compatibility/fallback field and may display `explanations` associated with the prediction.

The frontend does not infer `fault_category`, `fault_severity`, or `affected_component` from telemetry.

## 10. Telemetry Fields

The current telemetry catalogue defines these keys:

| Key | Label | Unit |
|---|---|---|
| `load` | Load | `kg` |
| `speed` | Speed | `m/s` |
| `vibration` | Vibration | `mm/s` |
| `motor_current` | Motor Current | `A` |
| `motor_temperature` | Motor Temperature | `°C` |
| `door_cycles` | Door Cycles | `cyc/h` |
| `brake_force` | Brake Force | `%` |
| `rope_tension` | Rope Tension | `x` |
| `ambient_temperature` | Ambient Temperature | `°C` |
| `bearing_temperature` | Bearing Temperature | `°C` |
| `pulley_rpm` | Sheave Speed | `rpm` |
| `sheave_wear` | Sheave Wear | `%` |
| `door_alignment` | Door Alignment | `mm` |
| `rail_friction` | Guide Rail Friction | `N` |
| `control_latency` | Control Latency | `ms` |
| `counterweight_offset` | Counterweight Offset | `mm` |
| `rope_stretch` | Rope Stretch | `%` |
| `cabin_ride_quality` | Ride Quality | `ISO` |
| `motor_load_factor` | Motor Load | `%` |
| `operating_hours` | Operating Hours | `h` |

Telemetry is supplied under the top-level `telemetry` object. The frontend displays only values that are actually present in the current state.

## 11. Mock Mode and Backend Mode

### Mock mode

Mock mode is enabled by default in `src/integration/config.js`:

```js
API_CONFIG.useMock = true
```

In mock mode:

- REST calls are answered locally by `mockSimulateElevator()`.
- The mock uses the existing in-browser simulation/scoring path.
- The WebSocket client can emit a clearly marked local mock stream.
- UI source labels identify mock/test data.
- Mock predictions must not be presented as real model predictions.

The integration fixture in `src/integration/predictionAdapter.js` is explicitly labeled `MOCK_PREDICTION_RESPONSE` and `source: "mock-integration-fixture"`.

### Backend mode

Backend mode is selected by setting the data source to `backend` or configuring:

```js
API_CONFIG.useMock = false
```

In backend mode:

- `POST /api/elevator/{elevator_id}/simulate` makes the real REST request.
- `GET /api/elevator/{elevator_id}/state` and `POST /api/elevator/{elevator_id}/predict` make real requests when called.
- WebSocket messages are accepted from `/ws/elevator/{elevator_id}`.
- REST and WebSocket data use the same response adapter and central state-update path.

## 12. Person 3: Connecting CatBoost Inference

Person 3 should expose the FastAPI service at the paths already defined above and return the documented response shape. The backend should:

1. Accept the simulation/prediction request fields required by the selected endpoint.
2. Run the real CatBoost inference on the backend only.
3. Return the model-produced `prediction` object, including `risk_score`, `fault_state`, `fault_category`, `fault_severity`, and `affected_component` when available.
4. Return component health states under `components` using the stable IDs and accepted health-state strings.
5. Return real telemetry under `telemetry` when the endpoint has telemetry available.
6. Return `explanations` as an array when explanations are available.
7. Preserve `elevator_id` and provide `mode`/`source` consistently.
8. Send equivalent snapshot or partial snapshot objects over WebSocket.
9. Avoid changing endpoint names or component IDs unless the frontend contract is deliberately updated as a coordinated change.

The frontend does not run CatBoost, load a CatBoost model, train a model, or reproduce backend inference. It only normalizes, stores, displays, and maps backend results to the existing UI and 3D twin.

Mock predictions are test data and must never be presented as real AI/model predictions.

## Person 3 Integration Checklist

- [ ] Serve REST under `/api` or preserve the existing Vite/reverse-proxy mapping.
- [ ] Implement `GET /health`.
- [ ] Implement `GET /elevator/{elevator_id}/state`.
- [ ] Implement `POST /elevator/{elevator_id}/simulate`.
- [ ] Implement `POST /elevator/{elevator_id}/predict`.
- [ ] Serve WebSocket updates at `/ws/elevator/{elevator_id}`.
- [ ] Accept the frontend subscribe frame and respond to ping/pong heartbeat frames.
- [ ] Use all stable component IDs, including `shaft`.
- [ ] Use only `normal`, `warning`, `high_risk`, and `fault` for component states.
- [ ] Return backend prediction fields under `prediction`.
- [ ] Return telemetry under `telemetry` without fabricating unavailable measurements.
- [ ] Mark real responses as backend/model data and keep mock data clearly separate.
- [ ] Verify a REST response and a WebSocket update both pass through the same frontend adapter.
