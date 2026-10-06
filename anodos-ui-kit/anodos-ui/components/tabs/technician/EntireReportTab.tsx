'use client'

import { Activity, CheckCircle2, Cpu, Download, FileText, RefreshCw, ShieldAlert } from 'lucide-react'
import { useAnodos } from '@/store/useAnodos'
import { getBackendUrl } from '@/lib/api'

export default function EntireReportTab() {
  const { rawBackendState, elevatorId, wsStatus, fetchState } = useAnodos()
  const pred = rawBackendState?.prediction
  const telem = rawBackendState?.telemetry
  const features = pred?.feature_snapshot
  const backendUrl = getBackendUrl().replace(/\/$/, '')

  const isLive = wsStatus === 'LIVE'

  const handleDownloadPdf = () => {
    const pdfUrl = `${backendUrl}/api/elevator/${elevatorId}/report/pdf`
    window.open(pdfUrl, '_blank')
  }

  const riskPct = pred?.risk_score !== undefined && pred?.risk_score !== null
    ? (pred.risk_score * 100).toFixed(2) + '%'
    : 'Data unavailable'

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand">
            <FileText size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-ink">
              Comprehensive Service & Inspection Report — {elevatorId}
            </h1>
            <p className="text-xs text-muted">
              Authoritative CatBoost AI Diagnostics & Physical Telemetry Report
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-line bg-raised px-3 py-1 text-xs font-bold text-muted">
            Ref ID: REP-{elevatorId}-2026
          </span>
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-brand/90 shadow-sm"
          >
            <Download size={14} /> Download PDF Report
          </button>
          <button
            onClick={() => fetchState()}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-raised px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-surface"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* RISK & FAULT SUMMARY CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">Elevator Unit</div>
          <div className="mt-1 text-2xl font-black text-ink">{elevatorId}</div>
          <div className="mt-1 text-xs text-muted">Status: {isLive ? 'Live Stream' : 'Cached / Static'}</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">CatBoost Risk Score</div>
          <div className="mt-1 text-2xl font-black text-accent">{riskPct}</div>
          <div className="mt-1 text-xs text-muted font-medium">Model Output (0.00 - 1.00 scale)</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">Fault Severity & State</div>
          <div className="mt-1 text-2xl font-black text-ink">
            {pred?.fault_severity ?? 'Data unavailable'} / {pred?.fault_state ?? 'Data unavailable'}
          </div>
          <div className="mt-1 text-xs text-muted font-medium">Category: {pred?.fault_category ?? 'Data unavailable'}</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">Primary Affected Component</div>
          <div className="mt-1 text-2xl font-black text-ink uppercase">
            {pred?.affected_component ?? 'Data unavailable'}
          </div>
          <div className="mt-1 text-xs text-muted font-medium">Flagged by CatBoost Decision Trees</div>
        </div>
      </div>

      {/* AI DIAGNOSTIC EXPLANATION */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2 font-bold text-ink">
          <ShieldAlert size={18} className="text-accent" />
          <span>Backend AI Diagnostic Explanation</span>
        </div>
        <p className="mt-3 rounded-lg border border-line/60 bg-raised/50 p-4 text-sm leading-relaxed text-ink font-medium">
          {typeof pred?.explanation === 'string'
            ? pred.explanation
            : pred?.explanation?.text ?? (rawBackendState?.explanations?.[0] ? (typeof rawBackendState.explanations[0] === 'string' ? rawBackendState.explanations[0] : rawBackendState.explanations[0].text) : 'Data unavailable')}
        </p>
      </div>

      {/* CATBOOST FEATURE SNAPSHOT */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2 font-bold text-ink mb-4">
          <Cpu size={18} className="text-brand" />
          <span>CatBoost Input Feature Snapshot</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs font-mono">
          <div className="rounded-lg border border-line/70 bg-raised p-3">
            <span className="block text-[11px] font-sans font-bold text-muted">Vibration</span>
            <span className="text-sm font-bold text-ink">{features?.vibration !== undefined && features?.vibration !== null ? `${features.vibration} m/s²` : 'Data unavailable'}</span>
          </div>
          <div className="rounded-lg border border-line/70 bg-raised p-3">
            <span className="block text-[11px] font-sans font-bold text-muted">Motor Current</span>
            <span className="text-sm font-bold text-ink">{features?.motor_current !== undefined && features?.motor_current !== null ? `${features.motor_current} A` : 'Data unavailable'}</span>
          </div>
          <div className="rounded-lg border border-line/70 bg-raised p-3">
            <span className="block text-[11px] font-sans font-bold text-muted">Motor Temp</span>
            <span className="text-sm font-bold text-ink">{features?.motor_temperature !== undefined && features?.motor_temperature !== null ? `${features.motor_temperature} °C` : 'Data unavailable'}</span>
          </div>
          <div className="rounded-lg border border-line/70 bg-raised p-3">
            <span className="block text-[11px] font-sans font-bold text-muted">Speed</span>
            <span className="text-sm font-bold text-ink">{features?.speed !== undefined && features?.speed !== null ? `${features.speed} m/s` : 'Data unavailable'}</span>
          </div>
          <div className="rounded-lg border border-line/70 bg-raised p-3">
            <span className="block text-[11px] font-sans font-bold text-muted">Load</span>
            <span className="text-sm font-bold text-ink">{features?.load !== undefined && features?.load !== null ? `${features.load} kg` : 'Data unavailable'}</span>
          </div>
          <div className="rounded-lg border border-line/70 bg-raised p-3">
            <span className="block text-[11px] font-sans font-bold text-muted">Door Cycles</span>
            <span className="text-sm font-bold text-ink">{features?.door_cycles !== undefined && features?.door_cycles !== null ? features.door_cycles : 'Data unavailable'}</span>
          </div>
          <div className="rounded-lg border border-line/70 bg-raised p-3">
            <span className="block text-[11px] font-sans font-bold text-muted">Brake Force</span>
            <span className="text-sm font-bold text-ink">{features?.brake_force !== undefined && features?.brake_force !== null ? `${features.brake_force} N` : 'Data unavailable'}</span>
          </div>
          <div className="rounded-lg border border-line/70 bg-raised p-3">
            <span className="block text-[11px] font-sans font-bold text-muted">Operating Hours</span>
            <span className="text-sm font-bold text-ink">{features?.operating_hours !== undefined && features?.operating_hours !== null ? `${features.operating_hours} hrs` : 'Data unavailable'}</span>
          </div>
        </div>
      </div>

      {/* FIELD TELEMETRY READINGS */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2 font-bold text-ink mb-4">
          <Activity size={18} className="text-ok" />
          <span>Live Field Telemetry Sensor Streams</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs font-mono">
          <div className="rounded-lg border border-line/70 bg-raised p-3">
            <span className="block text-[11px] font-sans font-bold text-muted">Vibration Level</span>
            <span className="text-sm font-bold text-ink">{telem?.vibration_level !== undefined && telem?.vibration_level !== null ? `${telem.vibration_level} m/s²` : 'Data unavailable'}</span>
          </div>
          <div className="rounded-lg border border-line/70 bg-raised p-3">
            <span className="block text-[11px] font-sans font-bold text-muted">Motor Temperature</span>
            <span className="text-sm font-bold text-ink">{telem?.motor_temperature !== undefined && telem?.motor_temperature !== null ? `${telem.motor_temperature} °C` : 'Data unavailable'}</span>
          </div>
          <div className="rounded-lg border border-line/70 bg-raised p-3">
            <span className="block text-[11px] font-sans font-bold text-muted">Bearing Temperature</span>
            <span className="text-sm font-bold text-ink">{telem?.bearing_temperature !== undefined && telem?.bearing_temperature !== null ? `${telem.bearing_temperature} °C` : 'Data unavailable'}</span>
          </div>
          <div className="rounded-lg border border-line/70 bg-raised p-3">
            <span className="block text-[11px] font-sans font-bold text-muted">Motor Current</span>
            <span className="text-sm font-bold text-ink">{telem?.motor_current !== undefined && telem?.motor_current !== null ? `${telem.motor_current} A` : 'Data unavailable'}</span>
          </div>
        </div>
      </div>

      {/* TECHNICIAN ACTION CHECKLIST */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h3 className="font-bold text-ink mb-3">Field Technician Action Protocol</h3>
        <ul className="space-y-2 text-xs text-muted">
          <li className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-ok" />
            <span>Verify physical integrity and noise patterns of component: <strong>{pred?.affected_component ?? 'Data unavailable'}</strong>.</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-ok" />
            <span>Cross-check current CatBoost vibration snapshot against live sensor calibration.</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-ok" />
            <span>Submit technician service logs to local warehouse dispatch before completing work order.</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
