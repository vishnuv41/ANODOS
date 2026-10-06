/**
 * ANODOS Digital Twin — Dashboard Section Panels (KONE / Industrial AI Design Language).
 *
 * Section Panel Factories:
 *   createTopbarStats()                 Header unit switcher & live status summary
 *   createStageLegend()                 3D viewer color legend & data source info
 *   createOverviewPanel()               1st Tab: Executive summary KPI grid + subsystem health + AI overview + incidents
 *   createInspectorPanel()              Component inspection panel (3D Digital Twin tab side panel)
 *   createAiPredictionPanel()           3rd Tab: CatBoost ML Model diagnosis dashboard (Risk Dial, Confidence 89%, Horizon 24h, Model Specs)
 *   createLiveTelemetryWorkspacePanel() 4th Tab: Full Sensor Grid + Live Telemetry Stream Table
 *   createSimulationWorkspacePanel()    5th Tab: Preset scenarios + Sliders + Run Simulation + Results + View in Digital Twin button
 *   createModernizationPanel()          6th Tab: Technician recommendation + 3 options + priority/model impact + parts & matrix
 *   createDatasetSimulationPanel()      7th Tab: Stream controls + Batch Inference execution card
 */

import {
  COMPONENTS,
  COMPONENT_MAP,
  CONTROL_FIELDS,
  HEALTH,
  HEALTH_LABELS,
  RECOMMENDATIONS,
  TELEMETRY_FIELDS,
  TELEMETRY_ORDER,
  formatTelemetryValue,
  formatTelemetryParts,
  scoreToHealth
} from '../scene/components.js';
import {
  FAULT_CATALOGUE,
  FAULT_SEVERITIES,
  SEVERITY_LABELS
} from '../simulation/faultInjection.js';
import { DEFAULT_CONTROLS } from '../simulation/simulator.js';
import { el, render, icon, cx, healthClass, formatPercent, formatNumber } from './dom.js';

/* ────────────────────────────────────────────────────────────────────────────
 * TOP BAR STATS
 * ──────────────────────────────────────────────────────────────────────────── */

export function createTopbarStats({ root, getState, onSelectElevator }) {
  const elevatorSelect = el('select', {
    class: 'elevator-select-dropdown',
    children: [
      el('option', { value: 'E001', text: 'E001 (Main Passenger Car)' }),
      el('option', { value: 'E002', text: 'E002 (Express Shuttle)' }),
      el('option', { value: 'E003', text: 'E003 (Service Elevator)' })
    ],
    on: {
      change: (e) => {
        if (onSelectElevator) onSelectElevator(e.target.value);
      }
    }
  });

  const mode = el('span', { class: 'stat-value', text: '—' });
  const health = el('span', { class: 'stat-value', text: '—' });
  const risk = el('span', { class: 'stat-value', text: '—' });
  const fault = el('span', { class: 'stat-value', text: '—' });
  const healthWrap = el('div', { class: 'stat', children: [el('span', { class: 'stat-label', text: 'Overall Health' }), health] });
  const riskBar = el('i', { class: 'stat-risk-fill' });

  const shell = el('div', {
    class: 'stat-strip',
    children: [
      el('div', { class: 'stat', children: [el('span', { class: 'stat-label', text: 'Elevator Unit' }), elevatorSelect] }),
      el('div', { class: 'stat', children: [el('span', { class: 'stat-label', text: 'Backend Mode' }), mode] }),
      healthWrap,
      el('div', {
        class: 'stat stat-risk',
        children: [
          el('span', { class: 'stat-label', text: 'Risk Score' }),
          el('div', { class: 'stat-risk', children: [risk, el('span', { class: 'stat-risk-bar', children: [riskBar] })] })
        ]
      }),
      el('div', { class: 'stat stat-fault', children: [el('span', { class: 'stat-label', text: 'Current Fault' }), fault] })
    ]
  });

  render(root, shell);

  function update() {
    const state = getState() || {};
    const prediction = state.prediction || {};
    const components = state.components || {};
    const healthState = prediction.fault_state || state.health_state || HEALTH.NORMAL;
    const riskValue = Number.isFinite(Number(prediction.risk_score))
      ? Number(prediction.risk_score)
      : Number(state.overall_risk) || 0;

    elevatorSelect.value = state.elevator_id || 'E001';
    mode.textContent = state.data_source === 'mock' ? 'MOCK MODE' : 'LIVE BACKEND';

    health.textContent = HEALTH_LABELS[healthState] || String(healthState).toUpperCase();
    healthWrap.className = cx('stat', healthClass(healthState));

    risk.textContent = formatPercent(riskValue, 0);
    riskBar.style.width = `${Math.min(100, riskValue * 100).toFixed(1)}%`;
    riskBar.style.background = `var(--state-${healthState}-color, var(--accent))`;

    const affectedId = prediction.affected_component;
    const isElevated = healthState !== HEALTH.NORMAL && riskValue >= 0.3;

    if (isElevated && affectedId && COMPONENT_MAP[affectedId]) {
      fault.textContent = `${COMPONENT_MAP[affectedId].label} · ${String(prediction.fault_category || 'Anomaly').replace(/_/g, ' ')}`;
      fault.classList.add('is-active');
    } else if (isElevated) {
      const degraded = Object.entries(components).filter(([, value]) => value && value !== HEALTH.NORMAL);
      fault.textContent = degraded.length
        ? `${degraded.length} component${degraded.length > 1 ? 's' : ''} degraded`
        : 'None detected';
      fault.classList.toggle('is-active', degraded.length > 0);
    } else {
      fault.textContent = 'None detected';
      fault.classList.remove('is-active');
    }
  }

  return { update, element: shell };
}

/* ────────────────────────────────────────────────────────────────────────────
 * STAGE LEGEND
 * ──────────────────────────────────────────────────────────────────────────── */

const LEGEND_ITEMS = [
  { state: HEALTH.NORMAL, label: 'Normal' },
  { state: HEALTH.WARNING, label: 'Warning' },
  { state: HEALTH.HIGH_RISK, label: 'High risk' },
  { state: HEALTH.FAULT, label: 'Fault' }
];

export function createStageLegend({ root, getState }) {
  const badges = el('div', { class: 'legend-badges' });
  const componentCount = el('span', { class: 'legend-meta', text: '' });
  const dataSource = el('span', { class: 'legend-meta', text: '' });

  const strip = el('div', {
    class: 'legend-strip',
    children: [
      badges,
      el('div', { class: 'legend-meta-wrap', children: [componentCount, dataSource] })
    ]
  });

  render(root, strip);

  for (const item of LEGEND_ITEMS) {
    badges.appendChild(
      el('span', {
        class: cx('legend-chip', healthClass(item.state)),
        children: [el('i', { class: 'legend-dot' }), el('span', { text: item.label })]
      })
    );
  }

  function update() {
    const state = getState() || {};
    const components = state.components || {};
    componentCount.textContent = `${Object.keys(components).length} physical components tracked`;
    dataSource.textContent = state.data_source === 'mock'
      ? 'MOCK MODE · local model'
      : 'LIVE BACKEND · http://10.20.20.92:8001';
  }

  update();
  return { update, element: strip };
}

/* ────────────────────────────────────────────────────────────────────────────
 * 1. OVERVIEW SECTION PANEL
 * ──────────────────────────────────────────────────────────────────────────── */

export function createOverviewPanel({ root, getState, onSelectTab, onSelectComponent }) {
  const shell = el('div', { class: 'overview-container' });

  render(root, shell);

  function update() {
    const state = getState() || {};
    const prediction = state.prediction || {};
    const components = state.components || {};
    const risk = Number(prediction.risk_score) || Number(state.overall_risk) || 0.15;
    const healthState = prediction.fault_state || state.health_state || HEALTH.NORMAL;

    const affected = prediction.affected_component || 'motor';
    const affectedLabel = COMPONENT_MAP[affected] ? COMPONENT_MAP[affected].label : affected.toUpperCase();

    // System KPI Cards
    const kpiCards = el('div', {
      class: 'kpi-grid',
      children: [
        el('div', { class: cx('kpi-card', healthClass(healthState)), children: [el('span', { class: 'kpi-label', text: 'SYSTEM HEALTH' }), el('strong', { class: 'kpi-value', text: HEALTH_LABELS[healthState] || 'NORMAL' }), el('span', { class: 'kpi-sub', text: 'Traction Elevator E001' })] }),
        el('div', { class: 'kpi-card', children: [el('span', { class: 'kpi-label', text: 'AI RISK SCORE' }), el('strong', { class: 'kpi-value', text: `${Math.round(risk * 100)}%` }), el('span', { class: 'kpi-sub', text: risk >= 0.5 ? 'Requires Attention' : 'Nominal Band' })] }),
        el('div', { class: 'kpi-card', children: [el('span', { class: 'kpi-label', text: 'REMAINING USEFUL LIFE' }), el('strong', { class: 'kpi-value', text: '1,020 hrs' }), el('span', { class: 'kpi-sub', text: '92% Subsystem Health' })] }),
        el('div', { class: 'kpi-card', children: [el('span', { class: 'kpi-label', text: 'OPERATIONAL STATE' }), el('strong', { class: 'kpi-value', text: risk >= 0.75 ? 'FAULT DETECTED' : 'OPERATIONAL' }), el('span', { class: 'kpi-sub', text: 'Building A · Floor 07' })] })
      ]
    });

    // Subsystem Component Status Table (Sorted Highest Risk First)
    const componentScores = state.component_scores || {};
    const items = COMPONENTS.map((comp) => {
      const compState = components[comp.id] || HEALTH.NORMAL;
      const score = Number.isFinite(Number(componentScores[comp.id])) ? Number(componentScores[comp.id]) : (compState === HEALTH.FAULT ? 0.98 : (compState === HEALTH.HIGH_RISK ? 0.75 : (compState === HEALTH.WARNING ? 0.35 : 0.05)));
      return { comp, compState, score };
    });
    items.sort((a, b) => b.score - a.score);

    const componentRows = items.map(({ comp, compState, score }) => {
      return el('tr', {
        class: 'overview-comp-row',
        on: { click: () => { if (onSelectComponent) onSelectComponent(comp.id); if (onSelectTab) onSelectTab('digital-twin'); } },
        children: [
          el('td', { class: 'comp-name', children: [el('i', { class: cx('legend-dot', healthClass(compState)) }), el('span', { text: comp.label })] }),
          el('td', { class: 'comp-status', children: [el('span', { class: cx('badge', healthClass(compState)), text: HEALTH_LABELS[compState] })] }),
          el('td', { class: 'comp-risk-cell', children: [
            el('div', { class: 'stat-risk-bar', children: [el('i', { class: 'stat-risk-fill', style: { width: `${Math.round(score * 100)}%`, background: `var(--state-${compState}-color, var(--neon-cyan))` } })] }),
            el('span', { class: 'comp-risk-num', text: `${Math.round(score * 100)}%` })
          ] })
        ]
      });
    });

    const componentTable = el('div', {
      class: 'overview-card',
      children: [
        el('div', { class: 'card-head', children: [icon('layers', { size: 14 }), el('h3', { text: 'Subsystem Component Status' }), el('span', { class: 'tag tag-muted', text: 'Sorted by stress' })] }),
        el('table', { class: 'overview-table', children: [el('thead', { children: [el('tr', { children: [el('th', { text: 'Subsystem Component' }), el('th', { text: 'Status' }), el('th', { text: 'Stress Level' })] })] }), el('tbody', { children: componentRows })] })
      ]
    });

    // AI Prediction Overview Card
    const aiSummaryCard = el('div', {
      class: 'overview-card',
      children: [
        el('div', { class: 'card-head', children: [icon('chip', { size: 14 }), el('h3', { text: 'AI Prediction Summary' }), el('span', { class: 'tag tag-accent', text: 'CatBoost ML' })] }),
        el('dl', {
          class: 'kv-grid',
          children: [
            el('dt', { text: 'Risk Score' }), el('dd', { text: `${(risk * 100).toFixed(1)}%` }),
            el('dt', { text: 'Model Confidence' }), el('dd', { text: '89%' }),
            el('dt', { text: 'Prediction Horizon' }), el('dd', { text: '24 Hours' }),
            el('dt', { text: 'Primary Affected' }), el('dd', { text: affectedLabel }),
            el('dt', { text: 'Fault Classification' }), el('dd', { text: prediction.fault_category || 'Operational Degradation' })
          ]
        }),
        el('button', {
          class: 'btn btn-primary btn-small',
          style: { marginTop: '14px', width: '100%' },
          attrs: { type: 'button' },
          on: { click: () => onSelectTab && onSelectTab('ai-prediction') },
          children: [icon('search', { size: 12 }), el('span', { text: 'OPEN DETAILED AI DIAGNOSIS' })]
        })
      ]
    });

    const bodyGrid = el('div', {
      class: 'overview-grid',
      children: [
        el('div', { class: 'grid-col', children: [componentTable] }),
        el('div', { class: 'grid-col', children: [aiSummaryCard] })
      ]
    });

    render(shell, [kpiCards, bodyGrid]);
  }

  update();
  return { update, element: shell };
}

/* ────────────────────────────────────────────────────────────────────────────
 * INSPECTOR PANEL (DIGITAL TWIN SIDEBAR)
 * ──────────────────────────────────────────────────────────────────────────── */

export function createInspectorPanel({ root, getState, onFocus, onClear }) {
  const title = el('h3', { text: 'Component Details' });
  const badge = el('span', { class: 'badge state-normal', text: 'NORMAL' });
  const subtitle = el('p', { class: 'panel-subtitle', text: 'Click a component in the 3D view to inspect' });

  const scoreText = el('strong', { text: '—' });
  const scoreBar = el('i', { class: 'stat-risk-fill' });

  const telemetryGrid = el('dl', { class: 'kv-grid' });
  const recommendation = el('p', { class: 'recommendation-text', text: 'Select a component to view recommendations.' });

  const focusBtn = el('button', {
    class: 'btn btn-small btn-ghost',
    attrs: { type: 'button' },
    children: [icon('search', { size: 12 }), el('span', { text: 'Focus camera' })]
  });

  const clearBtn = el('button', {
    class: 'btn btn-small btn-ghost',
    attrs: { type: 'button' },
    children: [icon('close', { size: 12 }), el('span', { text: 'Deselect' })]
  });

  const shell = el('section', {
    class: 'inspector-panel-container',
    children: [
      el('div', { class: 'panel-head-row', children: [title, badge] }),
      subtitle,
      el('div', { class: 'panel-actions-row', children: [focusBtn, clearBtn] }),
      el('div', {
        class: 'score-card',
        children: [
          el('span', { class: 'score-label', text: 'Component Stress Level' }),
          el('div', { class: 'score-val-wrap', children: [scoreText, el('span', { class: 'stat-risk-bar', children: [scoreBar] })] })
        ]
      }),
      el('div', { class: 'sub-heading', text: 'Telemetry Sensors' }),
      telemetryGrid,
      el('div', { class: 'sub-heading', text: 'Maintenance Guidance' }),
      recommendation
    ]
  });

  let currentId = null;

  focusBtn.addEventListener('click', () => {
    if (currentId && onFocus) onFocus(currentId);
  });
  clearBtn.addEventListener('click', () => {
    if (onClear) onClear();
  });

  render(root, shell);

  function update() {
    const state = getState() || {};
    const selectedId = state.selected_component;
    const components = state.components || {};
    const telemetry = state.telemetry || {};
    const componentScores = state.component_scores || {};

    if (!selectedId || !COMPONENT_MAP[selectedId]) {
      currentId = null;
      title.textContent = 'Component Inspector';
      badge.textContent = 'NO SELECTION';
      badge.className = 'badge state-normal';
      subtitle.textContent = 'Click any component in the 3D elevator model to inspect telemetry and physics state.';
      scoreText.textContent = '0%';
      scoreBar.style.width = '0%';
      render(telemetryGrid, [el('dt', { text: 'Status' }), el('dd', { text: 'No component selected' })]);
      recommendation.textContent = 'Select any component from the 3D model to inspect real-time sensor metrics and maintenance guidance.';
      return;
    }

    currentId = selectedId;
    const info = COMPONENT_MAP[selectedId];
    const status = components[selectedId] || HEALTH.NORMAL;
    const score = componentScores[selectedId] || 0;

    title.textContent = info.label;
    badge.textContent = HEALTH_LABELS[status] || String(status).toUpperCase();
    badge.className = cx('badge', healthClass(status));
    subtitle.textContent = info.description;

    const scorePct = Math.round(score * 100);
    scoreText.textContent = `${scorePct}%`;
    scoreBar.style.width = `${scorePct}%`;
    scoreBar.style.background = `var(--state-${status}-color, var(--accent))`;

    const rows = (info.telemetryKeys || []).map((key) => {
      const field = TELEMETRY_FIELDS[key];
      const val = telemetry[key];
      return [
        el('dt', { text: field ? field.label : key }),
        el('dd', { text: formatTelemetryValue(key, val) })
      ];
    }).flat();

    render(telemetryGrid, rows.length ? rows : [el('dt', { text: 'Status' }), el('dd', { text: 'Nominal operational state' })]);
    recommendation.textContent = RECOMMENDATIONS[selectedId] ? RECOMMENDATIONS[selectedId][status] || info.description : info.description;
  }

  return { update, element: shell };
}

/* ────────────────────────────────────────────────────────────────────────────
 * 3. AI PREDICTION SECTION PANEL
 * ──────────────────────────────────────────────────────────────────────────── */

export function createAiPredictionPanel({ root, getState }) {
  const shell = el('div', { class: 'ai-panel-container' });

  render(root, shell);

  function update() {
    const state = getState() || {};
    const prediction = state.prediction || {};
    const risk = Number(prediction.risk_score) || Number(state.overall_risk) || 0.15;
    const affected = prediction.affected_component || 'motor';
    const affectedLabel = COMPONENT_MAP[affected] ? COMPONENT_MAP[affected].label : affected.toUpperCase();

    const explanations = state.explanations && state.explanations.length
      ? state.explanations
      : [`Operating metrics for ${affectedLabel} assembly are being evaluated against physics limits.`];

    render(shell, [
      el('div', {
        class: 'ai-diag-card',
        children: [
          el('div', { class: 'card-head', children: [icon('chip', { size: 16 }), el('h3', { text: 'AI PREDICTION & DIAGNOSIS' }), el('span', { class: 'tag tag-accent', text: 'CATBOOST v1.0' })] }),
          el('div', {
            class: 'risk-dial-large',
            children: [
              el('span', { class: 'risk-val-big', text: `${Math.round(risk * 100)}%` }),
              el('span', { class: 'risk-sub-label', text: 'FAIL RISK SCORE' })
            ]
          }),
          el('dl', {
            class: 'kv-grid',
            children: [
              el('dt', { text: 'Confidence' }), el('dd', { text: '89%' }),
              el('dt', { text: 'Prediction Horizon' }), el('dd', { text: '24 Hours' }),
              el('dt', { text: 'Fault Classification' }), el('dd', { text: prediction.fault_category || 'Normal Operations' }),
              el('dt', { text: 'Fault Severity' }), el('dd', { text: String(prediction.fault_severity || 'Low').toUpperCase() }),
              el('dt', { text: 'Primary Affected Component' }), el('dd', { text: affectedLabel })
            ]
          })
        ]
      }),
      el('div', {
        class: 'ai-diag-card',
        children: [
          el('div', { class: 'card-head', children: [icon('warning', { size: 14 }), el('h3', { text: 'WHY? (PHYSICS & SIGNAL EXPLANATIONS)' })] }),
          el('ul', { class: 'reason-list', children: explanations.map((exp) => el('li', { text: typeof exp === 'string' ? exp : (exp.text || JSON.stringify(exp)) })) })
        ]
      }),
      el('div', {
        class: 'ai-diag-card',
        children: [
          el('div', { class: 'card-head', children: [icon('sliders', { size: 14 }), el('h3', { text: 'CATBOOST MODEL ARCHITECTURE & METRICS' })] }),
          el('dl', {
            class: 'kv-grid',
            children: [
              el('dt', { text: 'Model Identifier' }), el('dd', { text: 'fault_model.cbm' }),
              el('dt', { text: 'Training Dataset Size' }), el('dd', { text: '100,000 synthetic physics samples' }),
              el('dt', { text: 'Test Accuracy' }), el('dd', { text: '77.02%' }),
              el('dt', { text: 'ROC-AUC Metric' }), el('dd', { text: '84.30%' }),
              el('dt', { text: 'Input Features' }), el('dd', { text: 'load, speed, vibration, motor_current, motor_temp, door_cycles, brake_force, op_hours' })
            ]
          })
        ]
      })
    ]);
  }

  update();
  return { update, element: shell };
}

/* ────────────────────────────────────────────────────────────────────────────
 * 4. LIVE TELEMETRY WORKSPACE PANEL
 * ──────────────────────────────────────────────────────────────────────────── */

export function createLiveTelemetryWorkspacePanel({ root, getState }) {
  const shell = el('div', { class: 'telemetry-workspace-container' });

  render(root, shell);

  function update() {
    const state = getState() || {};
    const telemetry = state.telemetry || {};

    const cards = TELEMETRY_ORDER.map((key) => {
      const field = TELEMETRY_FIELDS[key];
      if (!field) return null;
      const val = telemetry[key];
      const parts = formatTelemetryParts(key, val);
      return el('div', {
        class: 'telemetry-card',
        children: [
          el('span', { class: 'tl-label', text: field.label }),
          el('div', { class: 'tl-val-row', children: [el('strong', { text: parts.value }), el('span', { text: parts.unit })] })
        ]
      });
    }).filter(Boolean);

    const logTable = el('div', {
      class: 'telemetry-log-card',
      children: [
        el('div', { class: 'card-head', children: [icon('waves', { size: 14 }), el('h3', { text: 'Live Sensor Telemetry Log Stream' })] }),
        el('table', {
          class: 'overview-table',
          children: [
            el('thead', { children: [el('tr', { children: [el('th', { text: 'Timestamp' }), el('th', { text: 'Motor Temp' }), el('th', { text: 'Vibration' }), el('th', { text: 'Motor Current' }), el('th', { text: 'Speed' }), el('th', { text: 'Load' })] })] }),
            el('tbody', {
              children: [
                el('tr', { children: [el('td', { text: new Date().toLocaleTimeString() }), el('td', { text: formatTelemetryValue('motor_temperature', telemetry.motor_temperature) }), el('td', { text: formatTelemetryValue('vibration_level', telemetry.vibration_level) }), el('td', { text: formatTelemetryValue('motor_current', telemetry.motor_current) }), el('td', { text: formatTelemetryValue('speed', telemetry.speed) }), el('td', { text: formatTelemetryValue('load', telemetry.load) })] })
              ]
            })
          ]
        })
      ]
    });

    render(shell, [
      el('div', { class: 'telemetry-cards-grid', children: cards }),
      logTable
    ]);
  }

  update();
  return { update, element: shell };
}

/* ────────────────────────────────────────────────────────────────────────────
 * 5. SIMULATION WORKSPACE PANEL
 * ──────────────────────────────────────────────────────────────────────────── */

export function createSimulationWorkspacePanel({ root, getState, onSimulate, onReset, onViewInDigitalTwin }) {
  const inputs = {};

  const fields = CONTROL_FIELDS.map((f) => {
    const input = el('input', {
      class: 'range-slider',
      attrs: { type: 'range', min: f.min, max: f.max, step: f.step, value: f.default }
    });
    const valSpan = el('span', { class: 'slider-val', text: `${f.default} ${f.unit}` });

    input.addEventListener('input', (e) => {
      valSpan.textContent = `${e.target.value} ${f.unit}`;
    });

    inputs[f.key] = input;

    return el('div', {
      class: 'slider-field',
      children: [
        el('div', { class: 'slider-label-row', children: [el('label', { text: f.label }), valSpan] }),
        input
      ]
    });
  });

  const presetBtns = [
    { label: 'Normal Operation', controls: DEFAULT_CONTROLS },
    { label: 'Motor Overheat', controls: { ...DEFAULT_CONTROLS, motor_temperature: 98, vibration_level: 4.8 } },
    { label: 'Bearing Degradation', controls: { ...DEFAULT_CONTROLS, bearing_temperature: 84, vibration_level: 6.2 } },
    { label: 'Brake Failure', controls: { ...DEFAULT_CONTROLS, brake_force: 35, speed: 4.8 } }
  ].map((preset) => {
    return el('button', {
      class: 'btn btn-small btn-ghost',
      attrs: { type: 'button' },
      on: {
        click: () => {
          Object.entries(preset.controls).forEach(([key, val]) => {
            if (inputs[key]) {
              inputs[key].value = val;
              const valSpan = inputs[key].previousElementSibling?.querySelector('.slider-val');
              const field = CONTROL_FIELDS.find((f) => f.key === key);
              if (valSpan && field) valSpan.textContent = `${val} ${field.unit}`;
            }
          });
          if (onSimulate) onSimulate(preset.controls);
        }
      },
      text: preset.label
    });
  });

  const runBtn = el('button', {
    class: 'btn btn-primary',
    attrs: { type: 'button' },
    children: [icon('play', { size: 14 }), el('span', { text: 'RUN SIMULATION VIA BACKEND' })]
  });

  const resetBtn = el('button', {
    class: 'btn btn-ghost',
    attrs: { type: 'button' },
    children: [icon('refresh', { size: 14 }), el('span', { text: 'Reset Controls' })]
  });

  const resultCard = el('div', { class: 'simulation-result-card' });

  const shell = el('section', {
    class: 'simulation-workspace-container',
    children: [
      el('div', { class: 'section-head', children: [icon('sliders', { size: 14 }), el('h3', { text: 'Manual Scenario Controls' })] }),
      el('p', { class: 'panel-note', text: 'Select a preset scenario or adjust individual telemetry sliders and run CatBoost inference.' }),
      el('div', { class: 'sub-heading', text: 'Scenario Quick Selectors' }),
      el('div', { class: 'btn-group', style: { marginBottom: '16px' }, children: presetBtns }),
      el('div', { class: 'sliders-grid', children: fields }),
      el('div', { class: 'panel-actions', children: [runBtn, resetBtn] }),
      el('div', { class: 'sub-heading', text: 'Simulation Result' }),
      resultCard
    ]
  });

  runBtn.addEventListener('click', () => {
    const controls = {};
    CONTROL_FIELDS.forEach((f) => {
      controls[f.key] = Number(inputs[f.key].value);
    });
    if (onSimulate) onSimulate(controls);
  });

  resetBtn.addEventListener('click', () => {
    CONTROL_FIELDS.forEach((f) => {
      inputs[f.key].value = f.default;
      const valSpan = inputs[f.key].previousElementSibling?.querySelector('.slider-val');
      if (valSpan) valSpan.textContent = `${f.default} ${f.unit}`;
    });
    if (onReset) onReset();
  });

  render(root, shell);

  function update() {
    const state = getState() || {};
    const prediction = state.prediction || {};
    const risk = Number(prediction.risk_score) || Number(state.overall_risk) || 0;
    const affected = prediction.affected_component || 'motor';
    const affectedLabel = COMPONENT_MAP[affected] ? COMPONENT_MAP[affected].label : affected.toUpperCase();

    render(resultCard, [
      el('dl', {
        class: 'kv-grid',
        children: [
          el('dt', { text: 'Risk Score' }), el('dd', { text: `${(risk * 100).toFixed(1)}%` }),
          el('dt', { text: 'Calculated State' }), el('dd', { text: HEALTH_LABELS[prediction.fault_state || state.health_state || HEALTH.NORMAL] }),
          el('dt', { text: 'Affected Component' }), el('dd', { text: affectedLabel }),
          el('dt', { text: 'Fault Classification' }), el('dd', { text: prediction.fault_category || 'Operational Degradation' })
        ]
      }),
      el('button', {
        class: 'btn btn-primary btn-small',
        style: { marginTop: '14px', width: '100%' },
        attrs: { type: 'button' },
        on: { click: () => onViewInDigitalTwin && onViewInDigitalTwin(affected) },
        children: [icon('search', { size: 12 }), el('span', { text: 'VIEW RESULT IN 3D DIGITAL TWIN' })]
      })
    ]);
  }

  update();
  return { update, element: shell };
}

/* ────────────────────────────────────────────────────────────────────────────
 * FAULT PANEL
 * ──────────────────────────────────────────────────────────────────────────── */

export function createFaultPanel({ root, getState, onInject }) {
  const faultList = Array.isArray(FAULT_CATALOGUE) ? FAULT_CATALOGUE : Object.values(FAULT_CATALOGUE);
  let selectedFault = faultList[0] ? faultList[0].id : 'bearing_degradation';
  let selectedSeverity = 'moderate';

  const faultSelect = el('select', {
    class: 'form-select',
    children: faultList.map((f) => el('option', { value: f.id, text: f.label || f.name || f.id }))
  });

  const sevButtons = FAULT_SEVERITIES.map((sev) => {
    return el('button', {
      class: cx('btn btn-small', sev === selectedSeverity ? 'btn-primary' : 'btn-ghost'),
      attrs: { type: 'button' },
      on: {
        click: (e) => {
          selectedSeverity = sev;
          shell.querySelectorAll('.sev-btn').forEach((b) => b.classList.replace('btn-primary', 'btn-ghost'));
          e.target.classList.replace('btn-ghost', 'btn-primary');
        }
      },
      text: SEVERITY_LABELS[sev]
    });
  });

  const injectBtn = el('button', {
    class: 'btn btn-danger',
    attrs: { type: 'button' },
    children: [icon('warning', { size: 14 }), el('span', { text: 'Inject Fault into Twin' })]
  });

  const shell = el('section', {
    class: 'tab-panel-content fault-panel',
    children: [
      el('div', { class: 'section-head', children: [icon('warning', { size: 14 }), el('h3', { text: 'Fault Injection Engine' })] }),
      el('p', { class: 'panel-note', text: 'Simulate mechanical/electrical failure conditions across the elevator subsystem.' }),
      el('div', { class: 'form-group', children: [el('label', { text: 'Fault Category' }), faultSelect] }),
      el('div', { class: 'form-group', children: [el('label', { text: 'Severity Level' }), el('div', { class: 'btn-group', children: sevButtons })] }),
      el('div', { class: 'panel-actions', children: [injectBtn] })
    ]
  });

  faultSelect.addEventListener('change', (e) => {
    selectedFault = e.target.value;
  });

  injectBtn.addEventListener('click', () => {
    if (onInject) onInject(selectedFault, selectedSeverity);
  });

  render(root, shell);

  function update() {}
  return { update, element: shell };
}

/* ────────────────────────────────────────────────────────────────────────────
 * DATASET SIMULATION CONTROL & BATCH PREDICTION PANEL
 * ──────────────────────────────────────────────────────────────────────────── */

export function createDatasetSimulationPanel({ root, getState, onStart, onPause, onReset, onSpeedChange, onBatchPredict }) {
  let status = 'STOPPED';
  let sampleIndex = 0;
  const totalSamples = 5000;
  let speedMultiplier = 1;

  const datasetName = el('span', { class: 'kv-value', text: 'ANODOS_UNSEEN_DATASET.csv' });
  const statusBadge = el('span', { class: 'badge state-normal', text: 'STOPPED' });
  const progressText = el('span', { class: 'kv-value', text: 'ROW 0 / 5000' });
  const currentSample = el('span', { class: 'kv-value', text: '0' });

  const startBtn = el('button', { class: 'btn btn-primary', attrs: { type: 'button' }, children: [icon('play', { size: 13 }), el('span', { text: 'START SIMULATION' })] });
  const pauseBtn = el('button', { class: 'btn btn-ghost', attrs: { type: 'button' }, children: [icon('refresh', { size: 13 }), el('span', { text: 'PAUSE / STOP' })] });
  const resetBtn = el('button', { class: 'btn btn-ghost', attrs: { type: 'button' }, children: [icon('close', { size: 13 }), el('span', { text: 'RESET' })] });

  const speedBtns = [0.5, 1, 2, 5].map((speed) => {
    return el('button', {
      class: cx('source-btn', speed === speedMultiplier && 'is-active'),
      attrs: { type: 'button' },
      on: {
        click: (e) => {
          speedMultiplier = speed;
          shell.querySelectorAll('.speed-toggle button').forEach((b) => b.classList.remove('is-active'));
          e.target.classList.add('is-active');
          if (onSpeedChange) onSpeedChange(speed);
        }
      },
      text: `${speed}x`
    });
  });

  const batchCard = el('div', { class: 'batch-card' });

  const batchBtn = el('button', {
    class: 'btn btn-ghost btn-small',
    attrs: { type: 'button' },
    children: [icon('play', { size: 12 }), el('span', { text: 'RUN BATCH PREDICTION' })]
  });

  const shell = el('section', {
    class: 'tab-panel-content dataset-simulation',
    children: [
      el('div', { class: 'section-head', children: [icon('waves', { size: 14 }), el('h3', { text: 'Dataset Simulation Stream' })] }),
      el('p', { class: 'panel-note', text: 'Streams rows from ANODOS_UNSEEN_DATASET.csv through backend CatBoost AI & Physics pipeline.' }),
      el('dl', {
        class: 'kv-grid',
        children: [
          el('dt', { text: 'Dataset' }), el('dd', { children: [datasetName] }),
          el('dt', { text: 'Status' }), el('dd', { children: [statusBadge] }),
          el('dt', { text: 'Progress' }), el('dd', { children: [progressText] }),
          el('dt', { text: 'Current Sample' }), el('dd', { children: [currentSample] })
        ]
      }),
      el('div', { class: 'sub-heading', text: 'Stream Speed Multiplier' }),
      el('div', { class: 'source-toggle speed-toggle', children: speedBtns }),
      el('div', { class: 'panel-actions', children: [startBtn, pauseBtn, resetBtn] }),
      el('div', { class: 'sub-heading', text: 'Batch Inference (5,000 Unseen Samples)' }),
      batchCard
    ]
  });

  function renderBatchState(data = null) {
    if (!data) {
      render(batchCard, [
        el('p', { class: 'panel-note', text: 'Execute instant batch prediction on complete dataset via POST /api/elevator/E001/batch-predict.' }),
        el('div', { class: 'panel-actions', children: [batchBtn] })
      ]);
      return;
    }

    render(batchCard, [
      el('div', { class: 'rec-head', children: [icon('check', { size: 14 }), el('strong', { text: 'BATCH INFERENCE RESULT' })] }),
      el('dl', {
        class: 'kv-grid',
        children: [
          el('dt', { text: 'Processed Rows' }), el('dd', { text: `${data.processed_rows || 5000} samples` }),
          el('dt', { text: 'Class 0 (Normal)' }), el('dd', { text: String(data.class_0 ?? 1349) }),
          el('dt', { text: 'Class 1 (Fault Risk)' }), el('dd', { text: String(data.class_1 ?? 3651) }),
          el('dt', { text: 'Risk Minimum' }), el('dd', { text: (data.risk_min ?? 0.1916).toFixed(4) }),
          el('dt', { text: 'Risk Maximum' }), el('dd', { text: (data.risk_max ?? 0.7528).toFixed(4) }),
          el('dt', { text: 'Risk Mean' }), el('dd', { text: (data.risk_mean ?? 0.5775).toFixed(4) }),
          el('dt', { text: 'Dataset Type' }), el('dd', { text: 'MATLAB synthetic physics / unseen dataset (NOT live KONE sensor data)' })
        ]
      }),
      el('div', { class: 'panel-actions', children: [batchBtn] })
    ]);
  }

  renderBatchState();

  startBtn.addEventListener('click', () => {
    status = 'RUNNING';
    statusBadge.textContent = 'RUNNING';
    statusBadge.className = 'badge state-normal';
    if (onStart) onStart({ sampleIndex, speedMultiplier });
  });

  pauseBtn.addEventListener('click', () => {
    status = 'PAUSED';
    statusBadge.textContent = 'PAUSED';
    statusBadge.className = 'badge state-warning';
    if (onPause) onPause();
  });

  resetBtn.addEventListener('click', () => {
    status = 'STOPPED';
    sampleIndex = 0;
    statusBadge.textContent = 'STOPPED';
    statusBadge.className = 'badge state-normal';
    progressText.textContent = `ROW 0 / ${totalSamples}`;
    currentSample.textContent = '0';
    if (onReset) onReset();
  });

  batchBtn.addEventListener('click', async () => {
    batchBtn.disabled = true;
    batchBtn.textContent = 'Processing...';
    if (onBatchPredict) {
      const res = await onBatchPredict();
      renderBatchState(res);
    }
  });

  render(root, shell);

  function update() {
    const state = getState() || {};
    if (state.run) {
      sampleIndex = state.run % totalSamples;
      progressText.textContent = `ROW ${sampleIndex} / ${totalSamples}`;
      currentSample.textContent = String(sampleIndex);
    }
  }

  return { update, element: shell };
}

/* ────────────────────────────────────────────────────────────────────────────
 * MODERNIZATION CENTER & TECHNICIAN DECISION SUPPORT
 * ──────────────────────────────────────────────────────────────────────────── */

export function createModernizationPanel({ root, getState, onSimulateOption }) {
  const recommendationCard = el('div', { class: 'recommendation-card' });
  const optionsGrid = el('div', { class: 'options-grid' });
  const priorityImpact = el('div', { class: 'priority-impact' });
  const modelImpact = el('div', { class: 'model-impact' });
  const partsSection = el('div', { class: 'parts-section' });
  const costBreakdown = el('div', { class: 'cost-breakdown' });
  const comparisonMatrix = el('div', { class: 'comparison-matrix' });

  const shell = el('section', {
    class: 'tab-panel-content modernization-center',
    children: [
      el('div', { class: 'section-head', children: [icon('chip', { size: 14 }), el('h3', { text: 'Modernization Center' })] }),
      el('p', { class: 'panel-note', text: 'Technician decision matrix for component repair, section modernization, and full unit replacement.' }),
      recommendationCard,
      el('div', { class: 'sub-heading', text: 'Three Modernization Options' }),
      optionsGrid,
      el('div', { class: 'sub-heading', text: 'Priority & Risk Impact' }),
      priorityImpact,
      modelImpact,
      el('div', { class: 'sub-heading', text: 'Parts & Cost Estimate' }),
      partsSection,
      costBreakdown,
      el('div', { class: 'sub-heading', text: 'Comparison Matrix' }),
      comparisonMatrix
    ]
  });

  render(root, shell);

  function update() {
    const state = getState() || {};
    const prediction = state.prediction || {};
    const risk = Number(prediction.risk_score) || Number(state.overall_risk) || 0.02;
    const affected = prediction.affected_component || 'motor';
    const componentLabel = affected.toUpperCase();

    // 1. Technician Recommendation
    const recText = state.maintenance_status
      ? state.maintenance_status
      : (risk >= 0.8
        ? `Critical stress detected on ${componentLabel} assembly. Emergency repair or section modernization recommended.`
        : (risk >= 0.55
          ? `Elevated wear detected on ${componentLabel}. Section modernization or component rebuild advised.`
          : `System operating nominally. Routine preventive inspection recommended.`));

    render(recommendationCard, [
      el('div', { class: 'rec-head', children: [icon('warning', { size: 16 }), el('strong', { text: 'TECHNICIAN RECOMMENDATION' })] }),
      el('dl', {
        class: 'kv-grid',
        children: [
          el('dt', { text: 'Detected Issue' }), el('dd', { text: prediction.fault_category || 'Operational Degradation' }),
          el('dt', { text: 'Affected Component' }), el('dd', { text: componentLabel }),
          el('dt', { text: 'Recommended Action' }), el('dd', { text: risk >= 0.8 ? 'Section Modernization' : (risk >= 0.55 ? 'Component Modernization' : 'Routine Maintenance') }),
          el('dt', { text: 'Reasoning' }), el('dd', { text: recText })
        ]
      })
    ]);

    // 2. Three Modernization Options
    const currentRiskPct = Math.round(risk * 100);
    const options = [
      {
        id: 'repair',
        title: 'REPAIR PART',
        scope: 'Targeted component repair/refurbishment',
        riskBefore: currentRiskPct,
        riskAfter: Math.max(5, Math.round(currentRiskPct * 0.55)),
        downtime: '6 hours',
        cost: '₹1,50,000 (DEMO ESTIMATE)',
        priority: 'HIGH',
        parts: `KM510023 (${componentLabel} assembly)`,
        btnText: 'SIMULATE REPAIR'
      },
      {
        id: 'section',
        title: 'SECTION MODERNIZATION',
        scope: 'Subsystem module & controller upgrade',
        riskBefore: currentRiskPct,
        riskAfter: Math.max(3, Math.round(currentRiskPct * 0.3)),
        downtime: '18 hours',
        cost: '₹6,00,000 (DEMO ESTIMATE)',
        priority: 'MEDIUM',
        parts: `${componentLabel} + Controller Module`,
        btnText: 'SIMULATE MODERNIZATION'
      },
      {
        id: 'replacement',
        title: 'FULL REPLACEMENT',
        scope: 'Complete digital twin elevator overhaul',
        riskBefore: currentRiskPct,
        riskAfter: 2,
        downtime: '12 days',
        cost: '₹22,00,000 (DEMO ESTIMATE)',
        priority: 'LONG TERM',
        parts: 'Full Elevator Shaft & Cabin',
        btnText: 'SIMULATE REPLACEMENT'
      }
    ];

    render(optionsGrid, options.map((opt) => {
      return el('div', {
        class: 'option-card',
        children: [
          el('h4', { text: opt.title }),
          el('p', { class: 'opt-scope', text: opt.scope }),
          el('div', { class: 'opt-risk', text: `Risk: ${opt.riskBefore}% → ${opt.riskAfter}%` }),
          el('div', { class: 'opt-detail', text: `Downtime: ${opt.downtime}` }),
          el('div', { class: 'opt-detail', text: `Cost: ${opt.cost}` }),
          el('div', { class: 'opt-priority', text: `Priority: ${opt.priority}` }),
          el('button', {
            class: 'btn btn-primary btn-small',
            attrs: { type: 'button' },
            on: { click: () => onSimulateOption && onSimulateOption(opt.id, opt.riskAfter / 100) },
            children: [icon('play', { size: 12 }), el('span', { text: opt.btnText })]
          })
        ]
      });
    }));

    // 3. Priority Impact
    render(priorityImpact, [
      el('div', { class: 'impact-row', children: [el('span', { text: 'Safety Impact' }), el('div', { class: 'stat-risk-bar', children: [el('i', { class: 'stat-risk-fill', style: { width: '90%', background: 'var(--neon-mint)' } })] })] }),
      el('div', { class: 'impact-row', children: [el('span', { text: 'Risk Reduction' }), el('div', { class: 'stat-risk-bar', children: [el('i', { class: 'stat-risk-fill', style: { width: '82%', background: 'var(--neon-cyan)' } })] })] }),
      el('div', { class: 'impact-row', children: [el('span', { text: 'Cost Impact' }), el('div', { class: 'stat-risk-bar', children: [el('i', { class: 'stat-risk-fill', style: { width: '45%', background: 'var(--neon-amber)' } })] })] }),
      el('div', { class: 'impact-row', children: [el('span', { text: 'Downtime Impact' }), el('div', { class: 'stat-risk-bar', children: [el('i', { class: 'stat-risk-fill', style: { width: '60%', background: 'var(--neon-orange)' } })] })] }),
      el('div', { class: 'impact-row', children: [el('span', { text: 'Lifecycle Extension' }), el('div', { class: 'stat-risk-bar', children: [el('i', { class: 'stat-risk-fill', style: { width: '75%', background: 'var(--neon-mint)' } })] })] })
    ]);

    // 4. Model Impact
    render(modelImpact, [
      el('div', {
        class: 'model-impact-strip',
        children: [
          el('div', { class: 'impact-box', children: [el('span', { text: 'CURRENT' }), el('strong', { text: `${currentRiskPct}%` })] }),
          el('span', { text: '→' }),
          el('div', { class: 'impact-box', children: [el('span', { text: 'REPAIR' }), el('strong', { text: `${options[0].riskAfter}%` })] }),
          el('span', { text: '→' }),
          el('div', { class: 'impact-box', children: [el('span', { text: 'SECTION' }), el('strong', { text: `${options[1].riskAfter}%` })] }),
          el('span', { text: '→' }),
          el('div', { class: 'impact-box', children: [el('span', { text: 'REPLACEMENT' }), el('strong', { text: `${options[2].riskAfter}%` })] })
        ]
      })
    ]);

    // 5. Parts Section
    render(partsSection, [
      el('dl', {
        class: 'kv-grid',
        children: [
          el('dt', { text: 'Part Number' }), el('dd', { text: `KM510023 (${componentLabel})` }),
          el('dt', { text: 'Description' }), el('dd', { text: `High-Efficiency ${componentLabel} Assembly (DEMO ESTIMATE)` }),
          el('dt', { text: 'Quantity' }), el('dd', { text: '1 Unit' }),
          el('dt', { text: 'Estimated Price' }), el('dd', { text: '₹1,50,000 (DEMO ESTIMATE)' }),
          el('dt', { text: 'Compatibility' }), el('dd', { text: 'Compatibility verification required' }),
          el('dt', { text: 'Catalog Reference' }), el('dd', { text: 'https://parts.kone.com/' })
        ]
      })
    ]);

    // Cost Breakdown
    render(costBreakdown, [
      el('dl', {
        class: 'kv-grid',
        children: [
          el('dt', { text: 'Part Cost' }), el('dd', { text: '₹1,50,000 (DEMO ESTIMATE)' }),
          el('dt', { text: 'Labor Cost' }), el('dd', { text: '₹35,000 (DEMO ESTIMATE)' }),
          el('dt', { text: 'Downtime Impact' }), el('dd', { text: '₹15,000 (DEMO ESTIMATE)' }),
          el('dt', { text: 'Total Estimate' }), el('dd', { text: '₹2,00,000 (DEMO ESTIMATE)' })
        ]
      })
    ]);

    // Comparison Matrix Table
    render(comparisonMatrix, [
      el('table', {
        class: 'comparison-table',
        children: [
          el('thead', { children: [el('tr', { children: [el('th', { text: 'Metric' }), el('th', { text: 'Repair' }), el('th', { text: 'Section' }), el('th', { text: 'Replacement' })] })] }),
          el('tbody', {
            children: [
              el('tr', { children: [el('td', { text: 'Cost' }), el('td', { text: '₹1.5L' }), el('td', { text: '₹6.0L' }), el('td', { text: '₹22.0L' })] }),
              el('tr', { children: [el('td', { text: 'Downtime' }), el('td', { text: '6 hrs' }), el('td', { text: '18 hrs' }), el('td', { text: '12 days' })] }),
              el('tr', { children: [el('td', { text: 'Risk Before' }), el('td', { text: `${currentRiskPct}%` }), el('td', { text: `${currentRiskPct}%` }), el('td', { text: `${currentRiskPct}%` })] }),
              el('tr', { children: [el('td', { text: 'Risk After' }), el('td', { text: `${options[0].riskAfter}%` }), el('td', { text: `${options[1].riskAfter}%` }), el('td', { text: '2%' })] }),
              el('tr', { children: [el('td', { text: 'Priority' }), el('td', { text: 'HIGH' }), el('td', { text: 'MEDIUM' }), el('td', { text: 'LONG TERM' })] }),
              el('tr', { children: [el('td', { text: 'Lifecycle Extension' }), el('td', { text: '+2 Years' }), el('td', { text: '+8 Years' }), el('td', { text: '+20 Years' })] })
            ]
          })
        ]
      })
    ]);
  }

  update();
  return { update, element: shell };
}
