'use client'

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { compName, healthOf, HEALTH_LABEL, selectComponents, useAnodos } from '@/store/useAnodos'
import DigitalTwinViewer from '../twin/DigitalTwinViewer'
import { Badge, Panel, RiskBar, Stat } from '../ui/primitives'

export default function Overview() {
  const { prediction: p, rawBackendState, telemetry: t, trend, incidents, elevatorId, setActiveTab, setSelectedComponent } = useAnodos()
  const risk = p?.risk ?? 2
  const health = healthOf(risk)
  const comps = selectComponents(p, rawBackendState)

  const rawTel = rawBackendState?.telemetry

  const fmt = (val: number | null | undefined, unit: string = '') => {
    if (val === null || val === undefined) return 'Data unavailable'
    return `${val} ${unit}`.trim()
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Elevator {elevatorId}</h1>
          <p className="text-sm text-muted">Traction Elevator · Building A · Floor 07</p>
        </div>
        <Badge health={health}>{health === 'fault' ? 'FAULT DETECTED' : 'OPERATIONAL'}</Badge>
      </div>

      {/* FULL WIDTH 4 KPI STAT CARDS ROW */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 w-full">
        <Stat label="HEALTH" value={HEALTH_LABEL[health]} tone={health} />
        <Stat label="FAILURE RISK" value={risk} unit="%" tone={health} />
        <Stat label="REMAINING LIFE" value={p?.rulHours ?? 998} unit="h" />
        <Stat label="STATE" value={p?.faultState ?? 'normal'} tone={health} />
      </div>

      {/* ROW 1: Digital Twin on LEFT (8 cols) | AI Prediction + Live Telemetry on RIGHT (4 cols) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Side (8 cols): 3D Elevator Digital Twin */}
        <div className="lg:col-span-8">
          <Panel
            title={`ANODOS Elevator Digital Twin — ${elevatorId}`}
            right={
              <span className="flex items-center gap-1.5 text-xs font-bold text-ok">
                <span className="h-2 w-2 rounded-full bg-ok animate-pulse" />
                ● LIVE
              </span>
            }
          >
            <DigitalTwinViewer height={440} />
          </Panel>
        </div>

        {/* Right Side (4 cols): AI Prediction + Live Telemetry */}
        <div className="lg:col-span-4 space-y-4">
          {/* AI Prediction Panel */}
          <Panel title="AI PREDICTION" className="border-accent/40 bg-surface">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-line/50 pb-2">
                <dt className="text-muted font-medium">Risk</dt>
                <dd className="font-bold text-ink">{risk}%</dd>
              </div>
              <div className="flex justify-between border-b border-line/50 pb-2">
                <dt className="text-muted font-medium">Confidence</dt>
                <dd className="font-bold text-ink">{p?.confidence ?? 89}%</dd>
              </div>
              <div className="flex justify-between border-b border-line/50 pb-2">
                <dt className="text-muted font-medium">Horizon</dt>
                <dd className="font-bold text-ink">{p?.horizonH ?? 24} h</dd>
              </div>
              <div className="flex justify-between border-b border-line/50 pb-2">
                <dt className="text-muted font-medium">Affected</dt>
                <dd className="font-bold text-ink capitalize">{p ? compName(p.component) : 'Traction Motor'}</dd>
              </div>
            </dl>
            <button
              className="mt-4 w-full rounded-xl border border-line bg-raised py-2 text-xs font-bold text-ink transition hover:bg-surface"
              onClick={() => setActiveTab('ai')}
            >
              Open AI details
            </button>
          </Panel>

          {/* Live Telemetry Panel (Down to AI Prediction) */}
          <Panel title="LIVE TELEMETRY" className="bg-surface">
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-line/40 pb-1.5">
                <dt className="text-muted font-medium">Motor Temp</dt>
                <dd className="font-bold tabular-nums text-ink">{fmt(rawTel?.motor_temperature ?? t.motorTemp, '°C')}</dd>
              </div>
              <div className="flex justify-between border-b border-line/40 pb-1.5">
                <dt className="text-muted font-medium">Vibration</dt>
                <dd className="font-bold tabular-nums text-ink">{fmt(rawTel?.vibration_level ?? t.vibration, 'mm/s')}</dd>
              </div>
              <div className="flex justify-between border-b border-line/40 pb-1.5">
                <dt className="text-muted font-medium">Motor Current</dt>
                <dd className="font-bold tabular-nums text-ink">{fmt(rawTel?.motor_current ?? t.current, 'A')}</dd>
              </div>
              <div className="flex justify-between border-b border-line/40 pb-1.5">
                <dt className="text-muted font-medium">Speed</dt>
                <dd className="font-bold tabular-nums text-ink">{fmt(rawTel?.speed ?? t.speed, 'm/s')}</dd>
              </div>
              <div className="flex justify-between border-b border-line/40 pb-1.5">
                <dt className="text-muted font-medium">Load</dt>
                <dd className="font-bold tabular-nums text-ink">{fmt(rawTel?.load ?? t.load, 'kg')}</dd>
              </div>
              <div className="flex justify-between border-b border-line/40 pb-1.5">
                <dt className="text-muted font-medium">Bearing Temp</dt>
                <dd className="font-bold tabular-nums text-ink">{fmt(rawTel?.bearing_temperature ?? t.bearingTemp, '°C')}</dd>
              </div>
              <div className="flex justify-between border-b border-line/40 pb-1.5">
                <dt className="text-muted font-medium">Operating Hrs</dt>
                <dd className="font-bold tabular-nums text-ink">{fmt(rawTel?.operating_hours ?? t.hours, 'h')}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>

      {/* ROW 2: Component Status · highest risk first on LEFT | Recent Incidents on RIGHT */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Panel title="Component Status · highest risk first" className="lg:col-span-7">
          <ul className="space-y-3">
            {comps.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => {
                    setSelectedComponent(c.id)
                    setActiveTab('twin')
                  }}
                  className="group w-full text-left"
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold group-hover:text-accent text-ink">{c.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-muted">{c.risk}%</span>
                      <Badge health={c.health} />
                    </span>
                  </div>
                  <RiskBar risk={c.risk} health={c.health} />
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Recent Incidents" className="lg:col-span-5">
          {incidents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line/70 p-6 text-center text-xs font-semibold text-muted">
              No active incidents
            </div>
          ) : (
            <ul className="space-y-2">
              {incidents.slice(0, 4).map((i) => (
                <li key={i.id} className="flex items-center justify-between rounded-lg bg-raised px-3 py-2 text-sm">
                  <span className="font-semibold text-ink">{i.title}</span>
                  <Badge health={healthOf(i.risk)}>{i.risk}%</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ROW 3: Health Trend graph on LEFT | ATTENTION REQUIRED on RIGHT */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Panel title="Health Trend" className="lg:col-span-7">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgb(var(--line))" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="t" tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
                <Tooltip contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', borderRadius: 8 }} />
                <Area dataKey="health" stroke="rgb(var(--accent))" strokeWidth={2.5} fill="url(#hg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="ATTENTION REQUIRED" className="lg:col-span-5">
          {risk >= 60 ? (
            <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-xs font-semibold text-accent flex items-start gap-3">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm">High Risk Detected</span>
                <span>Component {compName(p?.component || 'motor')} is operating at elevated stress levels. Action required.</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-ok/30 bg-ok/10 p-6 text-center text-xs font-bold text-ok flex flex-col items-center justify-center gap-2">
              <CheckCircle2 size={24} className="text-ok" />
              <span>✓ No active issues</span>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
