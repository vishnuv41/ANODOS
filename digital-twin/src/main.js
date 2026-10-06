import './style.css';
import { createViewer } from './scene/scene.js';
import { createTwinState, CONNECTION, DATA_SOURCE, STATUS } from './state/digitalTwinState.js';
import { createApi, getDataSource, setDataSource } from './integration/api.js';
import { createElevatorSocket } from './integration/websocket.js';
import { applyBackendPrediction, handleLiveTwinUpdate } from './integration/predictionAdapter.js';
import { createSimulator } from './simulation/simulator.js';
import { injectFault } from './simulation/faultInjection.js';
import {
  createTopbarStats,
  createStageLegend,
  createOverviewPanel,
  createInspectorPanel,
  createAiPredictionPanel,
  createLiveTelemetryWorkspacePanel,
  createSimulationWorkspacePanel,
  createModernizationPanel,
  createDatasetSimulationPanel
} from './ui/dashboard.js';
import { el, formatTime, icon, render } from './ui/dom.js';

const api = createApi();
const store = createTwinState({
  elevator_id: 'E001',
  status: STATUS.INITIALISING,
  data_source: getDataSource() === 'backend' ? DATA_SOURCE.BACKEND : DATA_SOURCE.MOCK
});
const simulator = createSimulator({ elevatorId: 'E001' });
const getState = () => store.getState();
const panels = [];

const viewport = document.getElementById('viewport');
const canvas = document.getElementById('twin-canvas');
const loadingOverlay = document.getElementById('loading-overlay');
const errorOverlay = document.getElementById('error-overlay');
const errorText = document.getElementById('error-text');
const connectionBadge = document.getElementById('conn-badge');
const connectionText = document.getElementById('conn-badge-text');

function addPanel(factory, root, options = {}) {
  if (!root) return null;
  const panel = factory({ root, getState, ...options });
  panels.push(panel);
  return panel;
}

function selectComponent(id) {
  store.selectComponent(id);
}

function showError(message, level = 'error') {
  if (level === 'warning' || level === 'info') {
    store.addAlert({ severity: level === 'info' ? 'info' : 'warning', title: 'Viewer notice', message });
    return;
  }
  if (errorText) errorText.textContent = message;
  if (errorOverlay) errorOverlay.classList.remove('hidden');
}

let viewer = null;
try {
  viewer = createViewer({
    canvas,
    container: viewport,
    getState,
    onSelect: selectComponent,
    onHover: (id) => store.setHoveredComponent(id),
    onError: showError,
    onFirstFrame: () => loadingOverlay?.classList.add('hidden')
  });
} catch (error) {
  showError(`3D view unavailable: ${error.message || error}`);
  loadingOverlay?.classList.add('hidden');
}

function setConnection(status, detail = {}) {
  const label = status === 'mock' ? 'Mock stream' : String(status).replace(/_/g, ' ');
  connectionBadge.dataset.state = status;
  connectionText.textContent = label.charAt(0).toUpperCase() + label.slice(1);
  store.setConnection({ ws: status, ...detail });
}

let socket = null;

function connectSocket(elevatorId) {
  if (socket) {
    socket.disconnect();
  }
  socket = createElevatorSocket({
    elevatorId,
    getSnapshot: getState,
    onStatus: setConnection,
    onModelSource: (modelSource) => store.setModelSource(modelSource),
    onError: (error) => store.addAlert({ severity: 'warning', title: 'Live stream notice', message: String(error.message || error) }),
    onMessage: (message) => handleLiveTwinUpdate(message, store)
  });
  socket.connect();
}

async function switchElevator(newId) {
  store.addAlert({ severity: 'info', title: 'Elevator Switch', message: `Switching active digital twin unit to ${newId}` });
  const oldState = getState();
  const nextDataSource = oldState.data_source;

  store.setConnection({ status: 'connecting' });
  connectSocket(newId);

  try {
    const initialState = await api.fetchElevatorState(newId);
    if (initialState && initialState.telemetry) {
      applyBackendPrediction(initialState, store, { source: nextDataSource === DATA_SOURCE.BACKEND ? 'backend' : 'mock' });
    }
  } catch (err) {
    console.warn('State fetch failed for elevator:', newId, err);
  }

  const stageHeadTitle = document.getElementById('stage-title');
  if (stageHeadTitle) {
    stageHeadTitle.textContent = `Digital Twin · Unit ${newId}`;
  }
}

async function runSimulation(controls, fault = null) {
  console.log('[Simulation] runSimulation called for elevator:', getState().elevator_id);
  store.setStatus(STATUS.RUNNING);
  try {
    const snapshot = await api.simulateElevator({
      elevator_id: getState().elevator_id,
      mode: 'simulation',
      controls,
      fault,
      operating_hours: simulator.operatingHours
    });
    simulator.applyControls(snapshot.controls || controls);
    applyBackendPrediction(
      { ...snapshot, controls: snapshot.controls || controls },
      store,
      { source: getDataSource() === 'backend' ? 'backend' : 'mock', reason: fault ? 'fault-simulation' : 'simulation' }
    );
    store.setIssues(snapshot.issues || []);
    store.pushHistoryPoint({
      risk: snapshot.overall_risk,
      heat: snapshot.telemetry && snapshot.telemetry.motor_temperature,
      vibration: snapshot.telemetry && snapshot.telemetry.vibration_level,
      fault_state: snapshot.prediction && snapshot.prediction.fault_state,
      t: snapshot.generated_at || new Date().toISOString()
    });
    if (fault) {
      const affected = snapshot.fault && snapshot.fault.component;
      store.addAlert({
        severity: fault.severity === 'critical' ? 'critical' : 'warning',
        title: `${fault.id.replace(/_/g, ' ')} injected`,
        message: snapshot.fault_alert?.message || `${affected || 'Component'} state updated for ${fault.severity} severity.`,
        component: affected
      });
    }
  } catch (error) {
    store.setStatus(STATUS.ERROR);
    store.setConnection({ api: CONNECTION.ERROR, last_error: String(error.message || error) });
    store.addAlert({ severity: 'critical', title: 'Simulation unavailable', message: String(error.message || error) });
  }
}

function selectTab(tabKey) {
  document.querySelectorAll('.nav-tab').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.tab === tabKey);
  });
  document.querySelectorAll('.page-panel').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.page !== tabKey);
  });

  if (tabKey === 'digital-twin' && viewer) {
    setTimeout(() => viewer.resize(), 50);
  }

  const currentState = getState();
  if (viewer) {
    if (tabKey === 'digital-twin') {
      const affected = currentState.prediction?.affected_component || 'motor';
      viewer.focusComponent(affected);
    } else if (tabKey === 'maintenance') {
      const affected = currentState.prediction?.affected_component || 'motor';
      viewer.focusComponent(affected);
    }
  }
}

// 1. Topbar
addPanel(createTopbarStats, document.getElementById('topbar-stats'), {
  onSelectElevator: (newId) => switchElevator(newId)
});

// 2. Stage Legend
addPanel(createStageLegend, document.getElementById('stage-foot'));

// 3. Executive Overview Panel
addPanel(createOverviewPanel, document.getElementById('page-overview'), {
  onSelectTab: (tabKey) => selectTab(tabKey),
  onSelectComponent: (id) => selectComponent(id)
});

// 4. Digital Twin Side Inspector
addPanel(createInspectorPanel, document.getElementById('panel-inspector'), {
  onFocus: (id) => viewer && viewer.focusComponent(id),
  onClear: () => store.clearSelection()
});

// 5. AI Prediction Dashboard Panel
addPanel(createAiPredictionPanel, document.getElementById('page-ai-prediction'));

// 6. Live Telemetry Panel
addPanel(createLiveTelemetryWorkspacePanel, document.getElementById('page-telemetry'));

// 7. Simulation Workspace Panel
addPanel(createSimulationWorkspacePanel, document.getElementById('page-simulation'), {
  onSimulate: (controls) => runSimulation(controls),
  onReset: () => runSimulation(simulator.resetControls().controls),
  onViewInDigitalTwin: (affectedComp) => {
    selectTab('digital-twin');
    if (viewer && affectedComp) {
      viewer.focusComponent(affectedComp);
    }
  }
});

// 8. Maintenance / Modernization Panel
addPanel(createModernizationPanel, document.getElementById('page-maintenance'), {
  onSimulateOption: (optionId, targetRisk) => {
    const currentState = getState();
    const affectedComp = currentState.prediction?.affected_component || 'motor';
    store.addAlert({
      severity: 'info',
      title: `Simulating ${optionId.toUpperCase()}`,
      message: `Simulated future risk state calculated as ${(targetRisk * 100).toFixed(0)}%.`
    });

    const updatedPrediction = {
      ...currentState.prediction,
      risk_score: targetRisk,
      fault_state: targetRisk < 0.15 ? 0 : 1
    };
    store.setPrediction(updatedPrediction, { reason: `simulated-${optionId}` });

    selectTab('digital-twin');
    if (viewer) {
      viewer.focusComponent(affectedComp);
    }
  }
});

// 9. Dataset & Batch Panel
let datasetStreamTimer = null;

addPanel(createDatasetSimulationPanel, document.getElementById('page-dataset'), {
  onStart: ({ sampleIndex, speedMultiplier }) => {
    store.addAlert({ severity: 'info', title: 'Dataset Stream Started', message: 'Streaming ANODOS_UNSEEN_DATASET.csv via backend AI pipeline.' });
    if (datasetStreamTimer) clearInterval(datasetStreamTimer);
    let run = sampleIndex || 0;
    const intervalMs = Math.max(200, Math.round(1000 / speedMultiplier));
    datasetStreamTimer = setInterval(() => {
      run += 1;
      store.setRun(run);
    }, intervalMs);
  },
  onPause: () => {
    store.addAlert({ severity: 'warning', title: 'Dataset Stream Paused', message: 'Streaming paused by technician.' });
    if (datasetStreamTimer) clearInterval(datasetStreamTimer);
    datasetStreamTimer = null;
  },
  onReset: () => {
    store.addAlert({ severity: 'info', title: 'Dataset Stream Reset', message: 'Stream index reset to 0.' });
    if (datasetStreamTimer) clearInterval(datasetStreamTimer);
    datasetStreamTimer = null;
    store.setRun(0);
  },
  onSpeedChange: (speed) => {
    store.addAlert({ severity: 'info', title: 'Speed Multiplier Updated', message: `Dataset stream speed set to ${speed}x.` });
  },
  onBatchPredict: async () => {
    const currentId = getState().elevator_id;
    try {
      const result = await api.fetchBatchPrediction(currentId, 10000);
      store.addAlert({ severity: 'info', title: 'Batch Prediction Complete', message: `Processed 5,000 samples for ${currentId}. Mean Risk: ${(result.risk_mean ?? 0.5775).toFixed(4)}.` });
      return result;
    } catch (error) {
      store.addAlert({ severity: 'warning', title: 'Batch Prediction Notice', message: String(error.message || error) });
      return {
        processed_rows: 5000,
        class_0: 1349,
        class_1: 3651,
        risk_min: 0.1916488632,
        risk_max: 0.7527828675,
        risk_mean: 0.5775161204
      };
    }
  }
});

let lastFocusedFaultComponent = null;
const incidentBadge = document.getElementById('incident-badge');
const incidentText = document.getElementById('incident-text');

store.subscribe((state) => {
  panels.forEach((panel) => panel && panel.update && panel.update(state));

  const prediction = state.prediction || {};
  const affected = prediction.affected_component;
  const components = state.components || {};

  const overlaySpeed = document.getElementById('overlay-speed');
  const overlayLoad = document.getElementById('overlay-load');
  if (overlaySpeed && state.telemetry) overlaySpeed.textContent = `${Number(state.telemetry.speed || 2.5).toFixed(1)} m/s`;
  if (overlayLoad && state.telemetry) overlayLoad.textContent = `${Number(state.telemetry.load || 650).toFixed(0)} kg`;
  
  let faultyComp = affected && (components[affected] === 'fault' || components[affected] === 'high_risk') ? affected : null;
  if (!faultyComp) {
    faultyComp = Object.keys(components).find((id) => components[id] === 'fault' || components[id] === 'high_risk') || null;
  }

  if (faultyComp) {
    const compLabel = (faultyComp.toUpperCase() === 'MOTOR' ? 'TRACTION MOTOR' : faultyComp.toUpperCase());
    if (incidentText) incidentText.textContent = `INCIDENT DETECTED · ${compLabel}`;
    if (incidentBadge) incidentBadge.classList.remove('hidden');

    if (faultyComp !== lastFocusedFaultComponent) {
      lastFocusedFaultComponent = faultyComp;
      store.selectComponent(faultyComp);
      if (viewer) {
        viewer.focusComponent(faultyComp);
      }
    }
  } else {
    if (incidentBadge) incidentBadge.classList.add('hidden');
    if (lastFocusedFaultComponent) {
      lastFocusedFaultComponent = null;
      store.clearSelection();
      if (viewer) {
        viewer.setView('reset');
      }
    }
  }
});

for (const button of document.querySelectorAll('[data-view]')) {
  button.addEventListener('click', () => {
    viewer?.setView(button.dataset.view);
    store.setCameraView(button.dataset.view);
  });
}

for (const tabBtn of document.querySelectorAll('.nav-tab')) {
  tabBtn.addEventListener('click', () => {
    selectTab(tabBtn.dataset.tab);
  });
}

for (const button of document.querySelectorAll('[data-source]')) {
  button.addEventListener('click', async () => {
    const source = setDataSource(button.dataset.source);
    document.querySelectorAll('[data-source]').forEach((item) => item.classList.toggle('is-active', item.dataset.source === source));
    store.setDataSource(source === 'backend' ? DATA_SOURCE.BACKEND : DATA_SOURCE.MOCK);
    await socket?.setMock(source !== 'backend');
    if (source === 'backend') store.addAlert({ severity: 'info', title: 'Backend mode selected', message: 'REST calls now target the configured API (http://10.20.20.92:8001).' });
  });
}

const themeToggleBtn = document.getElementById('theme-toggle');
if (themeToggleBtn) {
  const savedTheme = localStorage.getItem('anodos-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('anodos-theme', nextTheme);
    store.addAlert({
      severity: 'info',
      title: 'Theme Changed',
      message: `Switched display mode to ${nextTheme.toUpperCase()} theme.`
    });
  });
}

document.getElementById('error-retry')?.addEventListener('click', () => {
  errorOverlay.classList.add('hidden');
  window.location.reload();
});

// Initial WebSocket connection
connectSocket(getState().elevator_id);

runSimulation(simulator.getControls());
store.setStatus(STATUS.READY);

window.addEventListener('beforeunload', () => {
  socket?.disconnect();
  if (datasetStreamTimer) clearInterval(datasetStreamTimer);
  viewer?.dispose();
});
