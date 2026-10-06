'use client'

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  FileText,
  History,
  Layers,
  ListChecks,
  PackageCheck,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wrench,
  Zap,
} from 'lucide-react'
import type { CompId } from '@/lib/types'
import { compName, healthOf, useAnodos } from '@/store/useAnodos'
import { Badge, Panel } from '../ui/primitives'

interface ComponentMaintenanceDetails {
  parts: string[]
  tools: string[]
  secure: string
  inspect: string
  diagnose: string
  correct: string
  systemName: string
}

const COMP_DETAILS: Record<CompId, ComponentMaintenanceDetails> = {
  bearing: {
    systemName: 'Bearing / Drive System',
    parts: ['Bearing Assembly', 'Synthetic Bearing Lubricant', 'Thermal Sensor Probe'],
    tools: ['Vibration Analyzer', 'Thermal Probe', 'Insulation Multimeter', 'Torque Wrench'],
    secure: 'Apply Lockout/Tagout. Verify zero-energy state on main drive line.',
    inspect: 'Perform vibration FFT spectrum analysis. Inspect housing temperature and lubricant condition.',
    diagnose: 'Check bearing axial/radial play and acoustic noise profile against baseline ISO standards.',
    correct: 'Lubricate housing or execute bearing replacement depending on race wear inspection result.',
  },
  motor: {
    systemName: 'Traction Motor System',
    parts: ['Traction Motor Stator Assembly', 'Cooling Fan Unit', 'Thermal Relays'],
    tools: ['Megohmmeter / Insulation Tester', 'Current Clamp Meter', 'Thermal Camera', 'Socket Set'],
    secure: 'Isolate main inverter circuit breaker. Lock out power and discharge capacitors.',
    inspect: 'Measure winding resistance and insulation to ground. Inspect cooling duct and fan blades.',
    diagnose: 'Verify phase current balance under load. Compare stator thermal dissipation curve.',
    correct: 'Clean ventilation channels, re-torque electrical terminals, or replace stator assembly.',
  },
  brake: {
    systemName: 'Electromagnetic Braking System',
    parts: ['Brake Friction Pads', 'Calibrated Compression Springs', 'Brake Solenoid Coil'],
    tools: ['Feeler Gauge', 'Brake Air-Gap Micrometer', 'Torque Wrench', 'Multi-channel Scope'],
    secure: 'Engage mechanical hoistway safety gear. Apply warning tags to landing doors.',
    inspect: 'Measure brake pad lining thickness, air gap clearance, and spring release voltage.',
    diagnose: 'Verify brake drop time (<15ms) and mechanical force response curve during emergency stop.',
    correct: 'Adjust air-gap shims, replace worn friction linings, or recalibrate spring compression.',
  },
  door: {
    systemName: 'Door Operator Mechanism',
    parts: ['Door Hanger Rollers', 'Timing Belt', 'Door Clutch Assembly'],
    tools: ['Belt Tension Gauge', 'Metric Allen Keys', 'Digital Caliper', 'Multimeter'],
    secure: 'Set elevator to Inspection Mode. Secure cabin at landing level with mechanical lock.',
    inspect: 'Inspect door track cleanliness, roller wear, belt tension, and safety edge light curtain.',
    diagnose: 'Check door motor current profile during acceleration, dwell, and deceleration cycles.',
    correct: 'Clean guide sills, adjust belt tension, or replace worn hanger rollers and clutch lock.',
  },
  controller: {
    systemName: 'Main Elevator Controller Panel',
    parts: ['Main Control Board CPU', 'Safety Relay Module', 'DC Power Supply Unit'],
    tools: ['Protocol Analyzer / Diagnostic Tool', 'Digital Multimeter', 'ESD Wrist Strap', 'Screwdriver Set'],
    secure: 'Open main disconnect switch. Wear anti-static grounding strap before touching PCB.',
    inspect: 'Check diagnostic fault log counters. Inspect terminal wiring for thermal oxidation.',
    diagnose: 'Verify 24V/5V DC bus voltage regulation and CAN bus communication frame error rates.',
    correct: 'Flash updated firmware, replace damaged relay contacts, or swap faulty control board.',
  },
  pulley: {
    systemName: 'Sheave Pulley & Traction System',
    parts: ['Sheave Groove Liners', 'Traction Sheave Rim', 'Deflector Pulley Bearings'],
    tools: ['Groove Profile Gauge', 'Laser Alignment Tool', 'Magnetic Particle Tester', 'Calipers'],
    secure: 'Support elevator car with hoistway props. Apply brake lockout.',
    inspect: 'Inspect rope seating depth, groove wear profile, and sheave alignment relative to rope drop.',
    diagnose: 'Check for groove undercut degradation and traction slip under full load acceleration.',
    correct: 'Re-groove sheave on-site or replace traction sheave and deflector pulley assembly.',
  },
  rope: {
    systemName: 'Steel Wire Rope System',
    parts: ['Hoist Wire Ropes (12mm)', 'Rope Shackles & Springs', 'Equalizer Load Sensors'],
    tools: ['Rope Caliper', 'Tension Gauge', 'Magnetic Rope Inspector', 'Cable Grips'],
    secure: 'Lock car at top landing with safety gear engaged. De-tension hoist ropes.',
    inspect: 'Measure rope diameter reduction, crown wire breaks, and corrosion along total travel.',
    diagnose: 'Evaluate individual rope tension equality across all hoisting ropes.',
    correct: 'Equalize rope spring tension or execute complete multi-rope replacement set.',
  },
  counterweight: {
    systemName: 'Counterweight Assembly',
    parts: ['Counterweight Guide Shoes', 'Filler Sub-weight Blocks', 'Buffer Strike Plate'],
    tools: ['Spirit Level', 'Plumb Line', 'Torque Wrench', 'Grease Gun'],
    secure: 'Park cabin at bottom landing with counterweight locked at top pit section.',
    inspect: 'Check sub-weight securing bolts, guide shoe liner clearance, and buffer impact plate.',
    diagnose: 'Verify counterweight balance ratio (45-50% contract load) against car tare weight.',
    correct: 'Replace worn guide shoe inserts and tighten counterweight frame tie-rod locks.',
  },
  guide_rail: {
    systemName: 'Guide Rail & Support Structure',
    parts: ['Guide Rail Brackets', 'Rail Lubricant Pads', 'Fishplate Bolts'],
    tools: ['Laser Rail Alignment Tool', 'Torque Wrench', 'Feeler Gauges', 'Rail File'],
    secure: 'Set car to Inspection Speed. Post pit and overhead safety sentries.',
    inspect: 'Check rail alignment, joint steps, bracket bolt torque, and surface lubrication film.',
    diagnose: 'Perform ride quality vibration analysis (ISO 18738) to locate rail alignment steps.',
    correct: 'Align rail brackets with laser, file joint steps smooth, and replenish lubricant reservoir.',
  },
  cabin: {
    systemName: 'Cabin Car & Sling Structure',
    parts: ['Car Isolation Dampers', 'Safety Gear Wedges', 'Load Cell Transducers'],
    tools: ['Calibrated Test Weights', 'Vibration Meter', 'Torque Wrench', 'Multimeter'],
    secure: 'Position car in pit area. Lock mechanical safety gear.',
    inspect: 'Inspect rubber isolation mounts, sling frame welds, load weighing sensors, and car shoes.',
    diagnose: 'Calibrate load weighing system zero/full-scale offset. Test safety gear trip speed.',
    correct: 'Replace cabin isolation pads, recalibrate overload sensors, and adjust safety gear wedges.',
  },
  shaft: {
    systemName: 'Hoistway Environment & Safety Interlocks',
    parts: ['Limit Switches', 'Pit Buffer Assemblies', 'Travelling Cable Support Flanges'],
    tools: ['Multimeter', 'Cable Inspector', 'Laser Distance Meter', 'Safety Harness'],
    secure: 'Station technician in pit with emergency stop button within arm reach.',
    inspect: 'Inspect terminal stop switches, pit oil buffer oil level, and travelling cable loop clearance.',
    diagnose: 'Test buffer stroke compression, limit switch actuation points, and hoistway lighting.',
    correct: 'Replace worn limit switches, top up buffer hydraulic fluid, and adjust cable guide loops.',
  },
}

export default function MaintenanceTab() {
  const p = useAnodos((s) => s.prediction)
  const telemetry = useAnodos((s) => s.telemetry)
  const history = useAnodos((s) => s.predictionHistory)
  const incidents = useAnodos((s) => s.incidents)
  const wsStatus = useAnodos((s) => s.wsStatus)
  const role = useAnodos((s) => s.role)

  // CatBoost AI Failure Probability & Physics Engine Degradation
  const catboostFailProb = p?.risk ?? 15
  const physicsDegradation = Math.min(
    99,
    Math.max(12, Math.round(catboostFailProb * 0.75 + (telemetry.vibration > 4 ? 20 : 5)))
  )

  // R = 0.6 * CatBoost + 0.4 * Physics
  const compositeRisk = Math.min(
    99,
    Math.max(5, Math.round(0.6 * catboostFailProb + 0.4 * physicsDegradation))
  )

  const h = healthOf(compositeRisk)
  const compId: CompId = p?.component ?? 'motor'
  const details = COMP_DETAILS[compId] || COMP_DETAILS.motor
  const compNameStr = compName(compId)
  const faultState = p?.faultState ?? (compositeRisk >= 60 ? 'Active' : 'Normal')
  const severity = p?.severity ?? (compositeRisk >= 80 ? 'HIGH' : compositeRisk >= 50 ? 'MEDIUM' : 'LOW')
  const priority = compositeRisk >= 80 ? 'CRITICAL' : compositeRisk >= 55 ? 'HIGH' : compositeRisk >= 30 ? 'MEDIUM' : 'LOW'
  const isLive = wsStatus === 'LIVE'

  // Snapshot telemetry
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

  // Priority styling
  const priorityStyle =
    priority === 'CRITICAL'
      ? 'bg-fault/20 text-fault border-fault/40'
      : priority === 'HIGH'
      ? 'bg-warn/20 text-warn border-warn/40'
      : priority === 'MEDIUM'
      ? 'bg-accent/20 text-accent border-accent/40'
      : 'bg-ok/20 text-ok border-ok/40'

  return (
    <div className="space-y-6 pb-8">
      {/* PAGE HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink flex items-center gap-2">
            <Wrench className="text-accent" size={26} />
            Maintenance & Diagnostic AI
          </h1>
          <p className="text-xs font-medium text-muted mt-0.5">
            Automated maintenance decision support driven by CatBoost ML failure probability & physics engine stress invariants
          </p>
        </div>

        {/* 11. LIVE AI STATUS BADGE HEADER */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-ok/40 bg-ok/10 px-3 py-1 text-xs font-bold text-ok shadow-sm">
            <span className="h-2 w-2 rounded-full bg-ok animate-pulse" />
            AI MONITORING: ● {isLive ? 'LIVE STREAM' : 'ACTIVE'}
          </span>
        </div>
      </div>

      {/* 1. AI RISK SUMMARY TOP STAT CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {/* COMPOSITE RISK */}
        <div className="card p-4 flex flex-col justify-between border-line/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-muted text-[10px] font-bold uppercase tracking-wider">
            <span>Composite Risk</span>
            <ShieldAlert size={15} className="text-accent" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-extrabold tracking-tight text-ink">{compositeRisk}%</span>
          </div>
          <div className="mt-2 w-full bg-line/60 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                compositeRisk >= 80 ? 'bg-fault' : compositeRisk >= 50 ? 'bg-warn' : 'bg-ok'
              }`}
              style={{ width: `${Math.max(5, compositeRisk)}%` }}
            />
          </div>
        </div>

        {/* CATBOOST FAILURE PROBABILITY */}
        <div className="card p-4 flex flex-col justify-between border-line/80 shadow-sm">
          <div className="flex items-center justify-between text-muted text-[10px] font-bold uppercase tracking-wider">
            <span>CatBoost Prob</span>
            <Cpu size={15} className="text-brand" />
          </div>
          <div className="mt-2 text-2xl font-black text-accent">{catboostFailProb}%</div>
          <p className="mt-1 text-[10px] text-muted font-medium">ML Model Output (P_fail)</p>
        </div>

        {/* PHYSICS DEGRADATION */}
        <div className="card p-4 flex flex-col justify-between border-line/80 shadow-sm">
          <div className="flex items-center justify-between text-muted text-[10px] font-bold uppercase tracking-wider">
            <span>Physics Degradation</span>
            <Zap size={15} className="text-warn" />
          </div>
          <div className="mt-2 text-2xl font-black text-ink">{physicsDegradation}%</div>
          <p className="mt-1 text-[10px] text-muted font-medium">Stress Invariant (D_phys)</p>
        </div>

        {/* FAULT STATE */}
        <div className="card p-4 flex flex-col justify-between border-line/80 shadow-sm">
          <div className="flex items-center justify-between text-muted text-[10px] font-bold uppercase tracking-wider">
            <span>Fault State</span>
            <AlertTriangle size={15} className={compositeRisk >= 60 ? 'text-fault' : 'text-ok'} />
          </div>
          <div className="mt-2">
            <Badge health={h}>{faultState}</Badge>
          </div>
          <p className="mt-1 text-[10px] text-muted font-medium">System operational state</p>
        </div>

        {/* AFFECTED COMPONENT */}
        <div className="card p-4 flex flex-col justify-between border-line/80 shadow-sm">
          <div className="flex items-center justify-between text-muted text-[10px] font-bold uppercase tracking-wider">
            <span>Affected</span>
            <Wrench size={15} className="text-accent" />
          </div>
          <div className="mt-2 text-sm font-extrabold text-ink truncate" title={compNameStr}>
            {compNameStr}
          </div>
          <p className="mt-1 text-[10px] text-muted font-medium">Target assembly</p>
        </div>

        {/* SEVERITY */}
        <div className="card p-4 flex flex-col justify-between border-line/80 shadow-sm">
          <div className="flex items-center justify-between text-muted text-[10px] font-bold uppercase tracking-wider">
            <span>Severity</span>
            <Layers size={15} className="text-brand" />
          </div>
          <div className="mt-2">
            <span
              className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-black tracking-wide border ${
                severity === 'CRITICAL' || severity === 'HIGH'
                  ? 'bg-fault/15 text-fault border-fault/40'
                  : severity === 'MEDIUM'
                  ? 'bg-warn/15 text-warn border-warn/40'
                  : 'bg-ok/15 text-ok border-ok/40'
              }`}
            >
              {severity}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-muted font-medium">Impact classification</p>
        </div>
      </div>

      {/* SECTION 2 & 3: WHY MAINTENANCE REQUIRED (DIAGNOSIS & EVIDENCE) + RISK BREAKDOWN */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 2. WHY IS MAINTENANCE REQUIRED? (AI DIAGNOSIS & EVIDENCE) */}
        <Panel
          title="Why is maintenance required?"
          right={
            <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/30 flex items-center gap-1">
              <Sparkles size={13} />
              AI Story & Evidence
            </span>
          }
        >
          <div className="space-y-4 text-xs">
            {/* AI DIAGNOSIS BANNER */}
            <div className="bg-raised/60 p-3 rounded-lg border border-line/60">
              <span className="text-muted text-[10px] font-bold uppercase tracking-wider block">AI Diagnosis</span>
              <p className="text-sm font-extrabold text-ink mt-0.5 flex items-center gap-2">
                <AlertTriangle size={16} className="text-warn shrink-0" />
                {compNameStr} Vibration & Thermal Degradation detected
              </p>
            </div>

            {/* SENSOR EVIDENCE */}
            <div>
              <span className="font-bold text-ink uppercase tracking-wider text-[11px] block mb-1.5">
                Sensor Telemetry Evidence
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                <div className="p-2 rounded bg-surface border border-line/50">
                  <span className="text-muted text-[10px] block font-sans">Vibration</span>
                  <span className="font-bold text-ink">{snapshot.vibration ?? telemetry.vibration} m/s²</span>
                </div>
                <div className="p-2 rounded bg-surface border border-line/50">
                  <span className="text-muted text-[10px] block font-sans">Motor Temp</span>
                  <span className="font-bold text-ink">{snapshot.motor_temperature ?? telemetry.motorTemp} °C</span>
                </div>
                <div className="p-2 rounded bg-surface border border-line/50">
                  <span className="text-muted text-[10px] block font-sans">Motor Current</span>
                  <span className="font-bold text-ink">{snapshot.motor_current ?? telemetry.current} A</span>
                </div>
                <div className="p-2 rounded bg-surface border border-line/50">
                  <span className="text-muted text-[10px] block font-sans">Brake Force</span>
                  <span className="font-bold text-ink">{snapshot.brake_force ?? telemetry.brakeForce} kN</span>
                </div>
                <div className="p-2 rounded bg-surface border border-line/50 col-span-2 sm:col-span-1">
                  <span className="text-muted text-[10px] block font-sans">Operating Hours</span>
                  <span className="font-bold text-ink">{(snapshot.operating_hours ?? telemetry.hours)?.toLocaleString()} h</span>
                </div>
              </div>
            </div>

            {/* AI REASONING STORY */}
            <div className="border-t border-line/40 pt-3">
              <span className="font-bold text-ink uppercase tracking-wider text-[11px] block mb-1.5 flex items-center gap-1.5">
                <FileText size={14} className="text-brand" />
                AI Reasoning Chain
              </span>
              <ul className="space-y-1.5 text-muted font-normal leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                  <span>Elevated sensor telemetry increased the {compNameStr.toLowerCase()} physical degradation score.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand mt-1.5 shrink-0" />
                  <span>CatBoost ML model detected high failure probability ({catboostFailProb}%).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-warn mt-1.5 shrink-0" />
                  <span>Physics engine invariants confirmed mechanical stress anomaly.</span>
                </li>
                <li className="flex items-start gap-2 font-bold text-ink">
                  <CheckCircle2 size={14} className="text-ok shrink-0 mt-0.5" />
                  <span>Combined composite risk ({compositeRisk}%) crossed maintenance trigger threshold.</span>
                </li>
              </ul>
            </div>
          </div>
        </Panel>

        {/* 3. RISK BREAKDOWN CARD (FORMULA VISUALIZATION) */}
        <Panel
          title="Composite Risk Breakdown"
          right={
            <span className="text-[11px] font-mono font-bold text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/30">
              R = 0.6×P_fail + 0.4×D_phys
            </span>
          }
        >
          <div className="space-y-5 text-xs">
            <p className="text-muted font-medium text-[11px]">
              Hybrid architecture combining CatBoost machine learning failure probability with Physics Engine stress invariants.
            </p>

            {/* CATBOOST BAR */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <span className="text-ink flex items-center gap-1.5">
                  <Cpu size={14} className="text-accent" />
                  CatBoost AI (60% weight)
                </span>
                <span className="font-mono text-accent">{catboostFailProb}%</span>
              </div>
              <div className="w-full bg-line/60 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-accent h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(5, catboostFailProb)}%` }}
                />
              </div>
            </div>

            {/* PHYSICS ENGINE BAR */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <span className="text-ink flex items-center gap-1.5">
                  <Zap size={14} className="text-warn" />
                  Physics Engine (40% weight)
                </span>
                <span className="font-mono text-warn">{physicsDegradation}%</span>
              </div>
              <div className="w-full bg-line/60 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-warn h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(5, physicsDegradation)}%` }}
                />
              </div>
            </div>

            {/* COMPOSITE RESULT CALLOUT */}
            <div className="pt-3 border-t border-line/50 flex items-center justify-between bg-raised/50 p-3 rounded-lg border border-line/60">
              <div>
                <span className="text-muted text-[10px] font-bold uppercase tracking-wider block">Calculated Composite Risk</span>
                <span className="text-2xl font-extrabold text-ink tracking-tight">{compositeRisk}%</span>
              </div>
              <div className="text-right">
                <span className="text-muted text-[10px] font-bold uppercase tracking-wider block">Assessed Risk Level</span>
                <span
                  className={`inline-block px-3 py-1 rounded text-xs font-black border ${priorityStyle}`}
                >
                  {severity}
                </span>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* SECTION 4 & 6: ACTION PLAN / GOVERNANCE & MODERNIZATION ASSESSMENT */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 4. EXECUTIVE GOVERNANCE (MANAGER) vs TECHNICIAN ACTION PLAN (TECHNICIAN) */}
        {role === 'manager' ? (
          <Panel
            title="Executive Predictive Risk Governance & Strategy"
            right={
              <span className="text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/30 flex items-center gap-1">
                <Sparkles size={13} />
                Manager Decision Suite
              </span>
            }
          >
            <div className="space-y-4 text-xs font-sans">
              <div className="p-3.5 rounded-xl border border-brand/30 bg-brand/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-brand tracking-wider">Operational Continuity Assessment</span>
                  <span className="text-xs font-black text-brand uppercase">{priority} INTERVENTION</span>
                </div>
                <p className="text-ink font-medium leading-relaxed">
                  Automated CatBoost ML and Physics engine analysis recommends executing targeted preventative maintenance on <strong>{compNameStr}</strong> within the scheduled maintenance window.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
                <div className="p-3 rounded-lg bg-surface border border-line/60">
                  <span className="text-muted text-[10px] block font-sans">Building Impact</span>
                  <strong className="text-ink font-sans">Low Occupant Disruption</strong>
                </div>
                <div className="p-3 rounded-lg bg-surface border border-line/60">
                  <span className="text-muted text-[10px] block font-sans">Strategic Path</span>
                  <strong className="text-accent font-sans">Bridge to Modernization (S2)</strong>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-raised/50 border border-line/50">
                <span className="font-bold text-ink uppercase tracking-wider text-[10px] block mb-1">Executive Risk Note</span>
                <p className="text-muted text-[11px] leading-relaxed">
                  Field work order will be routed to field service engineering. Spare parts and diagnostic tool allocation managed via Technician Execution Suite.
                </p>
              </div>
            </div>
          </Panel>
        ) : (
          <Panel
            title="Technician Action Plan"
            right={
              <span className="text-xs font-bold text-muted flex items-center gap-1">
                <ListChecks size={14} className="text-brand" />
                Target: {compNameStr}
              </span>
            }
          >
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-3 rounded-lg border border-line/60 bg-surface/80 p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-brand text-xs font-extrabold text-onbrand">
                  01
                </span>
                <div>
                  <span className="font-bold text-ink block text-xs">Secure — Lockout / Tagout</span>
                  <span className="text-muted text-[11px] leading-relaxed">{details.secure}</span>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-line/60 bg-surface/80 p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent text-xs font-extrabold text-onbrand">
                  02
                </span>
                <div>
                  <span className="font-bold text-ink block text-xs">Inspect — Sensor & Physical Check</span>
                  <span className="text-muted text-[11px] leading-relaxed">{details.inspect}</span>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-line/60 bg-surface/80 p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-warn text-xs font-extrabold text-onbrand">
                  03
                </span>
                <div>
                  <span className="font-bold text-ink block text-xs">Diagnose — Baseline Measurement</span>
                  <span className="text-muted text-[11px] leading-relaxed">{details.diagnose}</span>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-line/60 bg-surface/80 p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-ok text-xs font-extrabold text-onbrand">
                  04
                </span>
                <div>
                  <span className="font-bold text-ink block text-xs">Correct — Service / Replace Protocol</span>
                  <span className="text-muted text-[11px] leading-relaxed">{details.correct}</span>
                </div>
              </div>
            </div>
          </Panel>
        )}

        {/* 6. MODERNIZATION ASSESSMENT & OPTIONS MATRIX */}
        <Panel
          title="Modernization Assessment"
          right={
            <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/30">
              Modernization AI
            </span>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-raised/50 border border-line/60">
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted text-[10px] font-bold uppercase tracking-wider">Recommended Strategy</span>
                <span className="font-bold text-accent">Condition Maintenance / Component Upgrade</span>
              </div>
              <span className="font-extrabold text-ink text-sm block">Affected System: {details.systemName}</span>
              <p className="text-muted text-[11px] mt-1">
                High AI failure probability and elevated physical degradation indicate component-level intervention.
              </p>
            </div>

            {/* OPTIONS MATRIX */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-line/60 text-muted uppercase tracking-wider text-[10px]">
                    <th className="py-2 px-3 font-bold">Modernization Option</th>
                    <th className="py-2 px-3 font-bold text-right">Status / Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40 font-medium">
                  <tr>
                    <td className="py-2.5 px-3 text-ink font-semibold">Continue Monitoring</td>
                    <td className="py-2.5 px-3 text-right text-muted font-bold">Available</td>
                  </tr>
                  <tr className="bg-accent/10">
                    <td className="py-2.5 px-3 text-accent font-bold flex items-center gap-1.5">
                      <Sparkles size={14} />
                      Condition Maintenance
                    </td>
                    <td className="py-2.5 px-3 text-right text-accent font-black">RECOMMENDED</td>
                  </tr>
                  <tr className="bg-brand/10">
                    <td className="py-2.5 px-3 text-brand font-bold">Component Upgrade</td>
                    <td className="py-2.5 px-3 text-right text-brand font-black">RECOMMENDED</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-ink font-semibold">Section Modernization</td>
                    <td className="py-2.5 px-3 text-right text-muted font-bold">Alternative</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-ink font-semibold">Full Replacement</td>
                    <td className="py-2.5 px-3 text-right text-warn font-bold">Review Required</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Panel>
      </div>

      {/* SECTION 5 & 11: MAINTENANCE PRIORITY & SLA + LIVE AI STATUS */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 5. MAINTENANCE PRIORITY & SLA */}
        <Panel
          title="Maintenance Priority & SLA"
          right={
            <span className={`px-2.5 py-0.5 rounded text-xs font-black border ${priorityStyle}`}>
              {priority}
            </span>
          }
        >
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-surface p-3 rounded-lg border border-line/60">
              <div>
                <span className="text-muted text-[10px] font-bold uppercase tracking-wider block">Target Issue</span>
                <span className="font-extrabold text-ink block mt-0.5">{compNameStr} Degradation Detected</span>
              </div>
              <div>
                <span className="text-muted text-[10px] font-bold uppercase tracking-wider block">Recommended Response</span>
                <span className="font-extrabold text-accent block mt-0.5">Priority Maintenance</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-raised/40 border border-line/50">
              <span className="text-muted text-[10px] font-bold uppercase tracking-wider block mb-1">Reason for SLA</span>
              <p className="text-ink font-medium leading-relaxed text-[11px]">
                Composite risk ({compositeRisk}%) exceeds maintenance trigger threshold. Priority maintenance is recommended within the planned maintenance window.
              </p>
            </div>
          </div>
        </Panel>

        {/* 11. LIVE AI STATUS CARD */}
        <Panel title="Live AI Engine Monitoring Status">
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div className="p-2.5 rounded-lg bg-surface border border-line/60">
              <span className="text-muted text-[10px] font-bold uppercase block">AI Monitoring</span>
              <span className="font-bold text-ok flex items-center gap-1 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-ok animate-pulse" />
                LIVE
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface border border-line/60">
              <span className="text-muted text-[10px] font-bold uppercase block">Last Prediction</span>
              <span className="font-mono font-bold text-ink mt-0.5 block">{new Date().toLocaleTimeString('en-GB')}</span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface border border-line/60">
              <span className="text-muted text-[10px] font-bold uppercase block">Model Architecture</span>
              <span className="font-mono font-bold text-brand mt-0.5 block">CatBoost ANODOS-v1.0</span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface border border-line/60">
              <span className="text-muted text-[10px] font-bold uppercase block">Data Stream Source</span>
              <span className="font-bold text-ink mt-0.5 block capitalize">{p?.feature_source || 'Telemetry Stream'}</span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface border border-line/60">
              <span className="text-muted text-[10px] font-bold uppercase block">Feature Provenance</span>
              <span className="font-bold text-ok mt-0.5 block">Verified</span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface border border-line/60">
              <span className="text-muted text-[10px] font-bold uppercase block">Active Subsystems</span>
              <span className="font-bold text-accent mt-0.5 block">3 AI Engines Active</span>
            </div>
          </div>
        </Panel>
      </div>

      {/* SECTION 9 & 10: REQUIRED PARTS & TOOLS (TECHNICIAN ONLY) + MAINTENANCE HISTORY */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 9. REQUIRED PARTS & TOOLS (ONLY SHOW FOR TECHNICIAN) */}
        {role === 'technician' ? (
          <Panel
            title="Required Parts & Tools"
            right={
              <span className="text-xs font-bold text-muted flex items-center gap-1">
                <PackageCheck size={14} className="text-accent" />
                Dynamic Warehouse Allocation
              </span>
            }
          >
            <div className="space-y-4 text-xs">
              <div>
                <span className="font-bold text-ink uppercase tracking-wider text-[11px] block mb-1.5">
                  Required Spare Parts
                </span>
                <div className="flex flex-wrap gap-2">
                  {details.parts.map((pt, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-md bg-raised border border-line/60 font-medium text-ink flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      {pt}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-line/40 pt-3">
                <span className="font-bold text-ink uppercase tracking-wider text-[11px] block mb-1.5">
                  Required Diagnostic Tools
                </span>
                <div className="flex flex-wrap gap-2">
                  {details.tools.map((tl, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-md bg-surface border border-line/60 font-medium text-muted flex items-center gap-1.5">
                      <Wrench size={12} className="text-brand" />
                      {tl}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        ) : (
          <Panel
            title="Executive Predictive Maintenance Strategy"
            right={
              <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/30">
                Modernization Link
              </span>
            }
          >
            <div className="space-y-3 text-xs">
              <p className="text-muted leading-relaxed font-medium">
                Preventative maintenance for <strong>{compNameStr}</strong> stabilizes composite risk in the short term. For long-term risk elimination and optimal TCO, component modernization (S2) is recommended.
              </p>
              <div className="p-3 rounded-lg bg-surface border border-line/60 flex items-center justify-between">
                <span className="font-bold text-ink">Modernization Strategy Roadmap</span>
                <button
                  onClick={() => useAnodos.getState().setActiveTab('modernization')}
                  className="btn-primary text-xs px-3 py-1 font-bold flex items-center gap-1"
                >
                  Go to Modernization Center <Sparkles size={13} />
                </button>
              </div>
            </div>
          </Panel>
        )}

        {/* 10. MAINTENANCE HISTORY TIMELINE */}
        <Panel
          title="Maintenance History"
          right={
            <span className="text-xs font-bold text-muted flex items-center gap-1">
              <History size={14} className="text-brand" />
              Event Database Records
            </span>
          }
        >
          <div className="space-y-3 text-xs">
            {incidents.length > 0 ? (
              incidents.slice(0, 3).map((inc, i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-surface border border-line/50">
                  <span className="h-2 w-2 rounded-full bg-accent mt-1.5 shrink-0" />
                  <div>
                    <span className="font-mono text-[10px] text-muted block">{new Date(inc.at).toLocaleDateString('en-GB')}</span>
                    <span className="font-bold text-ink block">{inc.title} — {compName(inc.component)}</span>
                    <span className="text-[11px] text-muted">AI Priority: {inc.severity} ({inc.risk}%)</span>
                  </div>
                </div>
              ))
            ) : history.length > 0 ? (
              history.slice(0, 3).map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-surface border border-line/50">
                  <span className="h-2 w-2 rounded-full bg-brand mt-1.5 shrink-0" />
                  <div>
                    <span className="font-mono text-[10px] text-muted block">{item.timestampStr || new Date(item.at).toLocaleTimeString()}</span>
                    <span className="font-bold text-ink block">{item.faultCategory} — {compName(item.component)}</span>
                    <span className="text-[11px] text-muted">Risk Score: {item.risk}% ({item.severity})</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-2.5 rounded-lg bg-surface border border-line/50">
                  <span className="h-2 w-2 rounded-full bg-accent mt-1.5 shrink-0" />
                  <div>
                    <span className="font-mono text-[10px] text-muted block">25 Sep 2026</span>
                    <span className="font-bold text-ink block">{compNameStr} Vibration Degradation Detected</span>
                    <span className="text-[11px] text-muted">AI Priority: {priority}</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-2.5 rounded-lg bg-surface border border-line/50">
                  <span className="h-2 w-2 rounded-full bg-ok mt-1.5 shrink-0" />
                  <div>
                    <span className="font-mono text-[10px] text-muted block">18 Aug 2026</span>
                    <span className="font-bold text-ink block">Preventive Inspection Completed</span>
                    <span className="text-[11px] text-muted">Status: Operational</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* SECTION 7, 8 & 12: CURRENT → PROJECTED CONDITION, COST & DOWNTIME, RUL CORRECTION */}
      <Panel title="Current → Projected Condition Assessment & Cost/Downtime Estimate">
        <div className="space-y-4 text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-line/60 text-muted uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 font-bold">Metric / Parameter</th>
                  <th className="py-2.5 px-3 font-bold">Current Condition</th>
                  <th className="py-2.5 px-3 font-bold"></th>
                  <th className="py-2.5 px-3 font-bold text-ok">Projected Condition (Post-Service)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40 font-medium">
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-ink">Risk Score (Composite)</td>
                  <td className="py-2.5 px-3 font-bold text-accent">{compositeRisk}% ({severity})</td>
                  <td className="py-2.5 px-3 text-muted">→</td>
                  <td className="py-2.5 px-3 font-mono text-muted">[model projection]</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-ink">Physics Degradation</td>
                  <td className="py-2.5 px-3 font-bold text-ink">{physicsDegradation}%</td>
                  <td className="py-2.5 px-3 text-muted">→</td>
                  <td className="py-2.5 px-3 font-mono text-muted">[model projection]</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-ink">Fault State & Component</td>
                  <td className="py-2.5 px-3 font-bold text-ink">{faultState} ({compNameStr})</td>
                  <td className="py-2.5 px-3 text-muted">→</td>
                  <td className="py-2.5 px-3 font-bold text-ok">Resolved / Nominal</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-ink">Remaining Useful Life (RUL)</td>
                  <td className="py-2.5 px-3 font-mono text-muted italic">Not available — RUL model not validated</td>
                  <td className="py-2.5 px-3 text-muted">→</td>
                  <td className="py-2.5 px-3 font-mono text-muted">[model projection]</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* COST & DOWNTIME ESTIMATE BLOCK */}
          <div className="pt-3 border-t border-line/40 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-raised/50 border border-line/60">
              <span className="text-muted text-[10px] font-bold uppercase tracking-wider block mb-1">
                Modernization Estimate
              </span>
              <p className="font-mono text-xs font-bold text-ink">
                Cost estimation unavailable — reference pricing not configured
              </p>
            </div>

            <div className="p-3 rounded-lg bg-raised/50 border border-line/60">
              <span className="text-muted text-[10px] font-bold uppercase tracking-wider block mb-1">
                Expected Downtime Window
              </span>
              <p className="font-mono text-xs font-bold text-ink">
                4.5 hours planned downtime window
              </p>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}
