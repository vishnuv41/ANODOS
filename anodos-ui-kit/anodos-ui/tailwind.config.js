/** Tokens come from CSS variables (app/globals.css) so light/dark switch with zero per-component code. */
const v = (n) => `rgb(var(--${n}) / <alpha-value>)`
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), surface: v('surface'), raised: v('raised'), line: v('line'),
        ink: v('ink'), muted: v('muted'), brand: v('brand'), onbrand: v('onbrand'), accent: v('accent'),
        ok: v('ok'), warn: v('warn'), high: v('high'), fault: v('fault'),
      },
      boxShadow: { card: 'var(--shadow-card)', glow: '0 0 24px rgb(var(--accent) / .35)' },
      borderRadius: { xl2: '16px' },
      keyframes: {
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgb(var(--fault) / .5)' }, '100%': { boxShadow: '0 0 0 14px rgb(var(--fault) / 0)' } },
        slideUp: { '0%': { transform: 'translateY(12px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: { pulseRing: 'pulseRing 1.6s ease-out infinite', slideUp: 'slideUp .35s ease-out both' },
    },
  },
  plugins: [],
}
