'use client'

import { Bot } from 'lucide-react'
import { HEALTH_LABEL, selectComponents, useAnodos } from '@/store/useAnodos'
import DigitalTwinViewer from '../twin/DigitalTwinViewer'
import { Badge, Panel } from '../ui/primitives'

export default function DigitalTwinTab() {
  const { elevatorId, rawBackendState, prediction, selectedComponent, focusComponent, telemetry: t } = useAnodos()
  const comps = selectComponents(prediction, rawBackendState)
  const sel = comps.find((c) => c.id === selectedComponent)

  const rawTel = rawBackendState?.telemetry
  const pred = rawBackendState?.prediction || prediction
  const snapshot = pred?.feature_snapshot

  const fmt = (val: number | null | undefined, unit: string = '') => {
    if (val === null || val === undefined) return 'Data unavailable'
    return `${val} ${unit}`.trim()
  }

  const rawRiskVal = pred?.risk_score ?? prediction?.risk ?? 0
  const riskPercent = (rawRiskVal <= 1 ? rawRiskVal * 100 : rawRiskVal).toFixed(2)

  return (
    <div className="flex flex-col gap-6">
      {/* Hero 3D Digital Twin Layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Central Hero: 3D Elevator Twin */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          <Panel
            title={`ANODOS Elevator Digital Twin — ${elevatorId}`}
            right={
              <span className="flex items-center gap-1.5 text-xs font-bold text-ok">
                <span className="h-2 w-2 rounded-full bg-ok animate-pulse" />
                ● AUTHORITATIVE BACKEND MODEL
              </span>
            }
          >
            <DigitalTwinViewer height={520} />
          </Panel>

          {/* AI Model Input / Feature Snapshot */}
          <Panel title="CatBoost AI Model Input / Feature Snapshot" className="bg-surface/90">
            <div className="flex items-center justify-between mb-3 text-xs font-semibold text-muted">
              <span>Source Dataset: <strong className="text-ink">{pred?.feature_source || (snapshot ? 'unseen_dataset' : 'Data unavailable')}</strong></span>
              <span className="text-[11px] bg-raised px-2 py-0.5 rounded border border-line/50">Raw Engine Features</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-lg border border-line/50 p-2.5 bg-raised/50">
                <div className="text-muted text-[11px]">Load</div>
                <div className="font-bold text-ink mt-0.5">{fmt(snapshot?.load ?? rawTel?.load, 'kg')}</div>
              </div>
              <div className="rounded-lg border border-line/50 p-2.5 bg-raised/50">
                <div className="text-muted text-[11px]">Speed</div>
                <div className="font-bold text-ink mt-0.5">{fmt(snapshot?.speed ?? rawTel?.speed, 'm/s')}</div>
              </div>
              <div className="rounded-lg border border-line/50 p-2.5 bg-raised/50">
                <div className="text-muted text-[11px]">Vibration</div>
                <div className="font-bold text-ink mt-0.5">{fmt(snapshot?.vibration ?? rawTel?.vibration_level, 'mm/s')}</div>
              </div>
              <div className="rounded-lg border border-line/50 p-2.5 bg-raised/50">
                <div className="text-muted text-[11px]">Motor Current</div>
                <div className="font-bold text-ink mt-0.5">{fmt(snapshot?.motor_current ?? rawTel?.motor_current, 'A')}</div>
              </div>
              <div className="rounded-lg border border-line/50 p-2.5 bg-raised/50">
                <div className="text-muted text-[11px]">Motor Temp</div>
                <div className="font-bold text-ink mt-0.5">{fmt(snapshot?.motor_temperature ?? rawTel?.motor_temperature, '°C')}</div>
              </div>
              <div className="rounded-lg border border-line/50 p-2.5 bg-raised/50">
                <div className="text-muted text-[11px]">Door Cycles</div>
                <div className="font-bold text-ink mt-0.5">{fmt(snapshot?.door_cycles ?? rawTel?.door_cycles)}</div>
              </div>
              <div className="rounded-lg border border-line/50 p-2.5 bg-raised/50">
                <div className="text-muted text-[11px]">Brake Force</div>
                <div className="font-bold text-ink mt-0.5">{fmt(snapshot?.brake_force ?? rawTel?.brake_force, '%')}</div>
              </div>
              <div className="rounded-lg border border-line/50 p-2.5 bg-raised/50">
                <div className="text-muted text-[11px]">Operating Hours</div>
                <div className="font-bold text-ink mt-0.5">{fmt(snapshot?.operating_hours ?? rawTel?.operating_hours, 'h')}</div>
              </div>
            </div>
          </Panel>
        </div>

        {/* Right Sidebar: AI Prediction & Telemetry */}
        <div className="lg:col-span-4 space-y-5">
          {/* AI Prediction Panel */}
          <Panel title="AI Prediction Panel" className="border-accent/40 bg-accent/5">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-line/60 pb-3">
                <div>
                  <div className="text-xs font-semibold text-muted">Risk Score</div>
                  <div className="text-3xl font-extrabold text-ink tabular-nums">{riskPercent}%</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-muted">Severity</div>
                  <span className={`inline-block mt-1 px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                    (pred?.fault_severity || 'LOW').toLowerCase() === 'high' ? 'bg-fault/15 text-fault border border-fault/30' : 'bg-ok/15 text-ok'
                  }`}>
                    {pred?.fault_severity || 'LOW'}
                  </span>
                </div>
              </div>

              <dl className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-line/40 pb-1.5">
                  <dt className="text-muted font-medium">Fault Category</dt>
                  <dd className="font-bold text-ink">{pred?.fault_category || 'Braking Force Decay'}</dd>
                </div>
                <div className="flex justify-between border-b border-line/40 pb-1.5">
                  <dt className="text-muted font-medium">Affected Component</dt>
                  <dd className="font-bold text-ink capitalize">{pred?.affected_component || 'brake'}</dd>
                </div>
                <div className="flex justify-between border-b border-line/40 pb-1.5">
                  <dt className="text-muted font-medium">Feature Source</dt>
                  <dd className="font-bold text-accent">{pred?.feature_source || 'unseen_dataset'}</dd>
                </div>
              </dl>

              {/* AI Explanation */}
              <div className="rounded-lg bg-surface p-3 border border-line/60 text-xs">
                <div className="font-bold text-muted mb-1 flex items-center gap-1.5">
                  <Bot size={14} className="text-accent" />
                  Backend AI Explanation
                </div>
                <p className="text-ink leading-relaxed">
                  {rawBackendState?.explanations?.[0]
                    ? (typeof rawBackendState.explanations[0] === 'string'
                        ? rawBackendState.explanations[0]
                        : rawBackendState.explanations[0].text)
                    : prediction?.explanation || 'Data unavailable'}
                </p>
              </div>
            </div>
          </Panel>

          {/* Live Telemetry Panel */}
          <Panel title="Authoritative Live Telemetry">
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-line/40 pb-1.5">
                <dt className="text-muted">Motor Current</dt>
                <dd className="font-bold tabular-nums">{fmt(rawTel?.motor_current ?? t.current, 'A')}</dd>
              </div>
              <div className="flex justify-between border-b border-line/40 pb-1.5">
                <dt className="text-muted">Motor Voltage</dt>
                <dd className="font-bold tabular-nums">{fmt(rawTel?.motor_voltage, 'V')}</dd>
              </div>
              <div className="flex justify-between border-b border-line/40 pb-1.5">
                <dt className="text-muted">Vibration Level</dt>
                <dd className="font-bold tabular-nums">{fmt(rawTel?.vibration_level ?? t.vibration, 'mm/s')}</dd>
              </div>
              <div className="flex justify-between border-b border-line/40 pb-1.5">
                <dt className="text-muted">Nominal Speed</dt>
                <dd className="font-bold tabular-nums">{fmt(rawTel?.speed ?? t.speed, 'm/s')}</dd>
              </div>
              <div className="flex justify-between border-b border-line/40 pb-1.5">
                <dt className="text-muted">Motor Temperature</dt>
                <dd className="font-bold tabular-nums">{fmt(rawTel?.motor_temperature ?? t.motorTemp, '°C')}</dd>
              </div>
              <div className="flex justify-between border-b border-line/40 pb-1.5">
                <dt className="text-muted">Bearing Temperature</dt>
                <dd className="font-bold tabular-nums">{fmt(rawTel?.bearing_temperature, '°C')}</dd>
              </div>
              <div className="flex justify-between border-b border-line/40 pb-1.5">
                <dt className="text-muted">Door Cycles</dt>
                <dd className="font-bold tabular-nums">{fmt(rawTel?.door_cycles ?? t.doorCycles)}</dd>
              </div>
              <div className="flex justify-between border-b border-line/40 pb-1.5">
                <dt className="text-muted">Cabin Load</dt>
                <dd className="font-bold tabular-nums">{fmt(rawTel?.load ?? t.load, 'kg')}</dd>
              </div>
            </dl>
          </Panel>

          {/* Component States List */}
          <Panel title="Component Health Status">
            <ul className="space-y-1.5">
              {comps.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => focusComponent(c.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition ${
                      c.id === selectedComponent ? 'bg-accent/15 border border-accent/40 font-bold' : 'hover:bg-raised'
                    }`}
                  >
                    <span className="font-semibold">{c.name}</span>
                    <Badge health={c.health === 'high_risk' ? 'high' : c.health}>{HEALTH_LABEL[c.health]}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}
