'use client'

import { useState } from 'react'
import { ArrowUp, Crosshair, Play, Sliders } from 'lucide-react'
import type { CompId, Telemetry } from '@/lib/types'
import { BASE, compName, HEALTH_LABEL, healthOf, selectComponents, useAnodos } from '@/store/useAnodos'
import DigitalTwinViewer from '../twin/DigitalTwinViewer'
import { Badge, Empty, Panel, RiskBar } from '../ui/primitives'

const FIELDS: { k: keyof Telemetry; label: string; unit: string; min: number; max: number; step: number }[] = [
  { k: 'motorTemp', label: 'Motor Temperature', unit: '°C', min: 30, max: 130, step: 1 },
  { k: 'vibration', label: 'Vibration', unit: 'mm/s', min: 0, max: 12, step: 0.1 },
  { k: 'current', label: 'Motor Current', unit: 'A', min: 0, max: 20, step: 0.1 },
  { k: 'brakeForce', label: 'Brake Force', unit: '%', min: 0, max: 100, step: 1 },
]

const COMPONENT_OPTIONS: { id: CompId; label: string }[] = [
  { id: 'brake', label: 'Brake' },
  { id: 'motor', label: 'Traction Motor' },
  { id: 'bearing', label: 'Main Shaft Bearing' },
  { id: 'controller', label: 'Main Elevator Controller' },
  { id: 'rope', label: 'Steel Wire Rope' },
  { id: 'door', label: 'Door Operator' },
  { id: 'pulley', label: 'Sheave Pulley' },
  { id: 'counterweight', label: 'Counterweight Frame' },
  { id: 'guide_rail', label: 'Guide Rails' },
  { id: 'cabin', label: 'Cabin Car & Sling' },
  { id: 'shaft', label: 'Hoistway Environment' },
]

type SeverityLevel = 'normal' | 'mid' | 'critical'

const SEVERITY_PRESETS: Record<CompId, Record<SeverityLevel, Partial<Telemetry>>> = {
  brake: {
    normal: { brakeForce: 95, vibration: 1.8, motorTemp: 65, current: 8.4 },
    mid: { brakeForce: 70, vibration: 2.8, motorTemp: 72, current: 10.2 },
    critical: { brakeForce: 35, vibration: 5.5, motorTemp: 82, current: 15.4 },
  },
  motor: {
    normal: { motorTemp: 65, current: 8.4, vibration: 1.8, brakeForce: 92 },
    mid: { motorTemp: 88, current: 14.5, vibration: 3.2, brakeForce: 88 },
    critical: { motorTemp: 108, current: 22.0, vibration: 6.5, brakeForce: 80 },
  },
  bearing: {
    normal: { vibration: 1.8, bearingTemp: 65, motorTemp: 65, brakeForce: 92 },
    mid: { vibration: 4.5, bearingTemp: 78, motorTemp: 72, brakeForce: 88 },
    critical: { vibration: 8.2, bearingTemp: 95, motorTemp: 85, brakeForce: 82 },
  },
  controller: {
    normal: { current: 8.4, motorTemp: 65, vibration: 1.8, brakeForce: 92 },
    mid: { current: 16.5, motorTemp: 76, vibration: 2.8, brakeForce: 88 },
    critical: { current: 24.5, motorTemp: 92, vibration: 5.2, brakeForce: 80 },
  },
  rope: {
    normal: { vibration: 1.8, load: 650, motorTemp: 65, brakeForce: 92 },
    mid: { vibration: 3.8, load: 950, motorTemp: 72, brakeForce: 86 },
    critical: { vibration: 7.0, load: 1350, motorTemp: 84, brakeForce: 78 },
  },
  door: {
    normal: { doorCycles: 40, motorTemp: 65, vibration: 1.8, brakeForce: 92 },
    mid: { doorCycles: 140, motorTemp: 72, vibration: 2.6, brakeForce: 88 },
    critical: { doorCycles: 260, motorTemp: 82, vibration: 4.8, brakeForce: 82 },
  },
  pulley: {
    normal: { vibration: 1.8, load: 650, motorTemp: 65, brakeForce: 92 },
    mid: { vibration: 3.8, load: 900, motorTemp: 72, brakeForce: 86 },
    critical: { vibration: 6.8, load: 1200, motorTemp: 84, brakeForce: 78 },
  },
  counterweight: {
    normal: { vibration: 1.8, load: 650, motorTemp: 65, brakeForce: 92 },
    mid: { vibration: 3.5, load: 950, motorTemp: 70, brakeForce: 88 },
    critical: { vibration: 6.2, load: 1300, motorTemp: 80, brakeForce: 80 },
  },
  guide_rail: {
    normal: { vibration: 1.8, speed: 2.5, motorTemp: 65, brakeForce: 92 },
    mid: { vibration: 4.2, speed: 2.8, motorTemp: 74, brakeForce: 86 },
    critical: { vibration: 7.8, speed: 3.2, motorTemp: 88, brakeForce: 76 },
  },
  cabin: {
    normal: { load: 650, speed: 2.5, vibration: 1.8, motorTemp: 65, brakeForce: 92 },
    mid: { load: 1000, speed: 2.8, vibration: 3.2, motorTemp: 74, brakeForce: 86 },
    critical: { load: 1450, speed: 3.2, vibration: 6.2, motorTemp: 88, brakeForce: 76 },
  },
  shaft: {
    normal: { motorTemp: 65, bearingTemp: 65, vibration: 1.8, brakeForce: 92 },
    mid: { motorTemp: 80, bearingTemp: 78, vibration: 3.2, brakeForce: 86 },
    critical: { motorTemp: 96, bearingTemp: 92, vibration: 5.8, brakeForce: 78 },
  },
}

export default function TwinTab() {
  const { prediction, selectedComponent, focusComponent, setSelectedComponent, telemetry: t, runSimulation, simulating, run } = useAnodos()
  const comps = selectComponents(prediction)
  const sel = comps.find((c) => c.id === selectedComponent)

  const [selectedCompId, setSelectedCompId] = useState<CompId>('brake')
  const [severityLevel, setSeverityLevel] = useState<SeverityLevel>('mid')
  const [vals, setVals] = useState<Telemetry>(BASE)

  const applyPreset = (compId: CompId, level: SeverityLevel) => {
    const preset = SEVERITY_PRESETS[compId]?.[level] || {}
    setVals((prev) => ({ ...prev, ...preset }))
  }

  const handleSelectComponent = (compId: CompId) => {
    setSelectedCompId(compId)
    setSelectedComponent(compId)
    applyPreset(compId, severityLevel)
  }

  const handleSelectSeverity = (level: SeverityLevel) => {
    setSeverityLevel(level)
    applyPreset(selectedCompId, level)
  }

  const handleHighlightComponent = (comp: CompId) => {
    setSelectedComponent(comp)
    focusComponent(comp)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleRunSimulation = async () => {
    setSelectedComponent(selectedCompId)
    await runSimulation('normal', { ...vals, target_component: selectedCompId, component: selectedCompId } as any)
  }

  const readings: Record<string, [string, string][]> = {
    motor: [['Temperature', `${t.motorTemp} °C`], ['Current', `${t.current} A`], ['Vibration', `${t.vibration} mm/s`]],
    bearing: [['Bearing temp', `${t.bearingTemp} °C`], ['Vibration', `${t.vibration} mm/s`]],
    brake: [['Brake force', `${t.brakeForce} %`], ['Load', `${t.load} kg`]],
    door: [['Door cycles', `${t.doorCycles}`]],
    controller: [['Speed', `${t.speed} m/s`]],
    pulley: [['Load', `${t.load} kg`]],
    rope: [['Load', `${t.load} kg`]],
    counterweight: [['Load', `${t.load} kg`]],
    guide_rail: [['Speed', `${t.speed} m/s`]],
    cabin: [['Speed', `${t.speed} m/s`]],
    shaft: [['Operating hours', `${t.hours} h`]],
  }

  return (
    <div className="space-y-6">
      {/* 3D TWIN HERO & SIDEBAR INSPECTOR */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Central 3D Digital Twin Viewer */}
        <Panel title="Digital Twin" className="lg:col-span-2" right={<span className="text-xs font-bold text-ok">● LIVE</span>}>
          <DigitalTwinViewer height={520} />
        </Panel>

        {/* Component Inspector & Components List */}
        <div className="space-y-5">
          <Panel title="Component Inspector">
            {!sel ? (
              <Empty>Click a part in the 3D model or pick one below</Empty>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-extrabold">{sel.name}</h2>
                  <Badge health={sel.health} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>Component stress</span>
                    <span className="font-bold text-ink">{sel.risk}%</span>
                  </div>
                  <RiskBar risk={sel.risk} health={sel.health} />
                </div>
                <dl className="space-y-2 text-sm">
                  {(readings[sel.id] || []).map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-line/50 pb-1.5">
                      <dt className="text-muted">{k}</dt>
                      <dd className="font-bold tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-sm text-muted">{sel.health === 'normal' ? 'Nominal operational state.' : prediction?.explanation}</p>
                <button className="btn-primary w-full" onClick={() => handleHighlightComponent(sel.id)}>
                  <Crosshair size={16} /> Focus camera
                </button>
              </div>
            )}
          </Panel>

          <Panel title="Components">
            <ul className="space-y-1.5">
              {comps.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => handleHighlightComponent(c.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                      c.id === selectedComponent ? 'bg-accent/15' : 'hover:bg-raised'
                    }`}
                  >
                    <span className="font-semibold">{c.name}</span>
                    <Badge health={c.health}>
                      {c.risk}% · {HEALTH_LABEL[c.health]}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
            {prediction && prediction.risk >= 60 && (
              <p className="mt-3 rounded-lg bg-fault/10 p-3 text-xs font-semibold text-fault">
                Incident detected · {compName(prediction.component)}
              </p>
            )}
          </Panel>
        </div>
      </div>

      {/* INTEGRATED DIGITAL TWIN SIMULATION CONTROLS (UNDER 3D TWIN) */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-line/60 pb-3">
          <Sliders size={20} className="text-accent" />
          <h2 className="text-lg font-bold text-ink">Component Fault Injector & Telemetry Tuning</h2>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Component Selection & Severity Controls */}
          <Panel title="Simulation Controls">
            {/* Target Component Dropdown & Severity Presets */}
            <div className="space-y-4 mb-6 border-b border-line/60 pb-4">
              <div>
                <label className="block text-xs font-extrabold text-ink mb-1.5 uppercase tracking-wider">
                  Target Component
                </label>
                <select
                  value={selectedCompId}
                  onChange={(e) => handleSelectComponent(e.target.value as CompId)}
                  className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm font-bold text-ink shadow-sm focus:border-accent focus:outline-none"
                >
                  {COMPONENT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-ink mb-1.5 uppercase tracking-wider">
                  Fault Condition Preset
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['normal', 'mid', 'critical'] as SeverityLevel[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => handleSelectSeverity(level)}
                      className={`rounded-lg border py-2.5 text-xs font-extrabold uppercase transition text-center ${
                        severityLevel === level
                          ? level === 'normal'
                            ? 'border-ok bg-ok/15 text-ok shadow-sm'
                            : level === 'mid'
                            ? 'border-warn bg-warn/15 text-warn shadow-sm'
                            : 'border-fault bg-fault/15 text-fault shadow-sm'
                          : 'border-line bg-raised text-muted hover:text-ink'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Telemetry Sliders */}
            <div className="space-y-4">
              {FIELDS.map((f) => (
                <div key={f.k}>
                  <div className="mb-1.5 flex justify-between text-xs font-semibold">
                    <label className="text-ink">{f.label}</label>
                    <span className="font-mono font-bold text-ink">
                      {vals[f.k]} <span className="text-muted">{f.unit}</span>
                    </span>
                  </div>
                  <input
                    type="range"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={vals[f.k]}
                    onChange={(e) => setVals({ ...vals, [f.k]: +e.target.value })}
                    className="w-full cursor-pointer accent-accent"
                  />
                </div>
              ))}
            </div>

            <button
              className="btn-primary mt-6 w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2"
              disabled={simulating}
              onClick={handleRunSimulation}
            >
              <Play size={16} />
              {simulating ? 'Simulating Fault...' : 'RUN SIMULATION'}
            </button>
          </Panel>

          {/* Simulation AI Results */}
          <Panel
            title="Simulation AI Diagnostic Output"
            right={run && <span className="text-[11px] font-mono text-muted">{run.source === 'backend' ? 'Authoritative Backend' : 'Demo Fallback'}</span>}
          >
            {!prediction ? (
              <div className="grid h-56 place-items-center text-xs text-muted">
                Run a simulation scenario above to observe real-time AI component stress on the 3D twin.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center py-2">
                  <div
                    className={`text-5xl font-black tabular-nums ${
                      healthOf(prediction.risk) === 'normal'
                        ? 'text-ok'
                        : healthOf(prediction.risk) === 'warning'
                        ? 'text-warn'
                        : healthOf(prediction.risk) === 'high'
                        ? 'text-high'
                        : 'text-fault'
                    }`}
                  >
                    {prediction.risk}%
                  </div>
                  <div className="label mt-1 text-xs uppercase font-bold text-muted">Predicted Failure Risk</div>
                </div>

                <dl className="space-y-2 text-xs">
                  {([
                    ['Fault State', <Badge key="s" health={healthOf(prediction.risk)}>{prediction.faultState}</Badge>],
                    ['Target Component', compName(prediction.component)],
                    ['Severity Level', prediction.severity],
                    ['Remaining Useful Life (RUL)', `${prediction.rulHours} hours`],
                  ] as [string, React.ReactNode][]).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between border-b border-line/50 pb-2">
                      <dt className="text-muted font-medium">{k}</dt>
                      <dd className="font-bold text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>

                <button
                  className="btn-ghost w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition hover:bg-raised"
                  onClick={() => handleHighlightComponent(selectedCompId || prediction.component)}
                >
                  <ArrowUp size={15} /> Highlight Component in 3D Viewer
                </button>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
