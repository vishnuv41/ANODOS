'use client'

import { useEffect, useState } from 'react'
import { Panel } from '../../ui/primitives'
import { useAnodos } from '@/store/useAnodos'
import { fetchModernizationCompare } from '@/lib/api'

export default function CompareTab() {
  const { elevatorId, rawBackendState } = useAnodos()
  const [compareData, setCompareData] = useState<any>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetchModernizationCompare(elevatorId)
      if (!cancelled) setCompareData(res)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [elevatorId, rawBackendState])

  const options = [
    {
      id: 'REPAIR_PART',
      name: 'Option A: Repair Part',
      currentCondition: 'Degraded / High Stress',
      benefits: ['Lowest upfront capital expense', 'Minimal installation disturbance', 'Shortest intervention lead time'],
      limitations: ['Relying on aging surrounding machinery', 'Shorter extended lifespan', 'Potential for subsequent component failures'],
      cost: 'Data unavailable',
      costNote: 'Pricing integration required',
      downtime: 'Data unavailable',
      schedule: 'Scheduling integration required',
      projectedResult: 'Restores component to operational envelope; surrounding assembly remains at current age.',
    },
    {
      id: 'REPLACE_MODERNIZE_SECTION',
      name: 'Option B: Replace / Modernize Section',
      currentCondition: 'Degraded / High Stress',
      benefits: ['Upgrades primary drive unit to modern VVVF standard', 'Significantly improved energy efficiency', 'Reduces vibrational noise'],
      limitations: ['Requires specialized hoisting equipment', 'Moderate shaft access interruption'],
      cost: 'Data unavailable',
      costNote: 'Pricing integration required',
      downtime: 'Data unavailable',
      schedule: 'Scheduling integration required',
      projectedResult: 'Upgrades drive subsystem; extends primary equipment lifecycle.',
    },
    {
      id: 'FULL_REPLACEMENT',
      name: 'Option C: Full Replacement',
      currentCondition: 'Degraded / High Stress',
      benefits: ['Complete 25-year lifecycle reset', 'Full compliance with latest EN81 safety codes', 'Maximum ride quality and efficiency'],
      limitations: ['Highest capital commitment', 'Extended building outage duration'],
      cost: 'Data unavailable',
      costNote: 'Pricing integration required',
      downtime: 'Data unavailable',
      schedule: 'Scheduling integration required',
      projectedResult: 'Entire elevator system replaced with modern digital technology.',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line/70 bg-surface/90 p-5 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight text-ink">Modernization Option Comparison Matrix</h1>
            <span className="text-xs bg-raised border border-line px-2 py-0.5 rounded font-mono font-bold">{elevatorId}</span>
          </div>
          <p className="text-xs text-muted mt-1">Factual Engineering Comparison Matrix for Manager Decision-Making</p>
        </div>
      </div>

      <Panel title="Factual Engineering Comparison Matrix">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line/70 bg-raised/60">
                <th className="p-3 font-bold text-muted w-1/5">Attribute</th>
                {options.map((opt) => (
                  <th key={opt.id} className="p-3 font-extrabold text-ink w-1/4 border-l border-line/50">
                    {opt.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              <tr>
                <td className="p-3 font-bold text-muted bg-raised/30">Current Condition</td>
                {options.map((opt) => (
                  <td key={opt.id} className="p-3 font-medium text-ink border-l border-line/50">
                    {opt.currentCondition}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-bold text-muted bg-raised/30">Key Benefits</td>
                {options.map((opt) => (
                  <td key={opt.id} className="p-3 border-l border-line/50">
                    <ul className="space-y-1 list-disc list-inside text-ink">
                      {opt.benefits.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-bold text-muted bg-raised/30">Limitations</td>
                {options.map((opt) => (
                  <td key={opt.id} className="p-3 border-l border-line/50">
                    <ul className="space-y-1 list-disc list-inside text-muted">
                      {opt.limitations.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-bold text-muted bg-raised/30">Estimated Cost</td>
                {options.map((opt) => (
                  <td key={opt.id} className="p-3 border-l border-line/50">
                    <div className="font-bold text-ink">{opt.cost}</div>
                    <div className="text-[10px] text-muted">{opt.costNote}</div>
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-bold text-muted bg-raised/30">Downtime Duration</td>
                {options.map((opt) => (
                  <td key={opt.id} className="p-3 border-l border-line/50 font-bold text-ink">
                    {opt.downtime}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-bold text-muted bg-raised/30">Schedule</td>
                {options.map((opt) => (
                  <td key={opt.id} className="p-3 border-l border-line/50">
                    <div className="font-bold text-ink">{opt.schedule}</div>
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-bold text-muted bg-raised/30">Projected Result</td>
                {options.map((opt) => (
                  <td key={opt.id} className="p-3 border-l border-line/50 text-muted leading-relaxed">
                    {opt.projectedResult}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
