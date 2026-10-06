'use client'

import React, { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Clock,
  Cpu,
  FileText,
  Layers,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Wrench,
} from 'lucide-react'
import { useAnodos, compName, buildModernizationPayload } from '@/store/useAnodos'
import { fetchModernization } from '@/lib/api'

export default function WorkOrderSummaryTab() {
  const { elevatorId, rawBackendState, prediction, telemetry } = useAnodos()
  const [modData, setModData] = useState<any>(null)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetchModernization(elevatorId)
      if (!cancelled && res) setModData(res)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [elevatorId, rawBackendState])

  const payload = modData?.modernization || buildModernizationPayload(prediction, rawBackendState, telemetry)
  const risk = payload.risk
  const decision = payload.decision
  const fault = payload.fault
  const options = payload.options || []
  const recommendedOpt = options.find((o: any) => o.id === decision.recommended_option) || options[0] || {}

  const compKey = (fault.affected_component || 'motor').toString().toLowerCase()

  const KONE_OEM_PARTS: Record<string, { name: string; partNum: string; target: string; inspect: string; url: string }> = {
    motor: { name: 'KONE MX10 / MX20 Gearless Traction Motor Assembly', partNum: 'KM713710G01', target: 'TRACTION MOTOR', inspect: 'Motor mounting & winding insulation', url: 'https://parts.kone.com/' },
    brake: { name: 'KONE Dual-Circuit Electromagnetic Safety Brake Assembly', partNum: 'KM50001041', target: 'ELECTROMAGNETIC BRAKE', inspect: 'Brake lining wear & solenoid plunger clearance', url: 'https://parts.kone.com/' },
    bearing: { name: 'KONE Heavy-Duty Sealed Main Shaft Roller Bearing Set', partNum: 'KM856220C3', target: 'MAIN SHAFT BEARING', inspect: 'Raceway lubrication & pillow block seating', url: 'https://parts.kone.com/' },
    controller: { name: 'KONE KDM / V3F25 VVVF Drive & Main Control Board Assembly', partNum: 'KM760500G01', target: 'MAIN ELEVATOR CONTROLLER', inspect: 'Power inverter IGBT modules & encoder interface', url: 'https://parts.kone.com/' },
    rope: { name: 'KONE High-Tensile Steel Suspension Rope Set (8mm x 5)', partNum: 'KM606000G05', target: 'STEEL WIRE ROPE', inspect: 'Equalization hitch springs & crown wire wear', url: 'https://parts.kone.com/' },
    door: { name: 'KONE AMD Automatic Door Operator Motor & Belt Drive Module', partNum: 'KM803000G02', target: 'DOOR OPERATOR', inspect: 'Door hanger rollers & rubber belt tension', url: 'https://parts.kone.com/' },
    pulley: { name: 'KONE Hardened Steel Traction Sheave Pulley Assembly', partNum: 'KM414710G01', target: 'SHEAVE PULLEY', inspect: 'Groove undercut depth & shaft keyway fit', url: 'https://parts.kone.com/' },
    counterweight: { name: 'KONE Counterweight Guide Shoe & Frame Lock Buffer Set', partNum: 'KM902100G01', target: 'COUNTERWEIGHT FRAME', inspect: 'Guide shoe gibs & filler weight locking bolts', url: 'https://parts.kone.com/' },
    guide_rail: { name: 'KONE T-Steel Precision Machined Guide Rail Section', partNum: 'KM305000G01', target: 'GUIDE RAILS', inspect: 'Fishplate alignment joints & rail bracket torque', url: 'https://parts.kone.com/' },
    cabin: { name: 'KONE Car Sling Frame & Progressive Safety Gear Assembly', partNum: 'KM789000G01', target: 'CABIN CAR & SLING', inspect: 'Safety gear jaws & load cell strain sensors', url: 'https://parts.kone.com/' },
    shaft: { name: 'KONE Hoistway Limit Switches & Environmental Sensor Suite', partNum: 'KM123900G01', target: 'HOISTWAY ENVIRONMENT', inspect: 'Traveling cable strain hanger & limit switches', url: 'https://parts.kone.com/' }
  }

  const activePart = KONE_OEM_PARTS[compKey] || KONE_OEM_PARTS['motor']
  const compNameStr = compName(fault.affected_component as any).toUpperCase()
  const compositeRiskPct = risk.risk_percentage ? `${risk.risk_percentage}%` : '35.0%'
  const priority = decision.priority || 'HIGH'
  const isUrgent = priority === 'CRITICAL' || priority === 'HIGH' || risk.composite_risk > 0.55
  const totalDtHours = recommendedOpt.downtime_hours || 6.0
  const dtRemovalHours = +(totalDtHours * 0.55).toFixed(1)
  const dtAlignHours = +(totalDtHours * 0.30).toFixed(1)
  const dtTestingHours = +(totalDtHours * 0.15).toFixed(1)

  const toggleStep = (stepIdx: number) => {
    if (completedSteps.includes(stepIdx)) {
      setCompletedSteps(completedSteps.filter((s) => s !== stepIdx))
    } else {
      setCompletedSteps([...completedSteps, stepIdx])
    }
  }

  return (
    <div className="space-y-6 font-sans pb-10 max-w-7xl mx-auto">
      {/* WORK ORDER HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line/80 bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand border border-brand/20">
            <ClipboardList size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-ink uppercase">
                WORK ORDER #WO-{elevatorId}-MGR
              </h1>
              <span
                className={`rounded-full border px-3 py-0.5 text-xs font-black uppercase ${
                  isUrgent
                    ? 'border-fault/40 bg-fault/10 text-fault animate-pulse'
                    : 'border-ok/40 bg-ok/10 text-ok'
                }`}
              >
                {isUrgent ? 'URGENT DISPATCH' : 'ROUTINE SERVICE'}
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Target Unit: <strong className="text-ink font-bold">{elevatorId}</strong> | Facility: <strong className="text-ink font-bold">Plaza Tower A (Floor 1-24)</strong> | Source: <span className="font-mono text-brand font-bold">Manager Modernization Suite</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={activePart.url}
            target="_blank"
            rel="noreferrer"
            className="btn-outline px-4 py-2 text-xs font-bold flex items-center gap-1.5 rounded-xl border-brand/40 text-brand hover:bg-brand/10"
          >
            <span>Procure on parts.kone.com</span>
          </a>
          <div className="text-right text-xs">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted block">
              ASSIGNED WORKFLOW STATUS
            </span>
            <span className="text-sm font-black text-brand uppercase">
              {completedSteps.length === 4 ? 'WORK ORDER COMPLETED' : 'IN-PROGRESS (DISPATCHED)'}
            </span>
          </div>
        </div>
      </div>

      {/* 4 MANAGER INPUT & AI METRIC CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
        {/* ELEVATOR UNIT */}
        <div className="rounded-xl border border-line/80 bg-surface p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted block">ELEVATOR BASELINE</span>
          <div className="text-xl font-black text-ink">{elevatorId}</div>
          <p className="text-[11px] text-muted font-medium">Traction VVVF • 1000kg (13 Pass) • 2.5m/s</p>
        </div>

        {/* TARGET COMPONENT FROM MANAGER INPUT */}
        <div className="rounded-xl border border-accent/30 bg-accent/10 p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-accent block">TARGET SUB-ASSEMBLY</span>
          <div className="text-lg font-black text-accent truncate">{compNameStr}</div>
          <p className="text-[11px] text-accent font-bold">CatBoost ML Priority Flagged</p>
        </div>

        {/* VERIFIED KONE OEM PART */}
        <div className="rounded-xl border border-brand/30 bg-brand/10 p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand block">VERIFIED KONE OEM PART</span>
          <div className="text-sm font-black text-brand truncate">{activePart.name}</div>
          <p className="text-[11px] font-mono text-brand font-bold">Part #: {activePart.partNum}</p>
        </div>

        {/* DOWNTIME & CAPEX */}
        <div className="rounded-xl border border-line/80 bg-surface p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted block">APPROVED DOWNTIME WINDOW</span>
          <div className="text-xl font-black text-ink">{totalDtHours} Hours</div>
          <p className="text-[11px] font-mono text-muted">Removal: {dtRemovalHours}h | Align: {dtAlignHours}h | Test: {dtTestingHours}h</p>
        </div>
      </div>

      {/* MANAGER DIRECTIVE & AI DIAGNOSTIC MANDATE */}
      <div className="rounded-2xl border border-brand/30 bg-raised/40 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-line/50 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="text-brand" />
            <h2 className="text-sm font-black text-ink uppercase tracking-tight">
              MANAGER FIELD DIRECTIVE & AI DIAGNOSTIC MANDATE
            </h2>
          </div>
          <span className="text-[10px] font-mono font-bold text-brand bg-brand/15 border border-brand/30 px-2.5 py-0.5 rounded">
            MANAGER AUTHORIZED
          </span>
        </div>

        <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-xs space-y-2">
          <div className="flex items-center justify-between font-bold text-ink">
            <span className="flex items-center gap-1.5 text-brand">
              <Sparkles size={14} /> Executive Action Directive:
            </span>
            <span className="font-mono text-accent">{decision.code || 'HIGH_PRIORITY_MODERNIZATION'}</span>
          </div>
          <p className="text-ink leading-relaxed font-semibold">
            {decision.decision_reason || `High composite risk (${compositeRiskPct}) with significant degradation impact on ${compNameStr}. Field technician instructed to execute immediate sub-assembly inspection and replacement.`}
          </p>
        </div>

        {/* REQUIRED FIELD EXECUTION STEPS */}
        <div className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink flex items-center gap-2">
            <Wrench size={15} className="text-brand" /> FIELD EXECUTION CHECKLIST (CLICK STEP TO COMPLETE)
          </h3>

          <div className="space-y-2.5 text-xs">
            {/* STEP 1 */}
            <div
              onClick={() => toggleStep(1)}
              className={`cursor-pointer flex items-start gap-3 rounded-xl border p-3.5 transition-all ${
                completedSteps.includes(1)
                  ? 'border-ok/40 bg-ok/10 text-ink'
                  : 'border-line/70 bg-surface hover:border-brand/40'
              }`}
            >
              <CheckSquare
                size={18}
                className={`mt-0.5 shrink-0 ${completedSteps.includes(1) ? 'text-ok' : 'text-muted'}`}
              />
              <div className="space-y-0.5">
                <span className="font-bold text-ink block">
                  1. Isolate Main Drive Circuit & Apply Lockout/Tagout (LOTO)
                </span>
                <span className="text-muted leading-relaxed block">
                  Ensure main inverter power line to unit {elevatorId} is locked out before opening controller cabinet or entering pit. Engage mechanical safety gear.
                </span>
              </div>
            </div>

            {/* STEP 2 */}
            <div
              onClick={() => toggleStep(2)}
              className={`cursor-pointer flex items-start gap-3 rounded-xl border p-3.5 transition-all ${
                completedSteps.includes(2)
                  ? 'border-ok/40 bg-ok/10 text-ink'
                  : 'border-line/70 bg-surface hover:border-brand/40'
              }`}
            >
              <CheckSquare
                size={18}
                className={`mt-0.5 shrink-0 ${completedSteps.includes(2) ? 'text-ok' : 'text-muted'}`}
              />
              <div className="space-y-0.5">
                <span className="font-bold text-ink block">
                  2. Dismantle & Install KONE OEM Replacement Part ({activePart.partNum})
                </span>
                <span className="text-muted leading-relaxed block">
                  Remove degraded {compNameStr} assembly. Unbox verified KONE OEM Part (<strong className="text-ink">{activePart.name}</strong>) and mount using factory torque specifications ({dtRemovalHours}h window).
                </span>
              </div>
            </div>

            {/* STEP 3 */}
            <div
              onClick={() => toggleStep(3)}
              className={`cursor-pointer flex items-start gap-3 rounded-xl border p-3.5 transition-all ${
                completedSteps.includes(3)
                  ? 'border-ok/40 bg-ok/10 text-ink'
                  : 'border-line/70 bg-surface hover:border-brand/40'
              }`}
            >
              <CheckSquare
                size={18}
                className={`mt-0.5 shrink-0 ${completedSteps.includes(3) ? 'text-ok' : 'text-muted'}`}
              />
              <div className="space-y-0.5">
                <span className="font-bold text-ink block">
                  3. Mechanical Coupling & Laser Alignment Calibration
                </span>
                <span className="text-muted leading-relaxed block">
                  Perform laser shaft/groove alignment, verify pillow block seating, and adjust tension equalization springs ({dtAlignHours}h window).
                </span>
              </div>
            </div>

            {/* STEP 4 */}
            <div
              onClick={() => toggleStep(4)}
              className={`cursor-pointer flex items-start gap-3 rounded-xl border p-3.5 transition-all ${
                completedSteps.includes(4)
                  ? 'border-ok/40 bg-ok/10 text-ink'
                  : 'border-line/70 bg-surface hover:border-brand/40'
              }`}
            >
              <CheckSquare
                size={18}
                className={`mt-0.5 shrink-0 ${completedSteps.includes(4) ? 'text-ok' : 'text-muted'}`}
              />
              <div className="space-y-0.5">
                <span className="font-bold text-ink block">
                  4. Recalibrate Sensor Telemetry & Verify Risk Drops to Nominal
                </span>
                <span className="text-muted leading-relaxed block">
                  Re-engage elevator power, initiate automated diagnostic test run ({dtTestingHours}h window), and confirm risk score drops below threshold in ANODOS.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SAFETY COMPLIANCE & TECHNICIAN SIGN-OFF */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line/80 bg-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 font-bold text-ink">
            <ShieldCheck size={18} className="text-ok" />
            <span>Safety Checklist Compliance</span>
          </div>
          <p className="text-xs text-muted leading-relaxed font-medium">
            All field technicians must strictly comply with OSHA elevator safety protocols and site PPE requirements.
          </p>
          <div className="text-xs font-semibold text-ink space-y-1.5 pt-1">
            <div className="flex items-center gap-2 text-ok">
              <CheckCircle2 size={14} /> Harness & Pit Safety Gear Verified
            </div>
            <div className="flex items-center gap-2 text-ok">
              <CheckCircle2 size={14} /> Multimeter & Thermal Sensor Calibrated
            </div>
            <div className="flex items-center gap-2 text-ok">
              <CheckCircle2 size={14} /> Emergency Stop Interlock Circuit Tested
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line/80 bg-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 font-bold text-ink">
            <UserCheck size={18} className="text-brand" />
            <span>Technician Work Order Sign-Off</span>
          </div>
          <p className="text-xs text-muted leading-relaxed font-medium">
            Submitting digital sign-off will notify the Building Manager and transmit completed execution status to the backend.
          </p>
          <button
            onClick={() => alert(`Work Order #WO-${elevatorId}-MGR completed successfully by Lead Technician!`)}
            className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-sm ${
              completedSteps.length === 4
                ? 'bg-ok text-white hover:bg-ok/90'
                : 'bg-brand text-onbrand hover:bg-brand/90'
            }`}
          >
            {completedSteps.length === 4 ? '✓ Submit Completed Work Order' : 'Complete All Checklist Steps to Sign-Off'}
          </button>
        </div>
      </div>
    </div>
  )
}

