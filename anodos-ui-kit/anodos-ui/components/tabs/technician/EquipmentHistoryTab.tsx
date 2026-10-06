'use client'

import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, History, Wrench } from 'lucide-react'
import { useAnodos } from '@/store/useAnodos'
import { fetchEventsHistory } from '@/lib/api'

export default function EquipmentHistoryTab() {
  const { elevatorId, rawBackendState } = useAnodos()
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    async function loadHistory() {
      setLoading(true)
      try {
        const evData = await fetchEventsHistory(elevatorId)
        if (active && Array.isArray(evData)) {
          setEvents(evData)
        } else {
          setEvents([])
        }
      } catch (err) {
        if (active) setEvents([])
      } finally {
        if (active) setLoading(false)
      }
    }
    loadHistory()
    return () => {
      active = false
    }
  }, [elevatorId])

  const explanations = rawBackendState?.explanations || []

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand">
            <History size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-ink">
              Equipment Maintenance & Fault History — {elevatorId}
            </h1>
            <p className="text-xs text-muted">
              Historical Timeline & Sensor Anomaly Logs from Backend Storage
            </p>
          </div>
        </div>
      </div>

      {/* RECENT CURRENT SNAPSHOT SUMMARY */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-bold text-ink mb-3">
          <Activity size={18} className="text-brand" />
          <span>Latest Active AI Diagnostic Explanation</span>
        </h3>
        {rawBackendState?.prediction?.explanation ? (
          <div className="rounded-lg border border-line/70 bg-raised p-4 text-xs font-medium text-ink">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-accent">CatBoost Flagged Fault</span>
              <span className="text-[11px] text-muted">Component: {rawBackendState.prediction.affected_component}</span>
            </div>
            <p>{typeof rawBackendState.prediction.explanation === 'string' ? rawBackendState.prediction.explanation : rawBackendState.prediction.explanation?.text}</p>
          </div>
        ) : (
          <div className="text-xs text-muted italic">No active fault explanation for unit {elevatorId}.</div>
        )}
      </div>

      {/* EVENT TIMELINE */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-ink">Historical Event Logs ({elevatorId})</h3>

        {loading ? (
          <div className="py-8 text-center text-xs text-muted font-medium">Loading event timeline...</div>
        ) : events.length > 0 ? (
          <div className="space-y-3">
            {events.map((ev, idx) => (
              <div key={idx} className="flex items-start gap-4 rounded-lg border border-line/60 bg-raised p-3 text-xs">
                <div className="mt-0.5 rounded-md bg-brand/10 p-1.5 text-brand">
                  <Wrench size={16} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink">{ev.title || ev.type || 'Maintenance Event'}</span>
                    <span className="text-[11px] text-muted">{ev.timestamp || ev.date || 'Recent'}</span>
                  </div>
                  <p className="mt-1 text-muted">{ev.description || ev.details || JSON.stringify(ev)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : explanations.length > 0 ? (
          <div className="space-y-3">
            {explanations.map((exp, idx) => {
              const text = typeof exp === 'string' ? exp : exp.text
              const comp = typeof exp === 'object' ? exp.component_id : undefined
              return (
                <div key={idx} className="flex items-start gap-4 rounded-lg border border-line/60 bg-raised p-3 text-xs">
                  <div className="mt-0.5 rounded-md bg-accent/10 p-1.5 text-accent">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink">Backend Anomaly Entry #{idx + 1}</span>
                      {comp && <span className="text-[11px] font-bold text-brand uppercase">{comp}</span>}
                    </div>
                    <p className="mt-1 text-muted">{text}</p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-line/60 bg-raised/40 py-8 text-center text-xs text-muted">
            No logged historical events found for elevator unit <strong>{elevatorId}</strong>.
          </div>
        )}
      </div>
    </div>
  )
}
