/**
 * ANODOS Digital Twin — Telemetry & trend UI.
 *
 * Three independent panels, each a small render function that reads the central
 * state and writes DOM nodes:
 *
 *   createTelemetryPanel()   virtual sensor readings with severity heat
 *   createComponentList()    compact health chips for every component
 *   createTrendChart()       canvas trend chart of risk / temperature / vibration
 *
 * All values shown here are VIRTUAL / SIMULATED telemetry — the panels say so
 * explicitly so nobody mistakes them for physical measurements.
 */

import {
  TELEMETRY_ORDER,
  TELEMETRY_FIELDS,
  COMPONENTS,
  COMPONENT_MAP,
  HEALTH_LABELS,
  HEALTH,
  formatTelemetryParts,
  scoreToHealth
} from '../scene/components.js';
import { el, render, icon, cx, healthClass, formatPercent, formatNumber, clamp } from './dom.js';

/* ────────────────────────────────────────────────────────────────────────────
 * SHARED: metric severity heat map
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Builds `metric → worst weighted severity` from the scoring breakdown.
 *
 * This lets each telemetry row light up with the same colour logic the 3D model
 * uses, without recomputing any scoring in the UI layer.
 */
export function buildMetricSeverity(state) {
  const severity = new Map();
  const breakdown = (state && state.component_breakdown) || {};

  for (const entries of Object.values(breakdown)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const current = severity.get(entry.metric) || 0;
      if (entry.weighted > current) severity.set(entry.metric, entry.weighted);
    }
  }
  return severity;
}

/** Normalised 0..1 position of a reading inside its own display range. */
function barFraction(key, value) {
  const field = TELEMETRY_FIELDS[key];
  const numeric = Number(value);
  if (!field || !Number.isFinite(numeric)) return 0;

  if (Number.isFinite(field.max) && Number.isFinite(field.min)) {
    return clamp((numeric - field.min) / Math.max(1e-6, field.max - field.min), 0, 1);
  }
  const nominal = Number.isFinite(field.nominal) ? field.nominal : Math.max(1, numeric);
  return clamp(numeric / Math.max(1e-6, nominal * 2.2), 0, 1);
}

/* ────────────────────────────────────────────────────────────────────────────
 * TELEMETRY PANEL
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * @param {object} options
 * @param {HTMLElement} options.root
 * @param {() => object} options.getState
 */
export function createTelemetryPanel({ root, getState }) {
  const grid = el('div', { class: 'telemetry-grid' });
  const empty = el('div', {
    class: 'empty-state',
    children: [icon('pulse', { size: 18 }), el('p', { text: 'No telemetry yet — run a simulation.' })]
  });
  const rows = new Map();

  const shell = el('section', {
    class: 'panel panel-telemetry',
    children: [
      el('header', {
        class: 'panel-title',
        children: [
          icon('pulse', { size: 14 }),
          el('h3', { text: 'Virtual Sensor Telemetry' }),
          el('span', { class: 'tag tag-muted', text: 'SIMULATED' })
        ]
      }),
      empty,
      grid
    ]
  });

  render(root, shell);

  function buildRow(key) {
    const field = TELEMETRY_FIELDS[key];
    const value = el('span', { class: 'tl-value', text: '—' });
    const unit = el('span', { class: 'tl-unit', text: field.unit });
    const bar = el('i', { class: 'tl-bar-fill' });
    const row = el('div', {
      class: 'telemetry-row',
      dataset: { metric: key },
      children: [
        el('span', { class: 'tl-label', text: field.label, attrs: { title: field.label } }),
        value,
        unit,
        el('span', { class: 'tl-bar', children: [bar] })
      ]
    });
    rows.set(key, { row, value, unit, bar, field });
    return row;
  }

  function update() {
    const state = getState() || {};
    const telemetry = state.telemetry || {};
    const hasData = Object.keys(telemetry).length > 0;

    empty.classList.toggle('hidden', hasData);
    grid.classList.toggle('hidden', !hasData);
    if (!hasData) return;

    const severity = buildMetricSeverity(state);

    // Build rows on first data arrival, then only update values.
    if (!grid.childElementCount) {
      for (const key of TELEMETRY_ORDER) {
        if (!TELEMETRY_FIELDS[key]) continue;
        grid.appendChild(buildRow(key));
      }
    }

    for (const key of TELEMETRY_ORDER) {
      const entry = rows.get(key);
      if (!entry) continue;
      const value = telemetry[key];
      const parts = formatTelemetryParts(key, value);

      entry.value.textContent = parts.value;
      entry.unit.textContent = parts.unit;
      entry.bar.style.width = `${(barFraction(key, value) * 100).toFixed(1)}%`;

      const weighted = severity.get(key) || 0;
      const heat = scoreToHealth(weighted);
      entry.row.className = cx(
        'telemetry-row',
        healthClass(heat),
        weighted > 0.3 && 'is-elevated'
      );
      entry.row.title = weighted > 0.3
        ? `${entry.field.label}: contributing to risk (severity ${formatPercent(weighted)})`
        : `${entry.field.label} within nominal band`;
    }
  }

  return { update, element: shell };
}

/* ────────────────────────────────────────────────────────────────────────────
 * COMPONENT LIST
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Compact health chips for every component. Clicking a chip selects it in the
 * 3D scene and in the inspector.
 *
 * @param {object} options
 * @param {HTMLElement} options.root
 * @param {() => object} options.getState
 * @param {(componentId:string) => void} options.onSelect
 */
export function createComponentList({ root, getState, onSelect }) {
  const list = el('div', { class: 'component-list' });
  const chips = new Map();

  const shell = el('section', {
    class: 'panel panel-components',
    children: [
      el('header', {
        class: 'panel-title',
        children: [
          icon('layers', { size: 14 }),
          el('h3', { text: 'Component Status' }),
          el('span', { class: 'tag tag-muted', id: 'component-count', text: `${COMPONENTS.length} units` })
        ]
      }),
      list
    ]
  });

  render(root, shell);

  for (const component of COMPONENTS) {
    const score = el('span', { class: 'chip-score', text: '—' });
    const dot = el('span', { class: 'chip-dot' });
    const chip = el('button', {
      class: cx('component-chip', healthClass(HEALTH.NORMAL)),
      attrs: { type: 'button', title: `${component.label} — ${component.subtitle}` },
      dataset: { component: component.id },
      on: { click: () => onSelect && onSelect(component.id) },
      children: [dot, el('span', { class: 'chip-label', text: component.label }), score]
    });
    chips.set(component.id, { chip, score });
    list.appendChild(chip);
  }

  function update() {
    const state = getState() || {};
    const components = state.components || {};
    const scores = state.component_scores || {};

    const items = COMPONENTS.map((component) => {
      const healthState = components[component.id] || HEALTH.NORMAL;
      const rawScore = Number(scores[component.id]);
      const score = Number.isFinite(rawScore)
        ? rawScore
        : (healthState === HEALTH.FAULT ? 0.98 : (healthState === HEALTH.HIGH_RISK ? 0.71 : (healthState === HEALTH.WARNING ? 0.35 : 0.05)));
      return { component, healthState, score };
    });

    // Sort components by risk severity descending (highest risk first)
    items.sort((a, b) => b.score - a.score);

    list.innerHTML = '';
    for (const { component, healthState, score } of items) {
      const entry = chips.get(component.id);
      if (!entry) continue;

      entry.chip.className = cx(
        'component-chip',
        healthClass(healthState),
        component.critical && 'is-critical-component'
      );
      entry.score.textContent = `${Math.round(score * 100)}%`;
      entry.chip.title = `${component.label} — ${HEALTH_LABELS[healthState]} (risk ${Math.round(score * 100)}%)`;
      list.appendChild(entry.chip);
    }
  }

  return { update, element: shell };
}

/* ────────────────────────────────────────────────────────────────────────────
 * TREND CHART (canvas — no charting dependency)
 * ──────────────────────────────────────────────────────────────────────────── */

const SERIES = [
  { key: 'risk', label: 'Risk', color: '#ff5d7a', digits: 2, unit: '' },
  { key: 'heat', label: 'Motor Temp', color: '#ffb02e', digits: 1, unit: '°C' },
  { key: 'vibration', label: 'Vibration', color: '#5fd0ff', digits: 2, unit: 'mm/s' }
];

const RISK_BAND_COLORS = {
  normal: 'rgba(52, 211, 165, 0.10)',
  warning: 'rgba(255, 176, 46, 0.10)',
  high_risk: 'rgba(255, 106, 46, 0.12)',
  fault: 'rgba(255, 36, 64, 0.16)'
};

/** Ordering of backend explanation severities (strings, not health states). */
const SEVERITY_RANK = { critical: 3, high: 2, medium: 1, low: 0 };

/**
 * Lightweight line chart drawn on a canvas. Uses no external library so the
 * bundle stays small and the chart works offline.
 */
export function createTrendChart({ root, getState }) {
  const canvas = el('canvas', { class: 'trend-canvas' });
  const legend = el('div', { class: 'chart-legend' });
  const empty = el('div', {
    class: 'empty-state',
    children: [icon('spark', { size: 18 }), el('p', { text: 'Trend builds as you simulate.' })]
  });

  const shell = el('section', {
    class: 'panel panel-chart',
    children: [
      el('header', {
        class: 'panel-title',
        children: [
          icon('spark', { size: 14 }),
          el('h3', { text: 'Health Trend' }),
          el('span', { class: 'tag tag-muted', text: 'last 120 runs' })
        ]
      }),
      legend,
      el('div', { class: 'chart-body', children: [canvas, empty] })
    ]
  });

  render(root, shell);

  const legendValues = new Map();
  for (const series of SERIES) {
    const value = el('span', { class: 'legend-value', text: '—' });
    legendValues.set(series.key, value);
    legend.appendChild(
      el('span', {
        class: 'legend-item',
        children: [
          el('i', { class: 'legend-swatch', style: { background: series.color } }),
          el('span', { class: 'legend-label', text: series.label }),
          value
        ]
      })
    );
  }

  let width = 0;
  let height = 0;
  let dpr = 1;

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = Math.max(120, Math.floor(rect.width));
    height = Math.max(90, Math.floor(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  /** Draws the series with a shared normaliser per series (0..max). */
  function draw(history) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 10, right: 8, bottom: 16, left: 26 };
    const plotWidth = Math.max(1, width - padding.left - padding.right);
    const plotHeight = Math.max(1, height - padding.top - padding.bottom);

    // Risk band background: shows how much of the window was at risk.
    const bandWidth = plotWidth / Math.max(1, history.length);
    history.forEach((point, index) => {
      const state = point.fault_state || 'normal';
      ctx.fillStyle = RISK_BAND_COLORS[state] || RISK_BAND_COLORS.normal;
      ctx.fillRect(padding.left + index * bandWidth, padding.top, Math.ceil(bandWidth), plotHeight);
    });

    // Grid lines.
    ctx.strokeStyle = 'rgba(120, 150, 190, 0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 2; i += 1) {
      const y = padding.top + (plotHeight / 2) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotWidth, y);
      ctx.stroke();
    }

    // Axis labels.
    ctx.fillStyle = 'rgba(150, 175, 205, 0.75)';
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('1', 20, padding.top + 4);
    ctx.fillText('0', 20, padding.top + plotHeight);

    // Series.
    for (const series of SERIES) {
      const values = history.map((point) => Number(point[series.key]) || 0);
      const max = Math.max(seriesMax(series.key), ...values, 0.0001);

      ctx.strokeStyle = series.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      values.forEach((value, index) => {
        const x = padding.left + (values.length === 1 ? plotWidth / 2 : (index / (values.length - 1)) * plotWidth);
        const y = padding.top + plotHeight - clamp(value / max, 0, 1) * plotHeight;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Latest point marker.
      const lastValue = values[values.length - 1];
      if (Number.isFinite(lastValue)) {
        const x = padding.left + plotWidth;
        const y = padding.top + plotHeight - clamp(lastValue / max, 0, 1) * plotHeight;
        ctx.fillStyle = series.color;
        ctx.beginPath();
        ctx.arc(x - 1, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Fixed reference maximum so the chart scale stays stable between runs. */
  function seriesMax(key) {
    if (key === 'risk') return 1;
    if (key === 'heat') return 140;
    if (key === 'vibration') return 12;
    return 1;
  }

  const resizeObserver = new ResizeObserver(() => {
    resizeCanvas();
    const state = getState() || {};
    draw(state.history || []);
  });
  resizeObserver.observe(canvas.parentElement);
  resizeCanvas();

  function update() {
    const state = getState() || {};
    const history = Array.isArray(state.history) ? state.history : [];
    const hasData = history.length > 0;

    empty.classList.toggle('hidden', hasData);
    canvas.style.opacity = hasData ? '1' : '0';
    if (!hasData) return;

    const latest = history[history.length - 1];
    for (const series of SERIES) {
      const value = Number(latest[series.key]);
      legendValues.get(series.key).textContent = Number.isFinite(value)
        ? `${formatNumber(value, series.digits)}${series.unit ? ` ${series.unit}` : ''}`
        : '—';
    }
    draw(history);
  }

  function destroy() {
    resizeObserver.disconnect();
  }

  return { update, destroy, element: shell };
}

/* ────────────────────────────────────────────────────────────────────────────
 * PREDICTION PANEL
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Displays the prediction block of the contract. Everything here comes from the
 * backend when it is connected; in mock mode it is the local placeholder model,
 * which the panel labels honestly.
 */
export function createPredictionPanel({ root, getState, onSelect }) {
  const riskValue = el('span', { class: 'risk-value', text: '—' });
  const riskBar = el('i', { class: 'risk-bar-fill' });
  const stateBadge = el('span', { class: 'badge', text: 'AWAITING DATA' });
  const affectComponent = el('span', { class: 'kv-value', text: '—' });
  const faultCategory = el('span', { class: 'kv-value', text: '—' });
  const faultSeverity = el('span', { class: 'kv-value', text: '—' });
  const confidence = el('span', { class: 'kv-value', text: '—' });
  const horizon = el('span', { class: 'kv-value', text: '—' });
  const sourceTag = el('span', { class: 'tag tag-muted', text: 'LOCAL PLACEHOLDER' });
  const explanationList = el('ul', { class: 'explanation-list' });

  const shell = el('section', {
    class: 'panel panel-prediction',
    children: [
      el('header', {
        class: 'panel-title',
        children: [
          icon('chip', { size: 14 }),
          el('h3', { text: 'AI Prediction' }),
          sourceTag
        ]
      }),
      el('div', {
        class: 'prediction-head',
        children: [
          el('div', { class: 'risk-dial', children: [riskValue, el('span', { class: 'risk-caption', text: 'fail risk' })] }),
          el('div', { class: 'prediction-badges', children: [stateBadge] })
        ]
      }),
      el('div', { class: 'risk-bar', children: [riskBar] }),
      el('dl', {
        class: 'kv-grid',
        children: [
          el('dt', { text: 'Affected' }), el('dd', { children: [affectComponent] }),
          el('dt', { text: 'Category' }), el('dd', { children: [faultCategory] }),
          el('dt', { text: 'Severity' }), el('dd', { children: [faultSeverity] }),
          el('dt', { text: 'Confidence' }), el('dd', { children: [confidence] }),
          el('dt', { text: 'Horizon' }), el('dd', { children: [horizon] })
        ]
      }),
      el('div', { class: 'explanation-wrap', children: [
        el('h4', { class: 'sub-heading', text: 'Why' }),
        explanationList
      ] })
    ]
  });

  render(root, shell);

  function update() {
    const state = getState() || {};
    const prediction = state.prediction || {};
    const hasPrediction = Object.keys(prediction).length > 0;

    const risk = Number(prediction.risk_score);
    const overall = Number.isFinite(risk) ? risk : Number(state.overall_risk);
    const healthState = prediction.fault_state || state.health_state || HEALTH.NORMAL;

    riskValue.textContent = Number.isFinite(overall) ? formatPercent(overall, 0) : '—';
    riskBar.style.width = `${clamp(Number.isFinite(overall) ? overall : 0, 0, 1) * 100}%`;
    riskBar.style.background = `var(--state-${healthState}-color, var(--accent))`;

    stateBadge.textContent = HEALTH_LABELS[healthState] || String(healthState).toUpperCase();
    stateBadge.className = cx('badge', healthClass(healthState));

    const affectedLabel = prediction.affected_component
      ? (COMPONENT_MAP[prediction.affected_component]
        ? COMPONENT_MAP[prediction.affected_component].label
        : prediction.affected_component)
      : '—';
    affectComponent.textContent = affectedLabel;
    affectComponent.className = cx(
      'kv-value',
      prediction.affected_component && 'is-actionable'
    );
    if (prediction.affected_component) {
      affectComponent.onclick = () => onSelect && onSelect(prediction.affected_component);
      affectComponent.style.cursor = 'pointer';
      affectComponent.title = 'Show this component in the 3D view';
    }

    faultCategory.textContent = prediction.fault_category
      ? String(prediction.fault_category).replace(/_/g, ' ')
      : 'none detected';
    faultSeverity.textContent = prediction.fault_severity
      ? String(prediction.fault_severity).toUpperCase()
      : '—';
    faultSeverity.className = cx('kv-value', prediction.fault_severity && `sev-${prediction.fault_severity}`);

    confidence.textContent = Number.isFinite(Number(prediction.confidence))
      ? formatPercent(prediction.confidence, 0)
      : '—';

    horizon.textContent = Number.isFinite(Number(prediction.horizon_hours))
      ? `~${formatNumber(prediction.horizon_hours)} h`
      : '—';

    const fromBackend = state.data_source === 'backend' || state.source === 'backend';
    sourceTag.textContent = fromBackend ? 'LIVE CATBOOST' : 'LOCAL PLACEHOLDER';
    sourceTag.classList.toggle('tag-accent', fromBackend);

    const explanations = Array.isArray(state.explanations) ? state.explanations : [];
    if (!hasPrediction) {
      render(explanationList, [
        el('li', { class: 'explanation-empty', text: 'No prediction yet — press SIMULATE.' })
      ]);
    } else if (!explanations.length) {
      render(explanationList, [
        el('li', {
          class: 'explanation-empty',
          text: `${HEALTH_LABELS[healthState] || healthState} — no metric is outside its design envelope.`
        })
      ]);
    } else {
      const sorted = [...explanations].sort(
        (a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0)
      );
      render(
        explanationList,
        sorted.slice(0, 5).map((explanation) =>
          el('li', {
            class: cx('explanation-item', `sev-${explanation.severity}`),
            children: [
              el('span', {
                class: 'explanation-component',
                text: `${COMPONENT_MAP[explanation.component_id]
                  ? COMPONENT_MAP[explanation.component_id].label
                  : explanation.component_id}: `
              }),
              el('span', { class: 'explanation-text', text: explanation.text || explanation.message })
            ]
          })
        )
      );
    }
  }

  return { update, element: shell };
}
