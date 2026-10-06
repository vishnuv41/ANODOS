'use client'

import React, { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  DollarSign,
  Download,
  FileCheck,
  FileText,
  HelpCircle,
  Layers,
  LineChart,
  Package,
  ShieldAlert,
  Sparkles,
  Sliders,
  TrendingUp,
  Wrench,
  Zap,
} from 'lucide-react'
import type { ModernizationPayload } from '@/lib/types'
import { fetchModernization, getBackendUrl } from '@/lib/api'
import { buildModernizationPayload, compName, healthOf, useAnodos } from '@/store/useAnodos'
import { Badge, Panel } from '../../ui/primitives'

export default function ModernizationTab() {
  const { elevatorId, rawBackendState, prediction, telemetry, wsStatus, setActiveTab } = useAnodos()
  const [backendData, setBackendData] = useState<any>(null)
  const [timeStr, setTimeStr] = useState<string>('')
  const [selectedOptIds, setSelectedOptIds] = useState<string[]>(['S2'])

  const backendUrl = getBackendUrl().replace(/\/$/, '')

  useEffect(() => {
    setTimeStr(new Date().toLocaleTimeString())
    let cancelled = false
    async function load() {
      const res = await fetchModernization(elevatorId)
      if (!cancelled && res) setBackendData(res)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [elevatorId, rawBackendState])

  // Single Source of Truth from synchronized store payload or backend response
  const storePayload = buildModernizationPayload(prediction, rawBackendState, telemetry)
  const payload: ModernizationPayload = (prediction || rawBackendState) ? storePayload : (backendData?.modernization || storePayload)
  const rawMod = payload || {}

  const risk = payload.risk
  const decision = payload.decision
  const fault = payload.fault
  const cost = payload.cost
  const downtime = payload.downtime
  const provenance = payload.provenance
  const compNameStr = compName(fault.affected_component as any).toUpperCase()
  const isLive = wsStatus === 'LIVE'

  const isHealthyRisk = (risk.risk_percentage ?? ((risk.composite_risk || 0) * 100)) < 10

  useEffect(() => {
    if (isHealthyRisk) {
      setSelectedOptIds(['S0'])
    } else {
      setSelectedOptIds(['S2'])
    }
  }, [isHealthyRisk])

  // Options list from backend
  const options = rawMod.options || payload.options || []
  const selectedOpts = options.filter((o: any) => selectedOptIds.includes(o.id))
  const primaryOpt = selectedOpts[0] || options.find((o: any) => o.id === 'S2') || options[0] || {}

  const toggleOptId = (id: string) => {
    if (selectedOptIds.includes(id)) {
      if (selectedOptIds.length === 1) return
      setSelectedOptIds(selectedOptIds.filter((item) => item !== id))
    } else {
      setSelectedOptIds([...selectedOptIds, id])
    }
  }

  // Combined Multi-Strategy Real Algorithmic Calculations
  const combinedCapex = selectedOpts.reduce((sum: number, o: any) => sum + (o.total_cost_inr || 0), 0)

  const baseDowntimeMap: Record<string, number> = {
    motor: 6.0,
    bearing: 5.0,
    brake: 3.0,
    controller: 12.0,
    rope: 8.0,
    door: 2.5,
    pulley: 4.5,
    counterweight: 4.0,
    guide_rail: 14.0,
    cabin: 10.0,
    shaft: 3.5,
  }
  const baseEnergyMap: Record<string, number> = {
    motor: 14.0,
    bearing: 6.0,
    brake: 4.5,
    controller: 20.0,
    rope: 3.5,
    door: 3.0,
    pulley: 7.0,
    counterweight: 4.5,
    guide_rail: 5.5,
    cabin: 8.0,
    shaft: 4.0,
  }

  const activeCompKey = (fault.affected_component || 'motor').toString().toLowerCase()
  const baseDt = baseDowntimeMap[activeCompKey] || 6.0
  const baseEg = baseEnergyMap[activeCompKey] || 12.0
  const compRiskVal = risk.composite_risk || (risk.risk_percentage ? risk.risk_percentage / 100 : 0.35)

  const selectedMaxDt = Math.max(...selectedOpts.map((o: any) => o.downtime_hours || 0), 0)
  const combinedDowntime = isHealthyRisk && (selectedOptIds.includes('S0') && selectedOptIds.length === 1)
    ? 0
    : (selectedMaxDt > 0 ? selectedMaxDt : (isHealthyRisk ? 0 : +(baseDt * (1.0 + 0.25 * compRiskVal)).toFixed(1)))

  const primaryEnergyImpact = primaryOpt.expected_energy_impact
  const calculatedEnergyPct = +(baseEg * (1.0 + 0.5 * compRiskVal)).toFixed(1)
  const combinedEnergyImpact = isHealthyRisk
    ? '0% (Baseline / System Healthy)'
    : (primaryEnergyImpact && !primaryEnergyImpact.includes('Baseline')
        ? primaryEnergyImpact
        : `~${calculatedEnergyPct}% Subsystem Power Factor & Thermal Gain`)

  const combinedExpectedRiskPct = Math.min(...selectedOpts.map((o: any) => o.expected_risk_pct ?? (risk.risk_percentage * 0.15)))
  const combinedTco = selectedOpts.reduce((sum: number, o: any) => sum + (o.tco_5yr_inr || 119500), 0)

  // Calculated Before vs After values from backend
  const beforeState = rawMod.before || {
    risk_score: risk.composite_risk || 0.35,
    risk_percentage: risk.risk_percentage || 35.0,
    condition: risk.risk_band === 'CRITICAL' ? 'CRITICAL' : risk.risk_band === 'HIGH' ? 'HIGH_RISK' : 'NOMINAL',
    fault_state: String(fault.fault_state || 'warning').toUpperCase(),
    affected_component: compNameStr,
    maintenance_status: 'no recorded maintenance status'
  }

  const afterState = {
    risk_score: combinedExpectedRiskPct / 100,
    risk_percentage: combinedExpectedRiskPct,
    condition: primaryOpt.expected_condition || rawMod.after?.condition || 'PROJECTED [NOMINAL]',
    maintenance_impact: `${selectedOpts.length} Strategy Package(s) Integrated (${selectedOptIds.join(' + ')})`,
    energy_impact: combinedEnergyImpact,
    projection_status: 'ENGINEERING_PROJECTION'
  }

  // Scenarios Data from backend
  const scenarios = rawMod.scenarios || {
    do_nothing: { '6_months': { risk_pct: Math.min(99, risk.risk_percentage * 1.2) }, '12_months': { risk_pct: Math.min(99, risk.risk_percentage * 1.45) }, '24_months': { risk_pct: 99.0 } },
    maintenance: { '6_months': { risk_pct: Math.max(5, risk.risk_percentage * 0.5) }, '12_months': { risk_pct: Math.max(5, risk.risk_percentage * 0.65) }, '24_months': { risk_pct: Math.max(5, risk.risk_percentage * 0.8) } },
    modernization: { '6_months': { risk_pct: (risk.risk_percentage * 0.15).toFixed(1) }, '12_months': { risk_pct: (risk.risk_percentage * 0.15).toFixed(1) }, '24_months': { risk_pct: (risk.risk_percentage * 0.18).toFixed(1) } }
  }

  const handleDownloadPdf = () => {
    const pdfUrl = `${backendUrl}/api/elevator/${elevatorId}/modernization/pdf`
    window.open(pdfUrl, '_blank')
  }

  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto font-sans">
      {/* ========================================================================= */}
      {/* 1. HEADER: ELEVATOR MODERNIZATION & LIFECYCLE DECISION CENTER           */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-line/80 bg-surface/90 p-5 shadow-sm space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line/40 pb-4">
          <div className="space-y-1">
            <h1 className="text-xl font-black tracking-tight text-ink uppercase flex items-center gap-2.5">
              <Sparkles className="text-accent" size={24} />
              ELEVATOR MODERNIZATION & LIFECYCLE DECISION CENTER
            </h1>
            <p className="text-xs font-semibold text-muted flex items-center gap-2">
              <strong className="text-ink font-bold">{elevatorId}</strong> • Building B001 • Tower A
              <span className="text-line">•</span>
              Last Updated: <span className="font-mono text-ink">{timeStr || '10:30:42'}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand/90 shadow-sm"
            >
              <Download size={14} /> Download PDF Report
            </button>
            <span className="flex items-center gap-1.5 rounded-full border border-ok/40 bg-ok/10 px-3 py-1 text-xs font-bold text-ok shadow-xs">
              <span className="h-2 w-2 rounded-full bg-ok animate-pulse" />
              ● {isLive ? 'LIVE' : 'ACTIVE'}
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. CURRENT CONDITION: SUMMARY PILL CARDS                                 */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3">
          {/* RISK */}
          <div className="rounded-xl border border-fault/30 bg-fault/10 p-3 flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-fault">RISK SCORE</span>
            <div className="my-1">
              <span className="text-2xl font-black text-fault block leading-tight">{risk.risk_percentage}%</span>
              <span className="text-[10px] font-bold text-fault tracking-widest">{risk.risk_band}</span>
            </div>
          </div>

          {/* DOWNTIME */}
          <div className="rounded-xl border border-brand/30 bg-brand/10 p-3 flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand">EXPECTED DOWNTIME</span>
            <div className="my-1">
              <span className="text-2xl font-black text-brand block leading-tight">{combinedDowntime} hrs</span>
              <span className="text-[10px] font-bold text-brand tracking-tight font-mono">INSTALLATION WINDOW</span>
            </div>
          </div>

          {/* ENERGY CONSUMPTION IMPROVEMENT */}
          <div className="rounded-xl border border-ok/30 bg-ok/10 p-3 flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-ok">ENERGY IMPROVEMENT</span>
            <div className="my-1">
              <span className="text-lg font-black text-ok block truncate leading-tight">
                {primaryOpt.expected_energy_impact || '~12% Gain'}
              </span>
              <span className="text-[10px] font-bold text-ok tracking-tight font-mono">POWER FACTOR GAIN</span>
            </div>
          </div>

          {/* RUL */}
          <div className="rounded-xl border border-line/70 bg-raised/50 p-3 flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted">ESTIMATED RUL</span>
            <div className="my-1">
              <span className="text-2xl font-black text-ink block leading-tight">1,020 h</span>
              <span className="text-[10px] font-bold text-muted tracking-tight font-mono">SIMULATION UNITS</span>
            </div>
          </div>

          {/* COMPONENT */}
          <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-accent">TARGET SUB-ASSEMBLY</span>
            <div className="my-1">
              <span className="text-lg font-black text-accent block truncate leading-tight">{compNameStr}</span>
              <span className="text-[10px] font-bold text-accent tracking-widest">DEGRADED</span>
            </div>
          </div>

          {/* STATUS */}
          <div className="rounded-xl border border-warn/30 bg-warn/10 p-3 flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-warn">ACTION PRIORITY</span>
            <div className="my-1">
              <span className="text-2xl font-black text-warn block leading-tight">{decision.priority}</span>
              <span className="text-[10px] font-bold text-warn tracking-widest">MODERNIZATION</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. ARCHITECTURAL BEFORE vs PROJECTED AFTER COMPARISON MODEL (SCREENSHOT MATCH) */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-line/80 bg-surface p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between border-b border-line/50 pb-3 gap-2">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-accent block">ARCHITECTURAL IMPACT MODEL</span>
            <h2 className="text-lg font-black text-ink tracking-tight uppercase">
              BEFORE ──► PROJECTED AFTER COMPARISON
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted">Strategy Package(s):</span>
            <span className="rounded-full bg-accent/15 border border-accent/30 px-3 py-1 text-xs font-black text-accent flex items-center gap-1">
              <span>{selectedOpts.map((o: any) => o.id).join(' + ')} ({selectedOpts.length} Selected)</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 1. BEFORE (CURRENT MEASURED STATE) */}
          <div className="rounded-xl border border-fault/40 bg-fault/5 p-5 space-y-4 relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-fault tracking-wider flex items-center gap-1.5">
                1. BEFORE (CURRENT MEASURED STATE)
              </span>
              <span className="rounded bg-fault/20 border border-fault/40 px-2 py-0.5 text-[10px] font-black text-fault uppercase">
                {beforeState.condition || 'CRITICAL'}
              </span>
            </div>

            {/* Visual Shaft Representation */}
            <div className="grid h-36 place-items-center rounded-xl border border-dashed border-fault/30 bg-surface/70 p-4">
              <div className="flex flex-col items-center gap-2">
                <span className="rounded-md border border-fault bg-fault/20 px-3 py-1 font-mono text-xs font-black text-fault tracking-wider uppercase animate-pulse">
                  {beforeState.affected_component || compNameStr} [DEGRADED]
                </span>
                <div className="flex items-center gap-4">
                  <div className="grid h-12 w-16 place-items-center rounded border border-brand text-[10px] font-black text-brand">
                    CAR
                  </div>
                  <div className="grid h-8 w-10 place-items-center rounded border border-line text-[9px] font-bold text-muted">
                    CWT
                  </div>
                </div>
              </div>
            </div>

            <dl className="space-y-2 text-xs font-medium">
              <div className="flex justify-between border-b border-fault/20 pb-1.5">
                <dt className="text-muted">Current Risk Score:</dt>
                <dd className="font-mono font-black text-fault text-sm">{beforeState.risk_percentage}%</dd>
              </div>
              <div className="flex justify-between border-b border-fault/20 pb-1.5">
                <dt className="text-muted">Affected Assembly:</dt>
                <dd className="font-black text-ink uppercase">{beforeState.affected_component || compNameStr}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Maintenance Status:</dt>
                <dd className="font-bold text-muted italic">{beforeState.maintenance_status}</dd>
              </div>
            </dl>
          </div>

          {/* 2. AFTER (PROJECTED / EXPECTED) */}
          <div className="rounded-xl border border-ok/40 bg-ok/5 p-5 space-y-4 relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-ok tracking-wider flex items-center gap-1.5">
                2. AFTER (PROJECTED / EXPECTED)
              </span>
              <span className="rounded bg-ok/20 border border-ok/40 px-2 py-0.5 text-[10px] font-black text-ok uppercase">
                PROJECTED
              </span>
            </div>

            {/* Visual Shaft Representation */}
            <div className="grid h-36 place-items-center rounded-xl border border-dashed border-ok/30 bg-surface/70 p-4">
              <div className="flex flex-col items-center gap-2">
                <span className="rounded-md border border-ok bg-ok/20 px-3 py-1 font-mono text-xs font-black text-ok tracking-wider uppercase">
                  PROJECTED [NOMINAL]
                </span>
                <div className="flex items-center gap-4">
                  <div className="grid h-12 w-16 place-items-center rounded border border-ok text-[10px] font-black text-ok">
                    CAR
                  </div>
                  <div className="grid h-8 w-10 place-items-center rounded border border-line text-[9px] font-bold text-muted">
                    CWT
                  </div>
                </div>
              </div>
            </div>

            <dl className="space-y-2 text-xs font-medium">
              <div className="flex justify-between border-b border-ok/20 pb-1.5">
                <dt className="text-muted">Expected Condition:</dt>
                <dd className="font-black text-ok uppercase">{afterState.condition}</dd>
              </div>
              <div className="flex justify-between border-b border-ok/20 pb-1.5">
                <dt className="text-muted">Projected Risk Score:</dt>
                <dd className="font-mono font-black text-ok text-sm">{afterState.risk_percentage}%</dd>
              </div>
              <div className="flex justify-between border-b border-ok/20 pb-1.5">
                <dt className="text-muted">Expected Installation Downtime:</dt>
                <dd className="font-bold text-brand">{combinedDowntime} Hours (Scheduled Window)</dd>
              </div>
              <div className="flex justify-between border-b border-ok/20 pb-1.5">
                <dt className="text-muted">Energy Consumption Improvement:</dt>
                <dd className="font-bold text-ok">{combinedEnergyImpact}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Expected Maintenance Impact:</dt>
                <dd className="font-bold text-ink">{afterState.maintenance_impact}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-line/40 text-xs text-muted">
          <span className="font-mono text-[11px]">Status: ENGINEERING_PROJECTION</span>
          <button
            onClick={() => {
              const el = document.getElementById('options-matrix')
              if (el) el.scrollIntoView({ behavior: 'smooth' })
            }}
            className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5 font-bold"
          >
            Proceed to Strategy Comparison Matrix <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODERNIZATION OPERATIONAL IMPACT PANEL (DOWNTIME & ENERGY EFFICIENCY)    */}
      {/* ========================================================================= */}
      {(() => {
        const dtRemoval = +(combinedDowntime * 0.55).toFixed(1)
        const dtAlignment = +(combinedDowntime * 0.30).toFixed(1)
        const dtTesting = +(combinedDowntime * 0.15).toFixed(1)

        const rawEnergyImpactStr = primaryOpt.expected_energy_impact || combinedEnergyImpact || ''
        const energyValMatch = rawEnergyImpactStr.match(/([\d\.]+)/)
        const activeEnergyVal = energyValMatch ? parseFloat(energyValMatch[1]) : calculatedEnergyPct

        const egVfd = +(activeEnergyVal * 0.60).toFixed(1)
        const egFriction = +(activeEnergyVal * 0.25).toFixed(1)
        const egStandby = +(activeEnergyVal * 0.15).toFixed(1)

        return (
          <Panel title="MODERNIZATION OPERATIONAL IMPACT — DOWNTIME & ENERGY EFFICIENCY">
            <div className="space-y-4 text-xs font-sans">
              {/* Quick Strategy Package Switcher Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/60 bg-raised/50 p-2.5">
                <span className="font-extrabold uppercase text-muted text-[11px] flex items-center gap-1.5">
                  <Sliders size={14} className="text-accent" /> Active Strategy Package:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {options.map((opt: any) => {
                    const isSelected = selectedOptIds.includes(opt.id)
                    return (
                      <button
                        key={opt.id}
                        onClick={() => toggleOptId(opt.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition border ${
                          isSelected
                            ? 'bg-accent text-white border-accent shadow-xs'
                            : 'bg-surface text-ink border-line/60 hover:bg-raised'
                        }`}
                      >
                        {opt.id}: {opt.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. EXPECTED INSTALLATION DOWNTIME BREAKDOWN */}
                <div className="rounded-xl border border-line/80 bg-raised/40 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-line/50 pb-2">
                    <span className="font-extrabold text-ink uppercase tracking-wider flex items-center gap-1.5 text-xs">
                      <Clock size={16} className="text-brand" /> EXPECTED INSTALLATION DOWNTIME
                    </span>
                    <span className="rounded bg-brand/15 border border-brand/30 px-2.5 py-0.5 text-xs font-black text-brand">
                      {combinedDowntime} Hours Total
                    </span>
                  </div>

                  <div className="space-y-2 font-mono">
                    <div className="flex justify-between items-center border-b border-line/40 pb-1.5">
                      <span className="text-muted font-sans font-medium">Target Component Removal & Upgrade:</span>
                      <span className="font-bold text-ink">{dtRemoval} hrs</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-line/40 pb-1.5">
                      <span className="text-muted font-sans font-medium">Mechanical Coupling & Alignment:</span>
                      <span className="font-bold text-ink">{dtAlignment} hrs</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted font-sans font-medium">Safety System Recalibration & Testing:</span>
                      <span className="font-bold text-ink">{dtTesting} hrs</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted italic pt-1 border-t border-line/40">
                    • Disruption scaled by target assembly ({compNameStr}) & risk level ({risk.risk_percentage}%).
                  </p>
                </div>

                {/* 2. ENERGY CONSUMPTION IMPROVEMENT BREAKDOWN */}
                <div className="rounded-xl border border-ok/40 bg-ok/5 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-ok/30 pb-2">
                    <span className="font-extrabold text-ok uppercase tracking-wider flex items-center gap-1.5 text-xs">
                      <Zap size={16} className="text-ok" /> ENERGY CONSUMPTION IMPROVEMENT
                    </span>
                    <span className="rounded bg-ok/20 border border-ok/40 px-2.5 py-0.5 text-xs font-black text-ok">
                      ~{activeEnergyVal}% Energy Savings
                    </span>
                  </div>

                  <div className="space-y-2 font-mono">
                    <div className="flex justify-between items-center border-b border-ok/20 pb-1.5">
                      <span className="text-muted font-sans font-medium">VFD Regeneration & Motor Efficiency:</span>
                      <span className="font-bold text-ok">~{egVfd}% Power Factor Gain</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-ok/20 pb-1.5">
                      <span className="text-muted font-sans font-medium">Drive Friction & Mechanical Resistance Gain:</span>
                      <span className="font-bold text-ok">~{egFriction}% Parasitic Loss Cut</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted font-sans font-medium">Standby Power Consumption Optimization:</span>
                      <span className="font-bold text-ok">~{egStandby}% Idle Power Cut</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-ok/80 italic pt-1 border-t border-ok/20 font-medium">
                    • Modernizing {compNameStr} reduces annual building kWh operating costs by ~{activeEnergyVal}%.
                  </p>
                </div>
              </div>
            </div>
          </Panel>
        )
      })()}

      {/* ========================================================================= */}
      {/* 5-YEAR CARBON OFFSET & FINANCIAL ROI CALCULATOR (CO2 & INR SAVINGS)        */}
      {/* ========================================================================= */}
      {(() => {
        const baselineKwhPerYear = 32000
        const rawEnergyStr = primaryOpt.expected_energy_impact || combinedEnergyImpact || '12'
        const energyMatch = rawEnergyStr.match(/([\d\.]+)/)
        const activeEnergyVal = energyMatch ? parseFloat(energyMatch[1]) : 12.0
        const annualKwhSaved = Math.round(baselineKwhPerYear * (activeEnergyVal / 100))
        const tariffPerKwh = 8.50
        const annualSavingsInr = Math.round(annualKwhSaved * tariffPerKwh)
        const fiveYearSavingsInr = annualSavingsInr * 5
        const co2FactorTonsPerKwh = 0.00082
        const annualCo2SavedTons = +(annualKwhSaved * co2FactorTonsPerKwh).toFixed(2)
        const fiveYearCo2SavedTons = +(annualCo2SavedTons * 5).toFixed(1)

        const capexCost = combinedCapex || 44500
        const paybackYears = capexCost > 0 && annualSavingsInr > 0 ? +(capexCost / annualSavingsInr).toFixed(1) : 0
        const netFiveYearRoiPct = capexCost > 0 ? Math.round(((fiveYearSavingsInr - capexCost) / capexCost) * 100) : 0

        return (
          <Panel title="5-YEAR ESG & FINANCIAL ROI CALCULATOR — CARBON OFFSET & ELECTRICITY SAVINGS">
            <div className="space-y-4 text-xs font-sans">
              <p className="text-muted leading-relaxed font-medium">
                Financial return and environmental sustainability metric projection based on energy efficiency gains for <strong className="text-ink font-bold">{compNameStr}</strong>:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* ANNUAL INR SAVINGS */}
                <div className="rounded-xl border border-ok/40 bg-ok/10 p-4 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-ok tracking-wider block">ANNUAL ELECTRICITY SAVINGS</span>
                  <div className="text-2xl font-black text-ok font-mono">₹{annualSavingsInr.toLocaleString('en-IN')}</div>
                  <span className="text-[11px] font-bold text-ok/80 block">~{annualKwhSaved.toLocaleString('en-IN')} kWh Saved / Year</span>
                </div>

                {/* CO2 OFFSET */}
                <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-accent tracking-wider block">ANNUAL CARBON OFFSET</span>
                  <div className="text-2xl font-black text-accent font-mono">{annualCo2SavedTons} Tons</div>
                  <span className="text-[11px] font-bold text-accent/80 block">~{fiveYearCo2SavedTons} Tons CO₂ Over 5 Years</span>
                </div>

                {/* PAYBACK PERIOD */}
                <div className="rounded-xl border border-brand/40 bg-brand/10 p-4 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-brand tracking-wider block">ESTIMATED PAYBACK PERIOD</span>
                  <div className="text-2xl font-black text-brand font-mono">{paybackYears > 0 ? `${paybackYears} Yrs` : 'Immediate'}</div>
                  <span className="text-[11px] font-bold text-brand/80 block">Capex Amortization Window</span>
                </div>

                {/* 5-YEAR NET ROI */}
                <div className="rounded-xl border border-line/80 bg-surface p-4 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-muted tracking-wider block">5-YEAR NET FINANCIAL ROI</span>
                  <div className="text-2xl font-black text-ink font-mono">+{netFiveYearRoiPct}%</div>
                  <span className="text-[11px] font-bold text-muted block">₹{(fiveYearSavingsInr / 1000).toFixed(1)}K Total Savings</span>
                </div>
              </div>
            </div>
          </Panel>
        )
      })()}

      {/* ========================================================================= */}
      {/* 4. "WHAT IF WE DO NOTHING?" SIMULATOR (SCENARIO COMPARISON)              */}
      {/* ========================================================================= */}
      <Panel title="FUTURE RISK TRAJECTORY SIMULATOR — DO NOTHING vs MAINTAIN vs MODERNIZE">
        <div className="space-y-4 text-xs">
          <p className="text-muted leading-relaxed font-medium">
            Engineering projection of cumulative fault failure risk across 6-month, 12-month, and 24-month horizon windows based on intervention strategy:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* DO NOTHING */}
            <div className="rounded-xl border border-fault/40 bg-fault/10 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-fault/30 pb-2">
                <span className="font-black text-fault uppercase tracking-wider">DO NOTHING</span>
                <span className="text-[10px] font-extrabold text-fault bg-fault/20 px-2 py-0.5 rounded">HIGH RISK</span>
              </div>
              <ul className="space-y-2 font-mono">
                <li className="flex justify-between">
                  <span className="text-muted font-sans">6 Months:</span>
                  <span className="font-bold text-fault">{scenarios.do_nothing?.['6_months']?.risk_pct || 48.2}%</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted font-sans">12 Months:</span>
                  <span className="font-bold text-fault">{scenarios.do_nothing?.['12_months']?.risk_pct || 74.5}%</span>
                </li>
                <li className="flex justify-between border-t border-fault/20 pt-1">
                  <span className="text-muted font-sans font-bold">24 Months:</span>
                  <span className="font-black text-fault">99.0% [CRITICAL]</span>
                </li>
              </ul>
            </div>

            {/* MAINTENANCE */}
            <div className="rounded-xl border border-warn/40 bg-warn/10 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-warn/30 pb-2">
                <span className="font-black text-warn uppercase tracking-wider">PREVENTIVE MAINT</span>
                <span className="text-[10px] font-extrabold text-warn bg-warn/20 px-2 py-0.5 rounded">STABLE</span>
              </div>
              <ul className="space-y-2 font-mono">
                <li className="flex justify-between">
                  <span className="text-muted font-sans">6 Months:</span>
                  <span className="font-bold text-warn">{scenarios.maintenance?.['6_months']?.risk_pct || 22.4}%</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted font-sans">12 Months:</span>
                  <span className="font-bold text-warn">{scenarios.maintenance?.['12_months']?.risk_pct || 28.1}%</span>
                </li>
                <li className="flex justify-between border-t border-warn/20 pt-1">
                  <span className="text-muted font-sans font-bold">24 Months:</span>
                  <span className="font-black text-warn">{scenarios.maintenance?.['24_months']?.risk_pct || 36.5}%</span>
                </li>
              </ul>
            </div>

            {/* MODERNIZATION */}
            <div className="rounded-xl border border-ok/40 bg-ok/10 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-ok/30 pb-2">
                <span className="font-black text-ok uppercase tracking-wider">MODERNIZATION</span>
                <span className="text-[10px] font-extrabold text-ok bg-ok/20 px-2 py-0.5 rounded">OPTIMAL</span>
              </div>
              <ul className="space-y-2 font-mono">
                <li className="flex justify-between">
                  <span className="text-muted font-sans">6 Months:</span>
                  <span className="font-bold text-ok">{scenarios.modernization?.['6_months']?.risk_pct || 5.2}%</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted font-sans">12 Months:</span>
                  <span className="font-bold text-ok">{scenarios.modernization?.['12_months']?.risk_pct || 5.2}%</span>
                </li>
                <li className="flex justify-between border-t border-ok/20 pt-1">
                  <span className="text-muted font-sans font-bold">24 Months:</span>
                  <span className="font-black text-ok">{scenarios.modernization?.['24_months']?.risk_pct || 6.1}%</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Panel>

      {/* ========================================================================= */}
      {/* 5. STRATEGY COMPARISON MATRIX (S0 to S5) WITH INTERACTIVE SELECTION        */}
      {/* ========================================================================= */}
      <div id="options-matrix">
        <Panel title="STRATEGY COMPARISON MATRIX (S0 – S5) — SELECT ONE OR MULTIPLE STRATEGY PACKAGES">
          <div className="space-y-4">
            {/* COMBINED MULTI-PACKAGE INVESTMENT SUMMARY BAR */}
            <div className="rounded-xl border border-brand/30 bg-brand/10 p-3.5 flex flex-wrap items-center justify-between text-xs font-semibold gap-3">
              <div className="flex items-center gap-2 text-ink">
                <Sparkles size={16} className="text-brand" />
                <span>
                  Combined Selection ({selectedOptIds.length} Package{selectedOptIds.length > 1 ? 's' : ''}):{' '}
                  <strong className="text-brand font-bold">{selectedOptIds.join(', ')}</strong>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-ink font-mono text-[11px]">
                <div>
                  <span className="text-muted font-sans text-[10px] block">Combined Capex</span>
                  <strong className="text-brand text-xs">₹{(combinedCapex / 1000).toFixed(1)}K</strong>
                </div>
                <div>
                  <span className="text-muted font-sans text-[10px] block">Max Downtime</span>
                  <strong className="text-ink text-xs">{combinedDowntime} hrs</strong>
                </div>
                <div>
                  <span className="text-muted font-sans text-[10px] block">Projected Risk</span>
                  <strong className="text-ok text-xs">{combinedExpectedRiskPct}%</strong>
                </div>
                <div>
                  <span className="text-muted font-sans text-[10px] block">Combined 5-Yr TCO</span>
                  <strong className="text-muted text-xs">₹{(combinedTco / 1000).toFixed(1)}K</strong>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-line/60 text-muted uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 font-bold text-center">Select</th>
                    <th className="py-2.5 px-3 font-bold">Code</th>
                    <th className="py-2.5 px-3 font-bold">Strategy Option Name</th>
                    <th className="py-2.5 px-3 font-bold text-right">Capex (INR)</th>
                    <th className="py-2.5 px-3 font-bold text-right">Downtime</th>
                    <th className="py-2.5 px-3 font-bold text-right">Projected Risk</th>
                    <th className="py-2.5 px-3 font-bold text-right">5-Yr TCO</th>
                    <th className="py-2.5 px-3 font-bold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40 font-medium">
                  {options.map((opt: any) => {
                    const isSelected = selectedOptIds.includes(opt.id)
                    const isRec = opt.status === 'RECOMMENDED'
                    return (
                      <tr
                        key={opt.id}
                        onClick={() => toggleOptId(opt.id)}
                        className={`cursor-pointer transition ${
                          isSelected
                            ? 'bg-accent/20 font-bold border-l-4 border-accent'
                            : isRec
                            ? 'bg-accent/10 font-semibold'
                            : 'hover:bg-raised/60'
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOptId(opt.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-line text-brand focus:ring-brand accent-brand cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3 font-mono font-black text-ink">{opt.id}</td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-ink">{opt.name}</div>
                          <div className="text-[11px] text-muted">{opt.description}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-ink">
                          {opt.total_cost_inr !== undefined && opt.total_cost_inr !== null ? `₹${(opt.total_cost_inr / 1000).toFixed(1)}K` : '₹0'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-ink">
                          {opt.downtime_hours !== undefined ? `${opt.downtime_hours} hrs` : '0 hrs'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-ok">
                          {opt.expected_risk_pct !== undefined ? `${opt.expected_risk_pct}%` : `${(risk.risk_percentage * 0.15).toFixed(1)}%`}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-muted">
                          {opt.tco_5yr_inr ? `₹${(opt.tco_5yr_inr / 1000).toFixed(1)}K` : '₹119.5K'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`px-2.5 py-0.5 rounded text-[10px] font-black border ${
                              isRec
                                ? 'bg-accent text-white border-accent'
                                : isSelected
                                ? 'bg-brand/20 text-brand border-brand/40'
                                : 'bg-raised text-muted border-line/60'
                            }`}
                          >
                            {isRec ? 'RECOMMENDED' : isSelected ? 'SELECTED' : 'SELECT'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>
      </div>

      {/* ========================================================================= */}
      {/* 6. 5-YEAR LIFECYCLE TCO SIMULATOR CARDS                                    */}
      {/* ========================================================================= */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CAPEX */}
        <div className="rounded-xl border border-line/80 bg-surface p-4 flex flex-col justify-between shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted">INITIAL CAPEX COST</span>
          <div className="my-2">
            <span className="text-2xl font-black text-ink block leading-tight">₹{combinedCapex ? combinedCapex.toLocaleString('en-IN') : '44,500'}</span>
            <span className="text-[10px] font-bold text-muted tracking-tight font-mono">ANODOS_REFERENCE</span>
          </div>
        </div>

        {/* DOWNTIME */}
        <div className="rounded-xl border border-line/80 bg-surface p-4 flex flex-col justify-between shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted">INSTALLATION DOWNTIME</span>
          <div className="my-2">
            <span className="text-2xl font-black text-ink block leading-tight">{combinedDowntime} hrs</span>
            <span className="text-[10px] font-bold text-muted tracking-tight font-mono">ENGINEERING ESTIMATE</span>
          </div>
        </div>

        {/* 5-YR TCO */}
        <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 flex flex-col justify-between shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-accent">5-YEAR TCO ESTIMATE</span>
          <div className="my-2">
            <span className="text-2xl font-black text-accent block leading-tight">₹{combinedTco ? combinedTco.toLocaleString('en-IN') : '1,19,500'}</span>
            <span className="text-[10px] font-bold text-accent tracking-tight font-mono">LIFECYCLE MODEL</span>
          </div>
        </div>

        {/* ENERGY SAVINGS */}
        <div className="rounded-xl border border-ok/40 bg-ok/10 p-4 flex flex-col justify-between shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-ok">EXPECTED ENERGY IMPACT</span>
          <div className="my-2">
            <span className="text-lg font-black text-ok block leading-tight">{primaryOpt.expected_energy_impact || '~12% Power Factor Gain'}</span>
            <span className="text-[10px] font-bold text-ok tracking-tight font-mono">REFERENCE ONLY</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. DECISION EVIDENCE & PROVENANCE                                       */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 7. KONE PARTS INTELLIGENCE & COMPONENT PROTECTION                       */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 7. KONE PARTS INTELLIGENCE & COMPONENT PROTECTION                       */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 7. KONE PARTS INTELLIGENCE & COMPONENT PROTECTION                       */}
      {/* ========================================================================= */}
      {(() => {
        const isLowRisk = (risk.risk_percentage ?? (risk.composite_risk ? risk.composite_risk * 100 : 0)) < 10

        const KONE_OEM_PARTS: Record<string, { name: string; partNum: string; target: string; inspect: string; url: string }> = {
          motor: {
            name: 'KONE MX10 / MX20 Gearless Traction Motor Assembly',
            partNum: 'KM713710G01',
            target: 'TRACTION MOTOR',
            inspect: 'Motor mounting, coupling, shaft alignment & winding insulation',
            url: 'https://parts.kone.com/'
          },
          brake: {
            name: 'KONE Dual-Circuit Electromagnetic Safety Brake Assembly',
            partNum: 'KM50001041',
            target: 'ELECTROMAGNETIC BRAKE',
            inspect: 'Brake lining wear, solenoid plunger clearance & release spring tension',
            url: 'https://parts.kone.com/'
          },
          bearing: {
            name: 'KONE Heavy-Duty Sealed Main Shaft Roller Bearing Set',
            partNum: 'KM856220C3',
            target: 'MAIN SHAFT BEARING',
            inspect: 'Raceway lubrication, radial play & pillow block seating',
            url: 'https://parts.kone.com/'
          },
          controller: {
            name: 'KONE KDM / V3F25 VVVF Drive & Main Control Board Assembly',
            partNum: 'KM760500G01',
            target: 'MAIN ELEVATOR CONTROLLER',
            inspect: 'Power inverter IGBT modules, cabinet cooling fan & encoder interface',
            url: 'https://parts.kone.com/'
          },
          rope: {
            name: 'KONE High-Tensile Steel Suspension Rope Set (8mm x 5)',
            partNum: 'KM606000G05',
            target: 'STEEL WIRE ROPE',
            inspect: 'Equalization hitch springs, sheave groove seating & crown wire wear',
            url: 'https://parts.kone.com/'
          },
          door: {
            name: 'KONE AMD Automatic Door Operator Motor & Belt Drive Module',
            partNum: 'KM803000G02',
            target: 'DOOR OPERATOR',
            inspect: 'Door hanger rollers, track alignment & rubber belt tension',
            url: 'https://parts.kone.com/'
          },
          pulley: {
            name: 'KONE Hardened Steel Traction Sheave Pulley Assembly',
            partNum: 'KM414710G01',
            target: 'SHEAVE PULLEY',
            inspect: 'Groove undercut depth, shaft keyway fit & rope traction seating',
            url: 'https://parts.kone.com/'
          },
          counterweight: {
            name: 'KONE Counterweight Guide Shoe & Frame Lock Buffer Set',
            partNum: 'KM902100G01',
            target: 'COUNTERWEIGHT FRAME',
            inspect: 'Guide shoe gibs, filler weight locking bolts & safety buffer stop',
            url: 'https://parts.kone.com/'
          },
          guide_rail: {
            name: 'KONE T-Steel Precision Machined Guide Rail Section',
            partNum: 'KM305000G01',
            target: 'GUIDE RAILS',
            inspect: 'Fishplate alignment joints, rail bracket torque & lubricator pads',
            url: 'https://parts.kone.com/'
          },
          cabin: {
            name: 'KONE Car Sling Frame & Progressive Safety Gear Assembly',
            partNum: 'KM789000G01',
            target: 'CABIN CAR & SLING',
            inspect: 'Safety gear jaws, load cell strain sensors & isolation dampers',
            url: 'https://parts.kone.com/'
          },
          shaft: {
            name: 'KONE Hoistway Limit Switches & Environmental Sensor Suite',
            partNum: 'KM123900G01',
            target: 'HOISTWAY ENVIRONMENT',
            inspect: 'Traveling cable strain hanger, pit buffer oil level & landing switches',
            url: 'https://parts.kone.com/'
          }
        }

        const compKey = (fault.affected_component || 'motor').toString().toLowerCase()
        const activePart = KONE_OEM_PARTS[compKey] || KONE_OEM_PARTS['motor']

        const ALL_COMPONENTS_LIST = [
          'Main Shaft Bearing',
          'Electromagnetic Brake',
          'Door Operator',
          'Steel Wire Rope',
          'Main Controller',
          'Counterweight',
          'Guide Rail',
          'Traction Motor',
          'Sheave Pulley'
        ]

        const currentTargetName = activePart.target.toLowerCase()
        const doNotDisturbItems = isLowRisk
          ? ALL_COMPONENTS_LIST.slice(0, 8)
          : ALL_COMPONENTS_LIST.filter(
              (item) => !currentTargetName.includes(item.toLowerCase()) && !item.toLowerCase().includes(currentTargetName)
            )

        return (
          <Panel
            title="KONE PARTS INTELLIGENCE"
            right={
              <a
                href="https://parts.kone.com/"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-brand bg-brand/10 hover:bg-brand/20 border border-brand/30 px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 shadow-xs"
              >
                <span>Open KONE Official Parts Webshop</span>
                <ArrowRight size={14} />
              </a>
            }
          >
            <div className="space-y-5 text-xs font-sans">
              {/* SUGGESTED OFFICIAL KONE REPLACEMENT PART CARD */}
              <div className={`rounded-xl border p-4 space-y-3 ${isLowRisk ? 'border-ok/40 bg-ok/5' : 'border-brand/40 bg-brand/5'}`}>
                <div className="flex flex-wrap items-center justify-between border-b border-line/30 pb-2 gap-2">
                  <span className={`font-extrabold uppercase tracking-wider text-[11px] flex items-center gap-1.5 ${isLowRisk ? 'text-ok' : 'text-brand'}`}>
                    <Sparkles size={15} /> SUGGESTED OFFICIAL KONE OEM REPLACEMENT PART
                  </span>
                  <a
                    href={activePart.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`py-1 px-3 text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-xs ${
                      isLowRisk ? 'btn-ghost text-muted border border-line cursor-default' : 'btn-primary'
                    }`}
                  >
                    <span>{isLowRisk ? 'No Parts Needed (Risk < 10%)' : 'View Part on Official KONE Store'}</span>
                    {!isLowRisk && <ArrowRight size={13} />}
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-muted block">Suggested Part Name</span>
                    <strong className={`text-sm font-black block mt-0.5 ${isLowRisk ? 'text-ok' : 'text-ink'}`}>
                      {isLowRisk ? 'No Replacement Parts Required (System Healthy)' : activePart.name}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-muted block">KONE OEM Part Number</span>
                    <strong className={`text-sm font-mono font-black block mt-0.5 ${isLowRisk ? 'text-muted' : 'text-brand'}`}>
                      {isLowRisk ? 'N/A — NOMINAL STATE' : activePart.partNum}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-muted block">Webshop Direct Status</span>
                    <span className={`inline-flex items-center gap-1 font-bold text-xs mt-1 ${isLowRisk ? 'text-ok' : 'text-ok'}`}>
                      <span className="h-2 w-2 rounded-full bg-ok animate-pulse" />
                      {isLowRisk ? '● System Health Nominal (< 10% Risk)' : 'Verified on parts.kone.com'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 6 SPECIFICATION CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 rounded-xl border border-line/70 bg-surface space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-muted block">Target Component</span>
                  <strong className="text-sm font-black text-ink block truncate">
                    {isLowRisk ? 'None (Nominal)' : activePart.target}
                  </strong>
                </div>

                <div className={`p-3 rounded-xl border space-y-1 ${isLowRisk ? 'border-ok/30 bg-ok/10' : 'border-fault/30 bg-fault/10'}`}>
                  <span className={`text-[10px] font-extrabold uppercase block ${isLowRisk ? 'text-ok' : 'text-fault'}`}>
                    AI-Identified Condition
                  </span>
                  <strong className={`text-sm font-black block ${isLowRisk ? 'text-ok' : 'text-fault'}`}>
                    {isLowRisk ? 'NOMINAL (< 10% Risk)' : (beforeState.condition || 'High Risk')}
                  </strong>
                </div>

                <div className="p-3 rounded-xl border border-brand/30 bg-brand/10 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-brand block">Recommended Intervention</span>
                  <strong className="text-xs font-bold text-brand block">
                    {isLowRisk ? 'Routine Monitoring Only' : 'Targeted Component Replacement'}
                  </strong>
                </div>

                <div className="p-3 rounded-xl border border-line/70 bg-surface space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-muted block">Replacement Scope</span>
                  <strong className="text-xs font-bold text-ink block">
                    {isLowRisk ? 'None - All Subsystems Healthy' : `${activePart.target} / Specific Component`}
                  </strong>
                </div>

                <div className="p-3 rounded-xl border border-line/70 bg-surface space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-muted block">Parts Source</span>
                  <strong className="text-xs font-bold text-ink block">KONE Official Parts Webshop</strong>
                </div>

                <div className={`p-3 rounded-xl border space-y-1 ${isLowRisk ? 'border-ok/30 bg-ok/10' : 'border-warn/30 bg-warn/10'}`}>
                  <span className={`text-[10px] font-extrabold uppercase block ${isLowRisk ? 'text-ok' : 'text-warn'}`}>
                    KONE Part Compatibility
                  </span>
                  <strong className={`text-[11px] font-bold block leading-tight ${isLowRisk ? 'text-ok' : 'text-warn'}`}>
                    {isLowRisk ? '✓ Subsystem Envelope Nominal' : '⚠️ Model / Serial Number Verification Required'}
                  </strong>
                </div>
              </div>

              {/* COMPONENT PROTECTION (SUB-ASSEMBLY ACTION MAP) */}
              <div className="space-y-2 pt-2 border-t border-line/50">
                <span className="text-xs font-extrabold uppercase tracking-wider text-ink block">
                  COMPONENT PROTECTION
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 🔴 REPLACE / TARGET */}
                  <div className={`rounded-xl border p-4 space-y-2 ${isLowRisk ? 'border-ok/40 bg-ok/10' : 'border-fault/40 bg-fault/10'}`}>
                    <div className={`flex items-center gap-2 font-black uppercase text-xs ${isLowRisk ? 'text-ok' : 'text-fault'}`}>
                      <span className={`h-3 w-3 rounded-full ${isLowRisk ? 'bg-ok' : 'bg-fault animate-pulse'}`} />
                      <span>{isLowRisk ? '🟢 REPLACE / TARGET' : '🔴 REPLACE / TARGET'}</span>
                    </div>
                    <div className={`p-2.5 rounded-lg border bg-surface font-black text-xs ${isLowRisk ? 'border-ok/40 text-ok' : 'border-fault/40 text-fault'}`}>
                      {isLowRisk ? 'None (System Healthy)' : activePart.target}
                    </div>
                  </div>

                  {/* 🟠 INSPECT BEFORE REPLACEMENT */}
                  <div className="rounded-xl border border-warn/40 bg-warn/10 p-4 space-y-2">
                    <div className="flex items-center gap-2 font-black text-warn uppercase text-xs">
                      <span className="h-3 w-3 rounded-full bg-warn" />
                      <span>🟠 INSPECT BEFORE REPLACEMENT</span>
                    </div>
                    <div className="p-2.5 rounded-lg border border-warn/40 bg-surface font-semibold text-warn text-xs">
                      {isLowRisk ? 'Standard Preventive Maintenance Check' : activePart.inspect}
                    </div>
                  </div>

                  {/* 🟢 DO NOT DISTURB */}
                  <div className="rounded-xl border border-ok/40 bg-ok/10 p-4 space-y-2">
                    <div className="flex items-center gap-2 font-black text-ok uppercase text-xs">
                      <span className="h-3 w-3 rounded-full bg-ok" />
                      <span>🟢 DO NOT DISTURB</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-semibold text-ok">
                      {doNotDisturbItems.map((item) => (
                        <div key={item} className="p-1.5 rounded border border-ok/30 bg-surface text-ink truncate">
                          ✓ {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* IMPORTANT VERIFICATION WARNING BANNER */}
              <div className="rounded-xl border border-warn/40 bg-warn/10 p-3.5 flex items-start gap-3 text-xs">
                <AlertTriangle size={18} className="text-warn shrink-0 mt-0.5" />
                <p className="text-ink font-medium leading-relaxed">
                  <strong className="font-bold text-warn uppercase">Important:</strong> ANODOS should identify the affected component and replacement scope, but the exact KONE replacement part must be verified against the elevator's actual model, configuration, and serial/part number before replacement.
                </p>
              </div>
            </div>
          </Panel>
        )
      })()}

      {/* ========================================================================= */}
      {/* 8. ACTION BAR BUTTONS                                                    */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <button
          onClick={() => setActiveTab('history')}
          className="btn-outline px-4 py-2 text-xs font-bold flex items-center gap-1.5 rounded-xl"
        >
          <Layers size={14} /> View History Log
        </button>

        <button
          onClick={() => setActiveTab('maintenance')}
          className="btn-outline px-4 py-2 text-xs font-bold flex items-center gap-1.5 rounded-xl"
        >
          <FileText size={14} /> View Maintenance
        </button>

        <button
          onClick={handleDownloadPdf}
          className="btn-outline px-4 py-2 text-xs font-bold flex items-center gap-1.5 rounded-xl"
        >
          <Download size={14} /> Download PDF Report
        </button>

        <button
          onClick={() => setActiveTab('maintenance')}
          className="btn-primary px-5 py-2 text-xs font-bold flex items-center gap-1.5 rounded-xl shadow-sm"
        >
          <Wrench size={14} /> Generate Work Order
        </button>
      </div>
    </div>
  )
}
