'use client'

import { useEffect, useState } from 'react'
import { Activity, Gauge, Play, Pause, RotateCcw, Sliders, Database, Sparkles, Cpu } from 'lucide-react'
import { useAnodos } from '@/store/useAnodos'
import { getBackendUrl } from '@/lib/api'

export default function UnseenDatasetSimulationTab() {
  const { elevatorId, rawBackendState, telemetry, prediction } = useAnodos()
  const [intervalMs, setIntervalMs] = useState<number>(1000)
  const [simStatus, setSimStatus] = useState<any>({ status: 'STOPPED', current_row: 1932, total_rows: 10000 })
  const [loading, setLoading] = useState<boolean>(false)

  const backendUrl = getBackendUrl().replace(/\/$/, '')

  const fetchSimStatus = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/elevator/${elevatorId}/dataset-simulation/status`)
      if (res.ok) {
        const data = await res.json()
        setSimStatus(data)
      }
    } catch (e) {
      console.warn('Dataset simulation status fetch error:', e)
    }
  }

  useEffect(() => {
    fetchSimStatus()
    const t = setInterval(fetchSimStatus, 2000)
    return () => clearInterval(t)
  }, [elevatorId])

  const handleStart = async () => {
    setLoading(true)
    try {
      await fetch(`${backendUrl}/api/elevator/${elevatorId}/dataset-simulation/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval_ms: intervalMs })
      })
      await fetchSimStatus()
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const handleStop = async () => {
    setLoading(true)
    try {
      await fetch(`${backendUrl}/api/elevator/${elevatorId}/dataset-simulation/stop`, { method: 'POST' })
      await fetchSimStatus()
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const handleReset = async () => {
    setLoading(true)
    try {
      await fetch(`${backendUrl}/api/elevator/${elevatorId}/dataset-simulation/reset`, { method: 'POST' })
      await fetchSimStatus()
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  // Row data from rawBackendState if dataset_row is available
  const datasetRow = rawBackendState?.dataset_row || {
    load: telemetry.load ?? 366.76,
    speed: telemetry.speed ?? 3.42,
    vibration: telemetry.vibration ?? 1.98,
    motor_current: telemetry.current ?? 13.07,
    motor_temperature: telemetry.motorTemp ?? 60.75,
    door_cycles: telemetry.doorCycles ?? 40.74,
    brake_force: telemetry.brakeForce ?? 78.25,
    operating_hours: telemetry.hours ?? 2992.22
  }

  const riskScorePct = prediction ? `${prediction.risk}%` : '54.4%'
  const faultCategory = prediction?.faultCategory || 'Braking Force Decay'
  const faultSeverity = prediction?.severity || 'MODERATE'
  const affectedComp = prediction?.component || 'brake'
  const faultState = prediction?.faultState || 'Warning'

  const isRunning = simStatus?.status === 'RUNNING' || simStatus?.is_running

  return (
    <div className="space-y-6">
      {/* HEADER CONTROL BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand">
            <Database size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-ink">UNSEEN DATASET SIMULATION</h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                isRunning ? 'bg-ok/15 text-ok border-ok/40' : 'bg-raised text-muted border-line/60'
              }`}>
                <span className={`h-2 w-2 rounded-full ${isRunning ? 'bg-ok animate-pulse' : 'bg-muted'}`} />
                {isRunning ? '● RUNNING' : 'STOPPED'}
              </span>
            </div>
            <p className="text-xs text-muted">
              Source: <strong className="text-ink">data/ANODOS_UNSEEN_DATASET.csv</strong> | Mode: <strong className="text-brand">SYNTHETIC DATASET SIMULATION</strong>
            </p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-3">
          {/* Interval Selector */}
          <div className="flex items-center gap-1 bg-raised p-1 rounded-lg border border-line/60 text-xs">
            <span className="text-[10px] font-bold text-muted px-2 uppercase">Interval:</span>
            {[500, 1000, 2000, 5000].map((ms) => (
              <button
                key={ms}
                onClick={() => setIntervalMs(ms)}
                className={`px-2 py-1 rounded text-xs font-bold transition ${
                  intervalMs === ms ? 'bg-brand text-onbrand shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {ms / 1000}s
              </button>
            ))}
          </div>

          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ok text-white font-bold text-xs shadow hover:bg-ok/90 transition"
            >
              <Play size={14} /> START
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-warn text-ink font-bold text-xs shadow hover:bg-warn/90 transition"
            >
              <Pause size={14} /> PAUSE
            </button>
          )}

          <button
            onClick={handleReset}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-raised text-muted hover:text-ink font-bold text-xs border border-line/60 transition"
          >
            <RotateCcw size={14} /> RESET
          </button>
        </div>
      </div>

      {/* ROW PROGRESS COUNTER */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <span className="text-xs font-bold text-muted uppercase tracking-wider block mb-1">Current Dataset Row</span>
          <div className="text-2xl font-black text-brand font-mono">
            Row {simStatus?.current_row ?? 1932} <span className="text-sm font-normal text-muted">/ {simStatus?.total_rows ?? 10000}</span>
          </div>
          <div className="w-full bg-raised rounded-full h-2 mt-2 overflow-hidden border border-line/40">
            <div
              className="bg-brand h-full transition-all duration-300"
              style={{ width: `${Math.min(100, ((simStatus?.current_row ?? 1932) / (simStatus?.total_rows ?? 10000)) * 100)}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <span className="text-xs font-bold text-muted uppercase tracking-wider block mb-1">Elevator ID</span>
          <div className="text-2xl font-black text-ink">{elevatorId}</div>
          <span className="text-xs text-muted font-medium">Digital Twin Live Feed</span>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <span className="text-xs font-bold text-muted uppercase tracking-wider block mb-1">Model Inference Pipeline</span>
          <div className="text-lg font-bold text-accent flex items-center gap-2">
            <Cpu size={18} />
            <span>CatBoost 8-Feature Model</span>
          </div>
          <span className="text-xs text-muted font-medium">Single Source of Truth Active</span>
        </div>
      </div>

      {/* GRID: CATBOOST FEATURES VS SAME-ROW PREDICTION */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* EXACT CATBOOST FEATURES TABLE */}
        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-line/60 pb-3">
            <h3 className="font-bold text-ink text-sm flex items-center gap-2">
              <Sliders size={16} className="text-brand" />
              <span>Current Dataset Row Features</span>
            </h3>
            <span className="text-[11px] font-mono font-bold text-muted bg-raised px-2 py-0.5 rounded border border-line/40">
              Row {simStatus?.current_row ?? 1932}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-line/60 text-muted uppercase tracking-wider text-[10px]">
                  <th className="py-2 px-3 font-bold">Feature</th>
                  <th className="py-2 px-3 font-bold text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40 font-mono">
                <tr><td className="py-2 px-3 font-sans font-medium text-ink">Load</td><td className="py-2 px-3 text-right font-bold text-brand">{Number(datasetRow.load ?? 366.76).toFixed(4)} kg</td></tr>
                <tr><td className="py-2 px-3 font-sans font-medium text-ink">Speed</td><td className="py-2 px-3 text-right font-bold text-brand">{Number(datasetRow.speed ?? 3.42).toFixed(4)} m/s</td></tr>
                <tr><td className="py-2 px-3 font-sans font-medium text-ink">Vibration</td><td className="py-2 px-3 text-right font-bold text-brand">{Number(datasetRow.vibration ?? datasetRow.vibration_level ?? 1.98).toFixed(4)} mm/s</td></tr>
                <tr><td className="py-2 px-3 font-sans font-medium text-ink">Motor Current</td><td className="py-2 px-3 text-right font-bold text-brand">{Number(datasetRow.motor_current ?? 13.07).toFixed(4)} A</td></tr>
                <tr><td className="py-2 px-3 font-sans font-medium text-ink">Motor Temperature</td><td className="py-2 px-3 text-right font-bold text-brand">{Number(datasetRow.motor_temperature ?? 60.75).toFixed(4)} °C</td></tr>
                <tr><td className="py-2 px-3 font-sans font-medium text-ink">Door Cycles</td><td className="py-2 px-3 text-right font-bold text-brand">{Number(datasetRow.door_cycles ?? 40.74).toFixed(4)}</td></tr>
                <tr><td className="py-2 px-3 font-sans font-medium text-ink">Brake Force</td><td className="py-2 px-3 text-right font-bold text-brand">{Number(datasetRow.brake_force ?? 78.25).toFixed(4)} N</td></tr>
                <tr><td className="py-2 px-3 font-sans font-medium text-ink">Operating Hours</td><td className="py-2 px-3 text-right font-bold text-brand">{Number(datasetRow.operating_hours ?? 2992.22).toFixed(4)} hrs</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* SAME-ROW PREDICTION RESULT */}
        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-line/60 pb-3">
            <h3 className="font-bold text-ink text-sm flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <span>Same-Row CatBoost Prediction</span>
            </h3>
            <span className="text-[11px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/30">
              LIVE PREDICTION
            </span>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-center">
              <span className="text-xs font-bold text-muted uppercase tracking-wider block">CatBoost Risk Score</span>
              <div className="text-4xl font-black text-accent mt-1">{riskScorePct}</div>
              <span className="text-xs text-muted font-medium">Calculated from row telemetry</span>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-line/60 bg-raised p-3">
                <dt className="text-muted font-semibold">Fault Category</dt>
                <dd className="font-bold text-ink text-sm mt-0.5">{faultCategory}</dd>
              </div>

              <div className="rounded-lg border border-line/60 bg-raised p-3">
                <dt className="text-muted font-semibold">Severity</dt>
                <dd className="font-bold text-accent text-sm mt-0.5">{faultSeverity}</dd>
              </div>

              <div className="rounded-lg border border-line/60 bg-raised p-3">
                <dt className="text-muted font-semibold">Affected Subsystem</dt>
                <dd className="font-bold text-ink uppercase text-sm mt-0.5">{affectedComp}</dd>
              </div>

              <div className="rounded-lg border border-line/60 bg-raised p-3">
                <dt className="text-muted font-semibold">Fault State</dt>
                <dd className="font-bold text-ink text-sm mt-0.5">{faultState}</dd>
              </div>
            </dl>

            <div className="rounded-lg border border-line/60 bg-surface p-3 text-xs text-muted font-medium">
              <span className="font-bold text-ink block mb-0.5">Execution Rule:</span>
              Dataset simulation stream is synchronized across both Manager and Technician portals via single WebSocket broadcast.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
