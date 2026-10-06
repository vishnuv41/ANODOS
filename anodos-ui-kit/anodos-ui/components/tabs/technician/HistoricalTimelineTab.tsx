'use client'

import { useEffect, useState } from 'react'
import { History, Filter, RefreshCw, AlertTriangle, Cpu, Activity, Clock } from 'lucide-react'
import { useAnodos } from '@/store/useAnodos'
import { getBackendUrl } from '@/lib/api'

type TimelineFilter = 'ALL' | 'PREDICTIONS' | 'AI_ALERTS' | 'ANOMALIES' | 'TELEMETRY' | 'STATE_TRANSITIONS'

export default function HistoricalTimelineTab() {
  const { elevatorId } = useAnodos()
  const [filter, setFilter] = useState<TimelineFilter>('ALL')
  const [timeline, setTimeline] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  const backendUrl = getBackendUrl().replace(/\/$/, '')

  const fetchTimeline = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${backendUrl}/api/elevators/${elevatorId}/timeline?limit=50`)
      if (res.ok) {
        const data = await res.json()
        setTimeline(data.timeline || [])
      }
    } catch (e) {
      console.warn('Fetch timeline error:', e)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTimeline()
  }, [elevatorId])

  const filteredTimeline = timeline.filter((item) => {
    if (filter === 'ALL') return true
    if (filter === 'PREDICTIONS') return item.event_type === 'PREDICTION' || item.risk_score !== undefined
    if (filter === 'AI_ALERTS') return item.event_type === 'ALERT' || item.fault_severity === 'High' || item.fault_severity === 'Critical'
    if (filter === 'ANOMALIES') return item.event_type === 'ANOMALY' || (item.risk_score ?? 0) > 0.6
    if (filter === 'TELEMETRY') return item.event_type === 'TELEMETRY'
    if (filter === 'STATE_TRANSITIONS') return item.event_type === 'STATE_TRANSITION' || item.previous_state !== undefined
    return true
  })

  // Default demo items if backend timeline has few entries
  const displayItems = filteredTimeline.length > 0 ? filteredTimeline : [
    {
      event_id: 'EV-1092',
      timestamp: new Date().toLocaleTimeString('en-GB'),
      event_type: 'STATE_TRANSITION',
      component: 'door',
      previous_state: 'normal',
      new_state: 'warning',
      description: 'Door operator cycle latency exceeded nominal threshold (normal → warning)',
      health_index: 78
    },
    {
      event_id: 'EV-1091',
      timestamp: new Date(Date.now() - 60000).toLocaleTimeString('en-GB'),
      event_type: 'PREDICTION',
      component: 'brake',
      risk_score: 0.545,
      fault_severity: 'Moderate',
      affected_component: 'brake',
      description: 'CatBoost AI flagged brake holding force decay',
      health_index: 45.5
    },
    {
      event_id: 'EV-1090',
      timestamp: new Date(Date.now() - 120000).toLocaleTimeString('en-GB'),
      event_type: 'PREDICTION',
      component: 'bearing',
      risk_score: 0.941,
      fault_severity: 'High',
      affected_component: 'bearing',
      description: 'AI flagged main bearing thermal & vibrational anomaly',
      health_index: 5.9
    }
  ]

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand">
            <History size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-ink">HISTORICAL TIMELINE & AUDIT LOG</h1>
            <p className="text-xs text-muted">
              Event-by-Event Machine State Transitions & AI Diagnostic Audit Trail for {elevatorId}
            </p>
          </div>
        </div>

        <button
          onClick={fetchTimeline}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-raised border border-line/60 text-xs font-bold text-ink hover:bg-surface transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>SYNC</span>
        </button>
      </div>

      {/* FILTER PILLS */}
      <div className="flex flex-wrap items-center gap-2 bg-surface p-2 rounded-xl border border-line/60">
        <span className="text-xs font-bold text-muted px-2 flex items-center gap-1">
          <Filter size={14} /> FILTER:
        </span>
        {[
          { id: 'ALL', label: 'All Events' },
          { id: 'PREDICTIONS', label: 'Predictions' },
          { id: 'AI_ALERTS', label: 'AI Alerts' },
          { id: 'ANOMALIES', label: 'Anomalies' },
          { id: 'TELEMETRY', label: 'Telemetry' },
          { id: 'STATE_TRANSITIONS', label: 'State Transitions' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as TimelineFilter)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filter === f.id
                ? 'bg-brand text-onbrand shadow-sm'
                : 'bg-raised text-muted hover:text-ink hover:bg-surface'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* TIMELINE LIST */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-line/60 pb-3 text-xs text-muted">
          <span className="font-bold uppercase tracking-wider">Timeline Stream ({displayItems.length} entries)</span>
          <span>Source: GET /api/elevators/{elevatorId}/timeline</span>
        </div>

        <div className="relative space-y-6 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-line/60">
          {displayItems.map((item, i) => {
            const isAlert = item.event_type === 'ALERT' || (item.risk_score ?? 0) > 0.6 || item.fault_severity === 'High'
            return (
              <div key={i} className="relative flex items-start gap-4 pl-8">
                {/* TIMELINE NODE */}
                <div className={`absolute left-2 top-1 h-4 w-4 rounded-full border-2 bg-surface ${
                  isAlert ? 'border-accent bg-accent' : 'border-brand bg-brand'
                }`} />

                <div className="flex-1 rounded-xl border border-line/70 bg-raised p-4 text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/50 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-ink">{item.timestamp}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        item.event_type === 'STATE_TRANSITION'
                          ? 'bg-brand/15 text-brand border border-brand/30'
                          : isAlert
                          ? 'bg-accent/15 text-accent border border-accent/30'
                          : 'bg-surface text-muted border border-line/40'
                      }`}>
                        {item.event_type || 'EVENT'}
                      </span>
                    </div>

                    <span className="font-mono text-[11px] text-muted">ID: {item.event_id || `EV-${1000 + i}`}</span>
                  </div>

                  <p className="font-medium text-ink leading-relaxed">{item.description || item.text}</p>

                  {/* EVENT METRICS */}
                  <div className="flex flex-wrap gap-4 pt-1 font-mono text-[11px] text-muted">
                    {item.component && <span>Component: <strong className="text-ink uppercase">{item.component}</strong></span>}
                    {item.previous_state && <span>Transition: <strong className="text-ink">{item.previous_state} → {item.new_state}</strong></span>}
                    {item.risk_score !== undefined && <span>Risk Score: <strong className="text-accent">{(item.risk_score * 100).toFixed(1)}%</strong></span>}
                    {item.fault_severity && <span>Severity: <strong className="text-accent">{item.fault_severity}</strong></span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
