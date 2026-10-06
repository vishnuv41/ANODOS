'use client'

import { useEffect, useState } from 'react'
import { Badge, Panel } from '../../ui/primitives'
import { useAnodos } from '@/store/useAnodos'
import { fetchMaintenanceInfo } from '@/lib/api'
import { Bot, Wrench } from 'lucide-react'

export default function PredictiveMaintenanceTab() {
  const { elevatorId, rawBackendState, prediction } = useAnodos()
  const [maintenance, setMaintenance] = useState<any>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const data = await fetchMaintenanceInfo(elevatorId)
      if (!cancelled) setMaintenance(data)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [elevatorId, rawBackendState])

  const pred = rawBackendState?.prediction || prediction
  const riskScore = maintenance?.risk_score ?? pred?.risk_score ?? 0
  const riskPercent = (riskScore <= 1 ? riskScore * 100 : riskScore).toFixed(2)

  const priority = maintenance?.maintenance_priority || maintenance?.priority || pred?.fault_severity || 'LOW'
  const affected = maintenance?.affected_component || pred?.affected_component || 'motor'
  const action = maintenance?.recommended_action || maintenance?.action || 'System operating normally.'
  const techNote = maintenance?.technician_note || 'Standard preventive maintenance check.'
  const rules = maintenance?.maintenance_rules || rawBackendState?.explanations || []

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line/70 bg-surface/90 p-5 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight text-ink">Predictive Maintenance Analysis</h1>
            <span className="text-xs bg-raised border border-line px-2 py-0.5 rounded font-mono font-bold">{elevatorId}</span>
          </div>
          <p className="text-xs text-muted mt-1">Authoritative Maintenance & Diagnostic Decision Engine</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-muted">Maintenance Priority</div>
            <div className={`text-sm font-extrabold uppercase ${priority === 'URGENT' || priority === 'HIGH' ? 'text-fault' : 'text-ok'}`}>
              {priority}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Panel title="Current Condition & Risk Assessment" className="md:col-span-2">
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-lg border border-line/60 bg-raised/50 p-3">
                <div className="text-xs text-muted font-medium">Risk Score</div>
                <div className="text-2xl font-extrabold text-ink mt-1 tabular-nums">{riskPercent}%</div>
              </div>

              <div className="rounded-lg border border-line/60 bg-raised/50 p-3">
                <div className="text-xs text-muted font-medium">Fault Category</div>
                <div className="text-sm font-bold text-ink mt-1">{pred?.fault_category || 'Braking Force Decay'}</div>
              </div>

              <div className="rounded-lg border border-line/60 bg-raised/50 p-3">
                <div className="text-xs text-muted font-medium">Severity</div>
                <div className="text-sm font-extrabold text-fault mt-1 uppercase">{priority}</div>
              </div>

              <div className="rounded-lg border border-line/60 bg-raised/50 p-3">
                <div className="text-xs text-muted font-medium">Affected Component</div>
                <div className="text-sm font-extrabold text-accent mt-1 capitalize">{affected}</div>
              </div>
            </div>

            <div className="rounded-xl border border-line/60 bg-surface/80 p-4">
              <h3 className="text-xs font-extrabold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Bot size={15} className="text-accent" />
                Backend AI Evidence & Diagnostic Rules
              </h3>
              <ul className="space-y-2 text-xs">
                {rules.length > 0 ? (
                  rules.map((rule: any, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-ink">
                      <span className="text-accent font-bold">•</span>
                      <span>{typeof rule === 'string' ? rule : rule.text || JSON.stringify(rule)}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-muted italic">No diagnostic rule triggers reported by backend.</li>
                )}
              </ul>
            </div>

            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-2">
              <h3 className="text-xs font-extrabold text-accent uppercase tracking-wider flex items-center gap-1.5">
                <Wrench size={15} />
                Recommended Maintenance Action
              </h3>
              <p className="text-sm font-semibold text-ink leading-relaxed">{action}</p>
            </div>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Technician Service Note">
            <p className="text-xs text-ink leading-relaxed bg-raised/60 p-3 rounded-lg border border-line/50">
              {techNote}
            </p>
          </Panel>

          <Panel title="RUL Simulation Units">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted font-medium">Estimated Remaining Useful Life</span>
                <span className="font-extrabold text-ink tabular-nums">{maintenance?.rul ?? 'Data unavailable'}</span>
              </div>
              <div className="text-[11px] text-muted">
                Unit: {maintenance?.rul_unit || 'simulation hours'}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
