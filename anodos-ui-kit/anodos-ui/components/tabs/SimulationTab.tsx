'use client'
import { useState } from 'react'
import { ArrowRight, Play } from 'lucide-react'
import { BASE, compName, healthOf, SCENARIOS, ScenarioId, useAnodos } from '@/store/useAnodos'
import type { Telemetry } from '@/lib/types'
import { Badge, Panel } from '../ui/primitives'

const FIELDS: { k: keyof Telemetry; label: string; unit: string; min: number; max: number; step: number }[] = [
  { k: 'motorTemp', label: 'Motor Temperature', unit: '°C', min: 30, max: 130, step: 1 },
  { k: 'vibration', label: 'Vibration', unit: 'mm/s', min: 0, max: 12, step: 0.1 },
  { k: 'current', label: 'Motor Current', unit: 'A', min: 0, max: 20, step: 0.1 },
  { k: 'brakeForce', label: 'Brake Force', unit: '%', min: 0, max: 100, step: 1 },
]

export default function SimulationTab() {
  const { runSimulation, simulating, prediction: p, run, setActiveTab, focusComponent } = useAnodos()
  const [scenario, setScenario] = useState<ScenarioId>('normal')
  const [vals, setVals] = useState<Telemetry>(BASE)
  const pick = (id: ScenarioId) => { setScenario(id); setVals({ ...BASE, ...SCENARIOS[id].overrides }) }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Select Scenario">
        <div className="mb-6 grid grid-cols-2 gap-2">
          {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
            <button key={id} onClick={() => pick(id)} className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${scenario === id ? 'border-accent bg-accent/15 text-ink' : 'border-line bg-raised text-muted hover:text-ink'}`}>{SCENARIOS[id].label}</button>
          ))}
        </div>
        <div className="space-y-5">
          {FIELDS.map((f) => (
            <div key={f.k}>
              <div className="mb-2 flex justify-between text-sm"><label className="font-semibold">{f.label}</label>
                <span className="font-mono font-bold">{vals[f.k]} <span className="text-muted">{f.unit}</span></span></div>
              <input type="range" min={f.min} max={f.max} step={f.step} value={vals[f.k]} onChange={(e) => setVals({ ...vals, [f.k]: +e.target.value })} />
            </div>
          ))}
        </div>
        <button className="btn-primary mt-7 w-full py-3" disabled={simulating} onClick={() => runSimulation(scenario, vals)}>
          <Play size={16} />{simulating ? 'Running…' : 'RUN SIMULATION'}
        </button>
      </Panel>

      <Panel title="Simulation Result" right={run && <span className="text-[11px] font-mono text-muted">{run.source === 'backend' ? 'backend' : 'demo fallback'}</span>}>
        {!p ? <div className="grid h-64 place-items-center text-sm text-muted">Run a simulation to see the AI result</div> : (
          <div className="space-y-5">
            <div className="text-center"><div className={`text-6xl font-black tabular-nums ${healthOf(p.risk) === 'normal' ? 'text-ok' : healthOf(p.risk) === 'warning' ? 'text-warn' : healthOf(p.risk) === 'high' ? 'text-high' : 'text-fault'}`}>{p.risk}%</div><div className="label mt-1">failure risk</div></div>
            <dl className="space-y-2.5 text-sm">
              {([['State', <Badge key="s" health={healthOf(p.risk)}>{p.faultState}</Badge>], ['Affected component', compName(p.component)], ['Severity', p.severity], ['RUL', `${p.rulHours} hours`]] as [string, React.ReactNode][]).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-line/50 pb-2"><dt className="text-muted">{k}</dt><dd className="font-bold">{v}</dd></div>
              ))}
            </dl>
            <button className="btn-ghost w-full" onClick={() => { focusComponent(p.component); setActiveTab('twin') }}>View in Digital Twin <ArrowRight size={16} /></button>
          </div>
        )}
      </Panel>
    </div>
  )
}
