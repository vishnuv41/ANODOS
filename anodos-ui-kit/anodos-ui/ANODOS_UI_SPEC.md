# ANODOS — UI/UX Spec + Antigravity Prompt

Design language is taken from MedTouch.ai (powder-blue / deep-navy, glass cards, rounded-2xl, Inter, framer-motion, recharts, lucide, LOW/MED/HIGH gauge), extended with a **dark control-room theme**.

## 1. Theme tokens (app/globals.css — change colours ONLY here)
| Token | Light (MedTouch) | Dark (control-room) |
|---|---|---|
| bg | #E6F3F8 → #B0D4E3 gradient | #081119 + blue radial glow |
| surface | #FFFFFF @85% + blur | #0F1D29 @85% + blur |
| line | #B0D4E3 | #213A4E |
| ink (text) | #1B3A52 | #E6F3F8 |
| brand (buttons) | #1B3A52 | #B0D4E3 |
| accent | #2B82B4 | #60C8FF |
Status (same meaning everywhere): normal green · warning amber · high orange · fault red. Thresholds: <30 / <60 / <80 / ≥80 (`healthOf()` in the store).
Theme toggle: `next-themes`, class strategy, default dark, sun/moon button top-right. Never hard-code hex in components; use `bg-surface text-ink border-line` etc.

## 2. Layout grid
- Container `max-w-7xl`, `px-4 sm:px-6`, page gap `space-y-5`, card padding `p-5`, radius 16px.
- Sticky header (h≈56) = logo · elevator chip · LIVE/DEMO badge · theme toggle. Below it a sticky scrollable tab bar with animated underline (`layoutId`).
- Breakpoints: KPI grid 2 cols (mobile) → 4 cols (lg). Two-column tabs collapse to 1 column below `lg`.

## 3. Tab wireframes
**Overview** — title + status badge → 4 KPI cards (Health, Risk, RUL, State) → [Component status list (3/5) | AI summary (2/5)] → [Health trend area chart (3/5) | Recent incidents (2/5)]. Component rows are sorted highest-risk first and clickable → jumps to Digital Twin with the part selected.

**Digital Twin** — [3D viewer 2/3 width, 520px tall | right column: Component Inspector + Component list]. Legend chip bottom-left of the canvas. "Focus camera" button animates camera to the part. Fault/high parts pulse red/orange.

**AI Prediction** — [Gauge card (2/5) | Confidence, Horizon, Severity, Affected stats + "Why?" card (3/5)] → Model card (CatBoost, samples, accuracy, ROC-AUC).

**Telemetry** — 9 stat tiles (3×3) → [sensor trend line chart | live stream table (last 20 rows)].

**Simulation** — [Scenario chips + 4 sliders + RUN SIMULATION | Result card: big risk %, state badge, component, severity, RUL, "View in Digital Twin"].

**Maintenance** — RUL, Priority (URGENT/HIGH/PLANNED/ROUTINE), Target → [Technician guidance numbered steps | Modernization list].

**History** — [Incident timeline (vertical line) | Prediction history table].

## 4. State rules (fixes the bugs from the review)
1. ONE Zustand store (`store/useAnodos.ts`) exposes `setPrediction`, `setRun`, `runSimulation`. Do **not** delete these calls.
2. Component risk comes ONLY from `selectComponents(prediction)` → Overview, Twin, Inspector, Maintenance can never contradict each other (no more "INCIDENT · BRAKE" with a 0% normal inspector).
3. `<DigitalTwinViewer/>` is the only 3D component; import it with `dynamic(..., { ssr:false })` wherever needed.
4. Demo flow: Simulation → RUN → `setRun` → `setPrediction` → (incident, trend, component colours update automatically) → `focusComponent()` → "View in Digital Twin".

## 5. Wiring to your real backend
`store/useAnodos.ts → normalize()` maps your API JSON to `Prediction`. Set `NEXT_PUBLIC_API_URL`; the simulate endpoint is `POST {API}/simulate` with `{elevator_id, scenario, telemetry}`. If the request fails, a local demo fallback runs and the header shows DEMO DATA instead of LIVE BACKEND.

## 6. PROMPT TO PASTE INTO ANTIGRAVITY
> You are implementing the ANODOS elevator digital-twin dashboard in my existing project. Read `ANODOS_UI_SPEC.md` and the files in this folder first.
> 1. Install: `next-themes zustand framer-motion recharts lucide-react three@0.160 @react-three/fiber@8 @react-three/drei@9 tailwindcss@3`.
> 2. Copy `app/globals.css` and `tailwind.config.js` (dark mode = class, CSS-variable colour tokens). Wrap the app in `ThemeProvider` as in `app/layout.tsx`.
> 3. Merge `store/useAnodos.ts` with my current store. Keep my existing API calls, but make sure `setPrediction` and `setRun` exist and are exported. Adapt `normalize()` to my real backend response.
> 4. Replace my single-page dashboard with `components/shell/AppShell.tsx` and the 7 tabs in `components/tabs/`. Reuse my existing 3D model inside `components/twin/DigitalTwinViewer.tsx` (keep part ids, colour-by-health and pulse logic).
> 5. Every tab must read from the store only — no local copies of prediction/component state.
> 6. Verify in BOTH light and dark themes at 375px, 768px and 1440px: no horizontal scroll, contrast readable, no console errors.
> 7. Acceptance test: Simulation → Motor Overheat (105°C) → RUN → risk ≈ 98%, motor turns red and pulses in Digital Twin, incident appears in Overview + History, Maintenance priority = URGENT.
