/**
 * ANODOS Digital Twin — DOM helpers.
 *
 * Tiny, dependency-free helpers used by every UI module. Everything is built
 * with real DOM APIs (`createElement` / `textContent`) — no innerHTML anywhere —
 * so component names, telemetry values and backend messages can never be
 * interpreted as markup.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * ELEMENT BUILDING
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Creates an element.
 *
 * @param {string} tag
 * @param {object} [options]
 * @param {string} [options.class]        class attribute
 * @param {string|number} [options.text]  text content (always escaped by the DOM)
 * @param {object} [options.attrs]        attributes
 * @param {object} [options.style]        inline styles
 * @param {object} [options.dataset]      data-* attributes
 * @param {object} [options.on]           event listeners  { click: fn }
 * @param {Array} [options.children]      child nodes / strings
 */
export function el(tag, options = {}, legacyChildren = null) {
  const node = document.createElement(tag);

  if (options.class) node.className = options.class;
  if (options.text !== undefined && options.text !== null) node.textContent = String(options.text);

  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      if (value === null || value === undefined || value === false) continue;
      node.setAttribute(key, value === true ? '' : String(value));
    }
  }

  if (options.style) Object.assign(node.style, options.style);
  if (options.dataset) {
    for (const [key, value] of Object.entries(options.dataset)) {
      if (value === null || value === undefined) continue;
      node.dataset[key] = String(value);
    }
  }
  if (options.on) {
    for (const [event, handler] of Object.entries(options.on)) {
      node.addEventListener(event, handler);
    }
  }
  if (options.children) append(node, options.children);
  else if (legacyChildren) append(node, legacyChildren);

  return node;
}

/** Appends children (nodes, strings, numbers, nested arrays) to a parent. */
export function append(parent, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) {
      append(parent, child);
      continue;
    }
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/** Removes every child of a node. */
export function clear(node) {
  if (!node) return node;
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Replaces a node's content with new children. */
export function render(node, children) {
  clear(node);
  append(node, children);
  return node;
}

/** Toggles a class on a node. */
export function setClass(node, className, active) {
  if (!node) return node;
  node.classList.toggle(className, Boolean(active));
  return node;
}

/* ────────────────────────────────────────────────────────────────────────────
 * SVG ICONS
 * ──────────────────────────────────────────────────────────────────────────── */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Icon paths, expressed as SVG markup fragments for a 24×24 viewBox.
 * Plain shapes only — stroke colour comes from CSS `currentColor`.
 */
const ICON_PATHS = {
  pulse: 'M3 12h4l2.5-6 3.5 12 2.5-6h5.5',
  thermometer: 'M12 4a2.5 2.5 0 0 1 2.5 2.5v7a4 4 0 1 1-5 0v-7A2.5 2.5 0 0 1 12 4Z M12 9v6',
  bolt: 'M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z',
  gauge: 'M4 18a8 8 0 1 1 16 0 M12 18l4.5-6',
  waves: 'M2 8c2.5-2 5-2 7.5 0S17 11 21.5 8 M2 15c2.5-2 5-2 7.5 0s5.5 3 10 0',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7.5V12l3 2',
  weight: 'M12 3.5a1.8 1.8 0 0 1 1.7 1.2h3.3l2 13.8H5l2-13.8h3.3A1.8 1.8 0 0 1 12 3.5Z M9.5 8h5',
  shield: 'M12 3 5 6v6c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6l-7-3Z',
  chip: 'M8 8h8v8H8z M4 10h2M4 14h2M18 10h2M18 14h2M10 4v2M14 4v2M10 18v2M14 18v2',
  gauge2: 'M12 21a9 9 0 1 0-9-9 M12 12l5 3',
  refresh: 'M20 12a8 8 0 1 1-2.4-5.7 M20 4v4h-4',
  play: 'M8 5.5v13l11-6.5-11-6.5Z',
  plus: 'M12 5v14 M5 12h14',
  close: 'M6 6l12 12 M18 6 6 18',
  check: 'M5 13l4.5 4.5L19 7',
  warning: 'M12 4.5 3 19.5h18L12 4.5Z M12 10v4.5 M12 17v.5',
  error: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7.5v6 M12 16.5v.5',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 11v5.5 M12 7.8v.4',
  layers: 'M12 3 3 8l9 5 9-5-9-5Z M3 13l9 5 9-5 M3 17.5l9 5 9-5',
  camera: 'M4 7h3l1.5-2h7L17 7h3v12H4V7Z M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  link: 'M10 14a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1-1',
  cursor: 'M6 3.5 19 12l-6 1.2-2.6 6.3L6 3.5Z',
  spark: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6.3 6.3l2.8 2.8 M14.9 14.9l2.8 2.8 M17.7 6.3l-2.8 2.8 M9.1 14.9l-2.8 2.8',
  dot: 'M12 12h.01'
};

/**
 * Builds an SVG icon element.
 * @param {keyof typeof ICON_PATHS} name
 * @param {object} [options] { size, class, stroke, fill }
 */
export function icon(name, options = {}) {
  const size = options.size || 14;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(options.strokeWidth || 1.7));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (options.class) svg.setAttribute('class', options.class);

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICON_PATHS[name] || ICON_PATHS.dot);
  svg.appendChild(path);
  return svg;
}

/** True when an icon name exists (used in tests / safe fallbacks). */
export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(ICON_PATHS, name);
}

/* ────────────────────────────────────────────────────────────────────────────
 * FORMATTING
 * ──────────────────────────────────────────────────────────────────────────── */

/** `0.8734` → `87.3%` */
export function formatPercent(value, digits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${(numeric * 100).toFixed(digits)}%`;
}

/** Thousands-separated number with fixed decimals. */
export function formatNumber(value, digits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

/** `12:04:31` — local wall clock for alert timestamps. */
export function formatTime(input) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-GB', { hour12: false });
}

/** "just now" / "42 s ago" / "3 min ago" for the connection + alerts panels. */
export function timeAgo(input, now = Date.now()) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} h ago`;
}

/** CSS-ready slug used for health-state classes. */
export function healthClass(state) {
  const safe = String(state || 'normal').replace(/[^a-z_]/gi, '_');
  return `state-${safe}`;
}

export function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

/** Joins class names, skipping falsy ones. */
export function cx(...names) {
  return names.filter(Boolean).join(' ');
}
