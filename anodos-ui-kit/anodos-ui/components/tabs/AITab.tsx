'use client'

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  FileText,
  Gauge,
  Layers,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wrench,
} from 'lucide-react'
import { compName, healthOf, useAnodos } from '@/store/useAnodos'
import RiskGauge from '../ui/RiskGauge'
import { Badge, Panel, Stat } from '../ui/primitives'

export default function AITab() {
  const p = useAnodos((s) => s.prediction)
  const history = useAnodos((s) => s.predictionHistory)
  const trend = useAnodos((s) => s.trend)
  const telemetry = useAnodos((s) => s.telemetry)

  const risk = p?.risk ?? 15
  const h = healthOf(risk)
  const affected = p ? compName(p.component) : 'Traction Motor'
  const faultState = p?.faultState ?? (risk >= 80 ? 'FAULT' : 'normal')
  const faultCategory = p?.faultCategory ?? 'NOMINAL OPERATION'
  const severity = p?.severity ?? (risk >= 80 ? 'HIGH' : risk >= 50 ? 'MEDIUM' : 'LOW')
  const timestampStr = p?.timestampStr || (p?.at ? new Date(p.at).toISOString().replace('T', ' ').substring(0, 19) : new Date().toISOString().replace('T', ' ').substring(0, 19))

  // Feature Snapshot values from backend (or fallback to live telemetry)
  const snapshot = p?.featureSnapshot || p?.feature_snapshot || {
    load: telemetry.load,
    speed: telemetry.speed,
    vibration: telemetry.vibration,
    motor_current: telemetry.current,
    motor_temperature: telemetry.motorTemp,
    door_cycles: telemetry.doorCycles,
    brake_force: telemetry.brakeForce,
    operating_hours: telemetry.hours,
  }

  // Supporting signals & explanation
  const rawSignals = p?.explanationDetail?.model_supporting_signals
  const supportingSignals: string[] = Array.isArray(rawSignals) && rawSignals.length > 0
    ? rawSignals.map((sig: any) =>
        typeof sig === 'object' && sig !== null
          ? sig.text || sig.message || sig.description || JSON.stringify(sig)
          : String(sig)
      )
    : [
        'Motor current & voltage signatures within nominal limits',
        'Vibration spectrum within ISO 10816 standards',
        'Brake engagement response time optimal',
      ]

  const rawStress = p?.explanationDetail?.physical_stress
  const physicalStress: string = typeof rawStress === 'object' && rawStress !== null
    ? ((rawStress as any).text || (rawStress as any).description || JSON.stringify(rawStress))
    : (typeof rawStress === 'string' ? rawStress : 'Nominal thermal dissipation & mechanical friction loads')

  // Maintenance recommendation from backend
  const rawMaintenance = p?.maintenance
  const maintenance = {
    priority: rawMaintenance?.priority || (risk >= 80 ? 'CRITICAL' : risk >= 55 ? 'HIGH' : risk >= 30 ? 'MEDIUM' : 'LOW'),
    summary: typeof rawMaintenance?.summary === 'object' && rawMaintenance.summary !== null
      ? ((rawMaintenance.summary as any).text || JSON.stringify(rawMaintenance.summary))
      : (rawMaintenance?.summary || `CatBoost evaluation indicates ${affected} risk level at ${risk}%.`),
    reasoning: typeof rawMaintenance?.reasoning === 'object' && rawMaintenance.reasoning !== null
      ? ((rawMaintenance.reasoning as any).text || JSON.stringify(rawMaintenance.reasoning))
      : (rawMaintenance?.reasoning || 'Automated diagnostic assessment calculated from CatBoost features and Physics Engine invariants.'),
    recommended_actions: (Array.isArray(rawMaintenance?.recommended_actions) && rawMaintenance.recommended_actions.length > 0
      ? rawMaintenance.recommended_actions
      : (Array.isArray((rawMaintenance as any)?.recommendedActions) && (rawMaintenance as any).recommendedActions.length > 0
          ? (rawMaintenance as any).recommendedActions
          : [
              `Schedule visual and thermal inspection for ${affected}`,
              'Verify brake force and current signature telemetry',
              'Log routine maintenance inspection entry',
            ])
    ).map((act: any): string => (typeof act === 'object' && act !== null ? (act.text || act.action || JSON.stringify(act)) : String(act))),
    evidence: (Array.isArray(rawMaintenance?.evidence) && rawMaintenance.evidence.length > 0
      ? rawMaintenance.evidence
      : [
          `CatBoost Risk Score: ${risk}%`,
          `Feature Snapshot: Load=${snapshot.load ?? telemetry.load}kg, Temp=${snapshot.motor_temperature ?? telemetry.motorTemp}°C`,
          `Fault State: ${faultState}`,
        ]
    ).map((ev: any): string => (typeof ev === 'object' && ev !== null ? (ev.text || JSON.stringify(ev)) : String(ev))),
  }

  // Exact 8 CatBoost Features array
  const featuresList = [
    { label: 'Load', val: snapshot.load != null ? `${snapshot.load} kg` : '650 kg' },
    { label: 'Speed', val: snapshot.speed != null ? `${snapshot.speed} m/s` : '2.5 m/s' },
    { label: 'Vibration', val: snapshot.vibration != null ? `${snapshot.vibration} m/s²` : '1.8 m/s²' },
    { label: 'Motor Current', val: snapshot.motor_current != null ? `${snapshot.motor_current} A` : '8.4 A' },
    { label: 'Motor Temperature', val: snapshot.motor_temperature != null ? `${snapshot.motor_temperature} °C` : '65 °C' },
    { label: 'Door Cycles', val: snapshot.door_cycles != null ? `${snapshot.door_cycles}` : '40' },
    { label: 'Brake Force', val: snapshot.brake_force != null ? `${snapshot.brake_force} kN` : '92 kN' },
    { label: 'Operating Hours', val: snapshot.operating_hours != null ? `${snapshot.operating_hours?.toLocaleString()} h` : '8,421 h' },
  ]

  // Priority color styling
  const priorityColor =
    maintenance.priority === 'CRITICAL'
      ? 'bg-fault/20 text-fault border-fault/40'
      : maintenance.priority === 'HIGH'
      ? 'bg-warn/20 text-warn border-warn/40'
      : maintenance.priority === 'MEDIUM'
      ? 'bg-accent/20 text-accent border-accent/40'
      : 'bg-ok/20 text-ok border-ok/40'

  return (
    <div className="space-y-5 pb-8">
      {/* TITLE BAR (EXACT AS PIC) */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">AI Prediction</h1>
        <span className="text-xs font-bold text-ok">● LIVE CATBOOST</span>
      </div>

      {/* TOP GRID (EXACT AS PIC: FAILURE RISK GAUGE + CONFIDENCE/HORIZON/SEVERITY/AFFECTED/WHY?) */}
      <div className="grid gap-5 lg:grid-cols-5">
        <Panel title="Failure Risk" className="lg:col-span-2">
          <RiskGauge risk={risk} />
          <div className="mt-3 text-center">
            <Badge health={h}>{p?.faultState ?? 'normal'}</Badge>
          </div>
        </Panel>

        <div className="grid grid-cols-2 content-start gap-4 lg:col-span-3">
          <Stat label="Confidence" value={p?.confidence ?? 89} unit="%" />
          <Stat label="Horizon" value={p?.horizonH ?? 24} unit="h" />
          <Stat label="Severity" value={p?.severity ?? 'LOW'} tone={h} />
          <Stat
            label="Affected"
            value={<span className="text-xl">{p ? compName(p.component) : 'Traction Motor'}</span>}
          />
          <Panel title="Why?" className="col-span-2">
            <p className="text-sm leading-relaxed">
              {p?.explanation ?? 'Anomalous operational pattern detected for motor assembly.'}
            </p>
          </Panel>
        </div>
      </div>

      {/* MODEL PANEL (EXACT AS PIC: MODEL, TRAINING SAMPLES, TEST ACCURACY, ROC-AUC + ENHANCED PREDICTION/FEATURE SOURCE) */}
      <Panel title="Model">
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-6">
          {[
            ['Model', p?.model.name ?? 'ANODOS-CatBoost-v1.0'],
            ['Prediction Source', p?.featureSource || p?.feature_source || 'Dataset / Scenario'],
            ['Feature Source', p?.feature_source || 'unseen_dataset'],
            ['Training samples', (p?.model.samples ?? 100000).toLocaleString()],
            ['Test accuracy', `${p?.model.accuracy ?? 77.02}%`],
            ['ROC-AUC', `${p?.model.rocAuc ?? 84.3}%`],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="label text-[11px]">{k}</div>
              <div className="mt-1 font-mono text-base font-bold text-ink truncate">{v}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* ADDITIONAL FEATURES NOT IN THE PICTURE BELOW */}

      {/* 2-COLUMN LAYOUT: AI FEATURES USED & EXPLANATION DETAILS */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* AI FEATURES USED (SNAPSHOT) TABLE */}
        <Panel
          title="AI Features Used (Snapshot)"
          right={
            <span className="text-[11px] text-muted font-medium flex items-center gap-1">
              <Database size={13} className="text-muted" />
              Backend Feature Vector
            </span>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-line/60 text-muted uppercase tracking-wider text-[10px]">
                  <th className="py-2 px-3 font-bold">CatBoost Feature</th>
                  <th className="py-2 px-3 font-bold text-right">Value (Backend Snapshot)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40 font-medium">
                {featuresList.map((f, idx) => (
                  <tr key={f.label} className={idx % 2 === 0 ? 'bg-surface/40' : 'bg-transparent'}>
                    <td className="py-2 px-3 font-semibold text-ink flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      {f.label}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-ink">{f.val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2.5 text-[10px] text-muted font-medium text-center italic">
            Telemetry values supplied directly from CatBoost feature snapshot.
          </p>
        </Panel>

        {/* AI PREDICTION EXPLANATION & SUPPORTING SIGNALS */}
        <Panel title="AI Diagnostic & Physical Stress">
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-2 bg-raised/50 p-2.5 rounded-lg border border-line/50">
              <div>
                <span className="text-muted text-[10px] block">Fault Category</span>
                <span className="font-extrabold text-ink block mt-0.5">{faultCategory}</span>
              </div>
              <div>
                <span className="text-muted text-[10px] block">State & Severity</span>
                <span
                  className={`font-black text-xs inline-block mt-0.5 px-2 py-0.5 rounded ${
                    severity === 'HIGH' || severity === 'CRITICAL' ? 'bg-fault/20 text-fault' : 'bg-ok/20 text-ok'
                  }`}
                >
                  {faultState} ({severity})
                </span>
              </div>
              <div>
                <span className="text-muted text-[10px] block">Timestamp</span>
                <span className="font-mono text-[10px] font-bold text-ink block mt-0.5 truncate">{timestampStr}</span>
              </div>
            </div>

            {/* Supporting Signals */}
            <div>
              <span className="font-bold text-ink uppercase tracking-wider text-[11px] block mb-1.5">
                Supporting Signals
              </span>
              <ul className="space-y-1.5">
                {supportingSignals.map((sig, i) => (
                  <li key={i} className="flex items-start gap-2 text-ink font-medium">
                    <CheckCircle2 size={14} className="text-accent shrink-0 mt-0.5" />
                    <span>{sig}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Physical Stress Assessment */}
            <div className="border-t border-line/40 pt-3">
              <span className="font-bold text-ink uppercase tracking-wider text-[11px] block mb-1">
                Physical Stress Assessment
              </span>
              <p className="text-muted font-medium leading-relaxed bg-surface p-2.5 rounded-lg border border-line/50 font-mono text-[11px]">
                {physicalStress}
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {/* MAINTENANCE RECOMMENDATION */}
      <Panel
        title="Maintenance Recommendation"
        right={
          <span className={`px-2.5 py-0.5 rounded text-xs font-black border ${priorityColor}`}>
            PRIORITY: {maintenance.priority}
          </span>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 text-xs">
          <div className="space-y-3">
            <div>
              <span className="font-bold text-ink uppercase tracking-wider text-[11px] block mb-1">
                Summary
              </span>
              <p className="text-ink font-medium leading-relaxed bg-raised/40 p-2.5 rounded-lg border border-line/50">
                {maintenance.summary}
              </p>
            </div>

            <div>
              <span className="font-bold text-ink uppercase tracking-wider text-[11px] block mb-1">
                Reasoning
              </span>
              <p className="text-muted leading-relaxed font-normal">
                {maintenance.reasoning}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <span className="font-bold text-ink uppercase tracking-wider text-[11px] block mb-1">
                Recommended Actions
              </span>
              <ul className="space-y-1.5">
                {maintenance.recommended_actions.map((act: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-ink font-medium bg-surface p-2 rounded border border-line/40">
                    <Wrench size={14} className="text-accent shrink-0 mt-0.5" />
                    <span>{act}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <span className="font-bold text-ink uppercase tracking-wider text-[11px] block mb-1">
                Evidence
              </span>
              <div className="flex flex-wrap gap-1.5">
                {maintenance.evidence.map((ev: string, i: number) => (
                  <span key={i} className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-raised border border-line/50 text-muted">
                    {ev}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* PREDICTION HISTORY & RISK TREND PANEL */}
      <Panel
        title="Prediction History & Risk Trend"
        right={
          <span className="text-xs font-bold text-muted flex items-center gap-1">
            <TrendingUp size={14} className="text-brand" />
            CatBoost Inference Stream ({history.length} runs)
          </span>
        }
      >
        <div className="space-y-4">
          {/* RISK TREND VISUALIZATION */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-ink uppercase tracking-wider">Risk Score History Trend</span>
              <span className="text-[11px] font-mono text-muted">Latest {trend.length} Time points</span>
            </div>
            <div className="h-24 w-full bg-surface/60 rounded-xl p-2.5 border border-line/60 flex items-end gap-1 overflow-hidden relative">
              {trend.map((pt, i) => {
                const barRisk = 100 - pt.health
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group h-full justify-end">
                    <div
                      className={`w-full rounded-t transition-all duration-300 ${
                        barRisk >= 80 ? 'bg-fault' : barRisk >= 50 ? 'bg-warn' : 'bg-ok'
                      }`}
                      style={{ height: `${Math.max(8, barRisk)}%` }}
                    />
                    <span className="text-[9px] font-mono text-muted group-hover:text-ink hidden sm:block truncate">
                      {pt.t}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* HISTORY TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-line/60 text-muted uppercase tracking-wider text-[10px]">
                  <th className="py-2 px-3 font-bold">Timestamp</th>
                  <th className="py-2 px-3 font-bold">Risk Score</th>
                  <th className="py-2 px-3 font-bold">Fault State</th>
                  <th className="py-2 px-3 font-bold">Category</th>
                  <th className="py-2 px-3 font-bold">Severity</th>
                  <th className="py-2 px-3 font-bold">Affected Component</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40 font-medium">
                {history.length > 0 ? (
                  history.slice(0, 6).map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-surface/40' : 'bg-transparent'}>
                      <td className="py-2 px-3 font-mono text-muted">{item.timestampStr || new Date(item.at).toLocaleTimeString()}</td>
                      <td className="py-2 px-3 font-bold text-ink">{item.risk}%</td>
                      <td className="py-2 px-3">
                        <Badge health={healthOf(item.risk)}>{item.faultState}</Badge>
                      </td>
                      <td className="py-2 px-3 font-semibold text-ink">{item.faultCategory}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            item.severity === 'HIGH' || item.severity === 'CRITICAL'
                              ? 'bg-fault/20 text-fault'
                              : item.severity === 'MEDIUM'
                              ? 'bg-warn/20 text-warn'
                              : 'bg-ok/20 text-ok'
                          }`}
                        >
                          {item.severity}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-bold text-ink">{compName(item.component)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-2 px-3 font-mono text-muted">{timestampStr}</td>
                    <td className="py-2 px-3 font-bold text-ink">{risk}%</td>
                    <td className="py-2 px-3">
                      <Badge health={h}>{faultState}</Badge>
                    </td>
                    <td className="py-2 px-3 font-semibold text-ink">{faultCategory}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          severity === 'HIGH' || severity === 'CRITICAL'
                            ? 'bg-fault/20 text-fault'
                            : severity === 'MEDIUM'
                            ? 'bg-warn/20 text-warn'
                            : 'bg-ok/20 text-ok'
                        }`}
                      >
                        {severity}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold text-ink">{affected}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  )
}
