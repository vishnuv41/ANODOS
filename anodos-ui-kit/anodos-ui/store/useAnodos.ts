import { create } from 'zustand'
import type { CatBoostFeatureSnapshot, CompId, ElevatorState, Health, Incident, MaintenanceRecommendation, ModernizationPayload, Prediction, Run, StreamRow, StructuredExplanation, TabId, Telemetry, UserRole } from '@/lib/types'
import { fetchElevatorState, getBackendUrl, getWsUrl } from '@/lib/api'

/* ------------------------------------------------------------------ helpers */
export const COMPONENTS: { id: CompId; name: string }[] = [
  { id: 'motor', name: 'Traction Motor' },
  { id: 'bearing', name: 'Main Shaft Bearing' },
  { id: 'brake', name: 'Electromagnetic Brake' },
  { id: 'door', name: 'Door Operator' },
  { id: 'controller', name: 'Main Elevator Controller' },
  { id: 'pulley', name: 'Sheave Pulley' },
  { id: 'rope', name: 'Steel Wire Rope' },
  { id: 'counterweight', name: 'Counterweight Frame' },
  { id: 'guide_rail', name: 'Guide Rails' },
  { id: 'cabin', name: 'Cabin Car & Sling' },
  { id: 'shaft', name: 'Hoistway Environment' },
]

export const compName = (id: CompId) => COMPONENTS.find((c) => c.id === id)?.name || id
export const healthOf = (risk: number): Health => (risk >= 80 ? 'fault' : risk >= 60 ? 'high_risk' : risk >= 30 ? 'warning' : 'normal')
export const HEALTH_LABEL: Record<Health, string> = { normal: 'Normal', warning: 'Warning', high: 'High Risk', high_risk: 'High Risk', fault: 'Fault' }
export const HEALTH_HEX: Record<Health, string> = { normal: '#00C851', warning: '#FFBB33', high: '#FF8800', high_risk: '#FF8800', fault: '#FF4444' }

export const BASE: Telemetry = { motorTemp: 65, vibration: 1.8, current: 8.4, speed: 2.5, load: 650, brakeForce: 92, doorCycles: 40, bearingTemp: 58, hours: 8421 }

const MODEL = { name: 'ANODOS-CatBoost-v1.0', samples: 100000, accuracy: 77.02, rocAuc: 84.3 }

export const SCENARIOS = {
  normal: { label: 'Normal', description: 'Normal elevator operation', overrides: {} as Partial<Telemetry> },
  heavy_load: { label: 'Heavy Load', description: 'Higher cabin/load demand', overrides: { load: 1250, current: 14.5, motorTemp: 78 } as Partial<Telemetry> },
  motor_overheat: { label: 'Motor Overheat', description: 'Motor temperature overheat', overrides: { motorTemp: 105, current: 12.6, vibration: 4.8 } as Partial<Telemetry> },
  motor_degradation: { label: 'Motor Degradation', description: 'Motor performance degradation', overrides: { motorTemp: 98, current: 16.2, vibration: 5.4 } as Partial<Telemetry> },
  bearing_degradation: { label: 'Bearing Degradation', description: 'Increased bearing-related degradation/vibration', overrides: { vibration: 8.2, bearingTemp: 92, motorTemp: 84 } as Partial<Telemetry> },
  brake_degradation: { label: 'Brake Degradation', description: 'Reduced/degraded braking condition', overrides: { brakeForce: 28, speed: 4.5, vibration: 6.0 } as Partial<Telemetry> },
  aging: { label: 'Aging', description: 'Increased accumulated operating hours / age effects', overrides: { hours: 28500, vibration: 4.2, motorTemp: 79, brakeForce: 72 } as Partial<Telemetry> },
  combined_degradation: { label: 'Combined Degradation', description: 'Multiple degradation effects together', overrides: { motorTemp: 102, vibration: 9.5, current: 15.8, brakeForce: 35, bearingTemp: 94, hours: 29000 } as Partial<Telemetry> },
} as const
export type ScenarioId = keyof typeof SCENARIOS

/** SINGLE SOURCE OF TRUTH for per-component risk and health. Reads backend state if available. */
export function selectComponents(p: Prediction | null, rawState?: ElevatorState | null) {
  if (rawState && rawState.components) {
    return COMPONENTS.map((c) => {
      const stateStr = rawState.components[c.id] || 'normal'
      const health = (stateStr === 'high_risk' ? 'high_risk' : stateStr) as Health
      let risk = 0
      if (health === 'fault') risk = 95
      else if (health === 'high_risk' || health === 'high') risk = 78
      else if (health === 'warning') risk = 45
      else risk = 5

      if (p && p.componentScores && p.componentScores[c.id] !== undefined) {
        const score = p.componentScores[c.id]!
        risk = Math.round(score <= 1 ? score * 100 : score)
      }
      return { ...c, risk, health }
    }).sort((a, b) => b.risk - a.risk)
  }

  return COMPONENTS.map((c) => {
    const score = p?.componentScores[c.id]
    const risk = score === undefined ? (p && p.component === c.id ? p.risk : 0) : Math.round(score <= 1 ? score * 100 : score)
    return { ...c, risk, health: healthOf(risk) }
  }).sort((a, b) => b.risk - a.risk)
}

function normalizeStateToPrediction(state: ElevatorState): Prediction {
  const p = (state.prediction || {}) as any
  const rawRisk = p.risk_score ?? 0
  const riskPercent = Math.min(99, Math.max(0, Math.round(rawRisk <= 1 ? rawRisk * 100 : rawRisk)))
  const affectedComp = (p.affected_component || 'motor') as CompId
  
  let explanationText = 'Nominal operating telemetry received from backend.'
  let supportingSignals: string[] = []
  let physicalStress = 'Nominal stress levels across physical components'

  if (typeof p.explanation === 'object' && p.explanation !== null) {
    explanationText = p.explanation.text || explanationText
    supportingSignals = p.explanation.model_supporting_signals || []
    physicalStress = p.explanation.physical_stress || physicalStress
  } else if (typeof p.explanation === 'string' && p.explanation) {
    explanationText = p.explanation
  } else if (Array.isArray(state.explanations) && state.explanations.length > 0) {
    const firstExp = state.explanations[0]
    explanationText = typeof firstExp === 'string' ? firstExp : (firstExp.text || explanationText)
  }

  // Derive default supporting signals if backend array was empty
  if (supportingSignals.length === 0) {
    if (state.telemetry) {
      if ((state.telemetry.vibration_level ?? 0) > 4.0) supportingSignals.push('High vibration level detected')
      if ((state.telemetry.motor_temperature ?? 0) > 85) supportingSignals.push('Elevated motor temperature')
      if ((state.telemetry.brake_force ?? 100) < 50) supportingSignals.push('Reduced braking force')
      if ((state.telemetry.operating_hours ?? 0) > 20000) supportingSignals.push('High operating hours accumulated')
    }
    if (supportingSignals.length === 0) {
      supportingSignals.push('Nominal telemetry pattern across operational sensors')
    }
  }

  // Feature Snapshot (exact 8 CatBoost features from backend)
  const snapshot: CatBoostFeatureSnapshot = p.feature_snapshot || {
    load: state.telemetry?.load ?? BASE.load,
    speed: state.telemetry?.speed ?? BASE.speed,
    vibration: state.telemetry?.vibration_level ?? BASE.vibration,
    motor_current: state.telemetry?.motor_current ?? BASE.current,
    motor_temperature: state.telemetry?.motor_temperature ?? BASE.motorTemp,
    door_cycles: state.telemetry?.door_cycles ?? BASE.doorCycles,
    brake_force: state.telemetry?.brake_force ?? BASE.brakeForce,
    operating_hours: state.telemetry?.operating_hours ?? BASE.hours,
  }

  // Maintenance recommendation object from backend or fallback
  const maintenance: MaintenanceRecommendation = state.maintenance || (state as any).maintenance || {
    priority: riskPercent >= 80 ? 'CRITICAL' : riskPercent >= 55 ? 'HIGH' : riskPercent >= 30 ? 'MEDIUM' : 'LOW',
    summary: `Current ML prediction indicates ${compName(affectedComp)}-related risk of ${riskPercent}%.`,
    reasoning: 'Decision support output generated from CatBoost model and physics engine indicators.',
    recommended_actions: [
      `Inspect ${compName(affectedComp)} assembly`,
      'Verify sensor telemetry values',
      'Check operational logs'
    ],
    evidence: [
      `Risk Score: ${riskPercent}%`,
      `Affected Component: ${compName(affectedComp)}`,
      `Severity: ${String(p.fault_severity || 'LOW').toUpperCase()}`
    ]
  }

  const timestampStr = state.timestamp || p.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19)

  return {
    risk: riskPercent,
    confidence: 89,
    horizonH: 24,
    horizon: '24 hours',
    faultState: String(p.fault_state ?? (riskPercent >= 80 ? 'FAULT' : 'Normal')).toUpperCase(),
    faultCategory: p.fault_category || `${compName(affectedComp).toUpperCase()} ANOMALY`,
    severity: (String(p.fault_severity || (riskPercent >= 80 ? 'HIGH' : riskPercent >= 55 ? 'MEDIUM' : 'LOW')).toUpperCase() as Prediction['severity']),
    component: affectedComp,
    componentScores: { [affectedComp]: riskPercent },
    rulHours: Math.max(2, Math.round(1020 * (1 - rawRisk))),
    explanations: [explanationText],
    explanation: explanationText,
    explanationDetail: {
      text: explanationText,
      model_supporting_signals: supportingSignals,
      physical_stress: physicalStress
    },
    model: MODEL,
    metrics: { roc_auc: 84.30 },
    at: Date.now(),
    timestampStr,
    featureSource: p.feature_source || state.source || 'Dataset / Scenario',
    featureSnapshot: snapshot,
    feature_source: p.feature_source || state.source || 'Dataset / Scenario',
    feature_snapshot: snapshot,
    risk_score: rawRisk,
    fault_severity: String(p.fault_severity || 'LOW'),
    fault_category: p.fault_category,
    affected_component: affectedComp,
    maintenance
  }
}

export function buildModernizationPayload(p: Prediction | null, state: ElevatorState | null, telemetry: Telemetry): ModernizationPayload {
  const catboostProb = (p?.risk ?? 15) / 100.0
  const physicsDeg = Math.min(0.99, Math.max(0.12, (catboostProb * 0.75) + (telemetry.vibration > 4 ? 0.20 : 0.05)))
  const compRisk = Math.min(0.99, Math.max(0.05, 0.6 * catboostProb + 0.4 * physicsDeg))
  const riskPercent = +(compRisk * 100).toFixed(2)

  const comp: CompId = p?.component ?? 'bearing'
  const compNameStr = compName(comp)
  const isLowRisk = compRisk < 0.10
  const isHighRisk = compRisk >= 0.60
  const priority = compRisk >= 0.8 ? 'CRITICAL' : compRisk >= 0.55 ? 'HIGH' : compRisk >= 0.3 ? 'MEDIUM' : 'LOW'
  const faultCat = p?.faultCategory || `${compNameStr.toUpperCase()} VIBRATION DEGRADATION`

  const hardwareCost = comp === 'bearing' ? 35000 : comp === 'motor' ? 120000 : comp === 'brake' ? 45000 : comp === 'controller' ? 85000 : 25000
  const techHours = comp === 'motor' || comp === 'controller' ? 8 : 4
  const hourlyRate = 1500
  const laborCost = techHours * hourlyRate
  const totalCost = hardwareCost + laborCost

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

  const baseDt = baseDowntimeMap[comp] || 6.0
  const baseEg = baseEnergyMap[comp] || 12.0
  const stressFactor = 1.0 + 0.4 * compRisk

  const dtS1 = isLowRisk ? 0 : +(Math.max(1.0, baseDt * 0.4)).toFixed(1)
  const dtS2 = isLowRisk ? 0 : +(baseDt * (1.0 + 0.25 * compRisk)).toFixed(1)
  const dtS3 = isLowRisk ? 0 : +(baseDt * (1.8 + 0.25 * compRisk)).toFixed(1)
  const dtS4 = isLowRisk ? 0 : +(baseDt * (2.5 + 0.35 * compRisk)).toFixed(1)
  const dtS5 = isLowRisk ? 0 : +(baseDt * (4.5 + 0.50 * compRisk)).toFixed(1)

  const egS1 = +(baseEg * 0.35 * stressFactor).toFixed(1)
  const egS2 = +(baseEg * 1.00 * stressFactor).toFixed(1)
  const egS3 = +Math.min(35.0, baseEg * 1.40 * stressFactor).toFixed(1)
  const egS4 = +Math.min(38.0, baseEg * 1.80 * stressFactor).toFixed(1)
  const egS5 = +Math.min(42.0, baseEg * 2.40 * stressFactor).toFixed(1)

  const instHours = isLowRisk ? 0 : +(dtS2 * 0.85).toFixed(1)
  const testHours = isLowRisk ? 0 : +(dtS2 * 0.15).toFixed(1)
  const totalDowntime = isLowRisk ? 0 : dtS2

  return {
    elevator_id: state?.elevator_id || 'E001',
    analysis_timestamp: new Date().toISOString(),
    decision: {
      status: isLowRisk ? 'ROUTINE_MONITORING' : (isHighRisk ? 'HIGH_PRIORITY_MODERNIZATION' : 'ROUTINE_MONITORING'),
      priority: isLowRisk ? 'LOW' : priority,
      recommended_option: isLowRisk ? 'S0' : 'S2',
      recommended_option_name: isLowRisk ? 'Continue Routine Monitoring' : 'Component Modernization',
      decision_reason: isLowRisk
        ? `System operation nominal (Risk ${riskPercent}% < 10%). No replacement intervention needed.`
        : `High composite risk (${riskPercent}%) with significant degradation impact on ${compNameStr}.`,
      decision_case: isLowRisk ? 'CASE_B' : (isHighRisk ? 'CASE_A' : 'CASE_B'),
      confidence: 0.95,
    },
    risk: {
      catboost_probability: +catboostProb.toFixed(4),
      physics_degradation: +physicsDeg.toFixed(4),
      composite_risk: +compRisk.toFixed(4),
      risk_percentage: riskPercent,
      risk_band: priority,
      risk_formula: 'P_fail × 0.6 + D_phys × 0.4',
    },
    fault: {
      fault_state: p?.faultState || (isHighRisk ? 1 : 0),
      fault_category: faultCat,
      fault_severity: p?.severity || (isHighRisk ? 'High' : 'Low'),
      affected_component: comp,
    },
    rul: {
      current_rul_hours: +(Math.max(50.0, 1200.0 * (1.0 - compRisk))).toFixed(1),
      current_rul_years: +((Math.max(50.0, 1200.0 * (1.0 - compRisk))) / 8760.0).toFixed(2),
      projected_rul_hours: +(Math.max(50.0, 1200.0 * (1.0 - compRisk)) + 39420.0).toFixed(1),
      projected_rul_years: +(((Math.max(50.0, 1200.0 * (1.0 - compRisk))) / 8760.0) + 4.5).toFixed(2),
      impact_delta_hours: 39420.0,
      impact_delta_years: 4.5,
      status: 'NODE_2_1_AND_2_2_CALCULATED',
      reason: 'Dynamic RUL calculation based on CatBoost risk score & physical degradation.',
    },
    elevator: {
      elevator_age_years: null,
      operating_hours: telemetry.hours,
      days_since_maintenance: null,
      last_maintenance_date: null,
      obsolescence_status: 'NOT_VALIDATED',
    },
    current_state: {
      condition: isHighRisk ? 'HIGH_RISK' : 'NOMINAL',
      risk_score: +compRisk.toFixed(4),
      affected_component: comp,
      fault_category: faultCat,
      fault_severity: p?.severity || (isHighRisk ? 'High' : 'Low'),
    },
    options: [
      { id: 'S0', name: 'Continue Monitoring', description: 'Maintain existing inspection intervals', component: comp, hardware_cost_inr: 0, labor_cost_inr: 0, total_cost_inr: 0, downtime_hours: 0, expected_risk_after: +(Math.min(0.99, compRisk * 1.25)).toFixed(4), expected_risk_pct: +(Math.min(99.0, compRisk * 125)).toFixed(1), expected_condition: isHighRisk ? 'HIGH_RISK' : 'DEGRADED', expected_maintenance_impact: 'No immediate risk mitigation', expected_energy_impact: '0% (Baseline / Nominal)', tco_5yr_inr: 225000, status: 'AVAILABLE' },
      { id: 'S1', name: 'Condition-Based Maintenance', description: 'Targeted field servicing and lubrication', component: comp, hardware_cost_inr: 5000, labor_cost_inr: 7500, total_cost_inr: 12500, downtime_hours: dtS1, expected_risk_after: +(Math.max(0.05, compRisk * 0.50)).toFixed(4), expected_risk_pct: +(Math.max(5.0, compRisk * 50)).toFixed(1), expected_condition: 'STABLE', expected_maintenance_impact: 'Temporary 50% risk reduction', expected_energy_impact: `~${egS1}% Drive friction reduction`, tco_5yr_inr: 137500, status: 'AVAILABLE' },
      { id: 'S2', name: 'Component Modernization', description: `Replace/upgrade ${compNameStr} assembly`, component: comp, hardware_cost_inr: hardwareCost, labor_cost_inr: laborCost, total_cost_inr: totalCost, downtime_hours: dtS2, expected_risk_after: +(Math.max(0.02, compRisk * 0.15)).toFixed(4), expected_risk_pct: +(Math.max(2.0, compRisk * 15)).toFixed(1), expected_condition: 'PROJECTED [NOMINAL]', expected_maintenance_impact: '85% Reduction in component risk', expected_energy_impact: `~${egS2}% Subsystem power factor & thermal gain`, tco_5yr_inr: 119500, status: 'RECOMMENDED' },
      { id: 'S3', name: 'Modular Modernization', description: 'Upgrade subsystem drive & sensors', component: comp, hardware_cost_inr: 95000, labor_cost_inr: 20000, total_cost_inr: 115000, downtime_hours: dtS3, expected_risk_after: +(Math.max(0.02, compRisk * 0.08)).toFixed(4), expected_risk_pct: +(Math.max(2.0, compRisk * 8)).toFixed(1), expected_condition: 'PROJECTED [EXCELLENT]', expected_maintenance_impact: '92% Risk reduction', expected_energy_impact: `~${egS3}% VFD Regenerative drive energy savings`, tco_5yr_inr: 165000, status: 'AVAILABLE' },
      { id: 'S4', name: 'Control Modernization', description: 'Full controller and VFD retrofit', component: 'controller', hardware_cost_inr: 150000, labor_cost_inr: 35000, total_cost_inr: 185000, downtime_hours: dtS4, expected_risk_after: +(Math.max(0.01, compRisk * 0.05)).toFixed(4), expected_risk_pct: +(Math.max(1.0, compRisk * 5)).toFixed(1), expected_condition: 'PROJECTED [EXCELLENT]', expected_maintenance_impact: '95% Fault reduction', expected_energy_impact: `~${egS4}% Energy reduction via intelligent dispatch`, tco_5yr_inr: 225000, status: 'AVAILABLE' },
      { id: 'S5', name: 'Full Replacement', description: 'Complete elevator system renewal', component: 'elevator', hardware_cost_inr: 720000, labor_cost_inr: 130000, total_cost_inr: 850000, downtime_hours: dtS5, expected_risk_after: 0.01, expected_risk_pct: 1.0, expected_condition: 'BRAND NEW', expected_maintenance_impact: '99% Fault elimination', expected_energy_impact: `~${egS5}% Maximum efficiency gain with gearless motor`, tco_5yr_inr: 875000, status: 'AVAILABLE' },
    ],
    cost: {
      hardware_cost_inr: hardwareCost,
      technician_hours: techHours,
      hourly_rate_inr: hourlyRate,
      labor_cost_inr: laborCost,
      installation_cost_inr: 0,
      total_cost_inr: totalCost,
      currency: 'INR',
      source: 'ENGINEERING REFERENCE — NOT KONE QUOTATION',
      cost_source: 'ENGINEERING REFERENCE — NOT KONE QUOTATION',
    },
    downtime: {
      installation_hours: instHours,
      testing_hours: testHours,
      total_downtime_hours: totalDowntime,
      planned_start: null,
      planned_end: null,
      schedule_status: 'NOT_SCHEDULED',
    },
    before: {
      risk_score: +compRisk.toFixed(4),
      risk_percentage: riskPercent,
      condition: isHighRisk ? 'HIGH_RISK' : 'NOMINAL',
      fault_state: p?.faultState || (isHighRisk ? 1 : 0),
      fault_category: faultCat,
      fault_severity: p?.severity || (isHighRisk ? 'High' : 'Low'),
      affected_component: comp,
    },
    after: {
      risk_score: null,
      risk_percentage: null,
      condition: 'PROJECTED',
      fault_state: null,
      expected_rul_delta_years: null,
      expected_energy_savings_percent: null,
      expected_fault_reduction_percent: null,
      projection_status: 'PROJECTION_NOT_VALIDATED',
    },
    engineering: {
      dominant_component: comp,
      physics_degradation: +physicsDeg.toFixed(4),
      component_degradation: {
        motor: comp === 'motor' ? 0.82 : 0.21,
        bearing: comp === 'bearing' ? 0.74 : 0.28,
        brake: comp === 'brake' ? 0.68 : 0.19,
        rope: comp === 'rope' ? 0.55 : 0.12,
        door: comp === 'door' ? 0.45 : 0.08,
        controller: comp === 'controller' ? 0.62 : 0.06,
      },
      evidence: [
        { parameter: 'vibration', value: telemetry.vibration, unit: 'm/s²', impact: telemetry.vibration > 4 ? 'Elevated vibration' : 'Nominal vibration' },
        { parameter: 'motor_temperature', value: telemetry.motorTemp, unit: '°C', impact: telemetry.motorTemp > 85 ? 'Elevated thermal load' : 'Nominal thermal load' },
        { parameter: 'brake_force', value: telemetry.brakeForce, unit: 'kN', impact: telemetry.brakeForce < 50 ? 'Reduced braking margin' : 'Optimal braking force' },
      ],
      recommendations: [
        `Execute component-level modernization for ${compNameStr}`,
        'Recalibrate physical telemetry sensor baselines',
        'Verify zero-energy lockout before intervention',
      ],
    },
    provenance: {
      model_name: 'ANODOS-v1.0',
      model_type: 'CatBoost',
      prediction_source: p?.featureSource || 'CatBoost',
      feature_source: p?.feature_source || 'unseen_dataset',
      data_source: 'ANODOS_UNSEEN_PREDICTIONS.csv',
      prediction_timestamp: new Date().toISOString(),
      feature_snapshot: p?.featureSnapshot,
    },
    disclaimers: {
      pricing_disclaimer: 'ENGINEERING REFERENCE — NOT KONE QUOTATION',
      pricing: 'ENGINEERING REFERENCE — NOT KONE QUOTATION',
      inventory_disclaimer: 'REFERENCE_DATA_ONLY',
      inventory: 'REFERENCE_DATA_ONLY',
      rul_disclaimer: 'No validated RUL model is connected.',
      rul: 'No validated RUL model is connected.',
      projection_disclaimer: 'After-intervention impact is not validated.',
      projection: 'After-intervention impact is not validated.',
    },
  }
}

/* ------------------------------------------------------------------ store */
interface State {
  role: UserRole
  elevatorId: string
  activeTab: TabId
  selectedComponent: CompId | null
  focusKey: number
  telemetry: Telemetry
  rawBackendState: ElevatorState | null
  prediction: Prediction | null
  wsStatus: 'LIVE' | 'RECONNECTING' | 'DISCONNECTED' | 'DEMO'
  simulating: boolean
  backendLive: boolean
  incidents: Incident[]
  predictionHistory: Prediction[]
  trend: { t: string; health: number }[]
  stream: StreamRow[]
  wsInstance: WebSocket | null
  run: Run | null

  setRole: (role: UserRole) => void
  setElevatorId: (id: string) => void
  setActiveTab: (t: TabId) => void
  setSelectedComponent: (c: CompId | null) => void
  setElevatorState: (state: ElevatorState) => void
  focusComponent: (c: CompId) => void
  connectWebSocket: () => void
  disconnectWebSocket: () => void
  fetchState: () => Promise<void>
  setRun: (r: Run) => void
  setTelemetry: (t: Partial<Telemetry>) => void
  runSimulation: (scenario: ScenarioId, overrides?: Partial<Telemetry>) => Promise<void>
  tick: () => void
}

const clock = () => new Date().toLocaleTimeString('en-GB')

export const useAnodos = create<State>((set, get) => ({
  role: 'manager',
  elevatorId: 'E001',
  activeTab: 'overview',
  selectedComponent: null,
  focusKey: 0,
  telemetry: BASE,
  rawBackendState: null,
  prediction: null,
  wsStatus: 'DISCONNECTED',
  simulating: false,
  backendLive: false,
  incidents: [],
  predictionHistory: [],
  trend: Array.from({ length: 12 }, (_, i) => ({ t: `-${12 - i}m`, health: 88 + ((i * 5) % 7) })),
  stream: Array.from({ length: 10 }, (_, i) => {
    const d = new Date(Date.now() - (10 - i) * 3000)
    return {
      t: d.toLocaleTimeString('en-GB'),
      motorTemp: +(BASE.motorTemp + (Math.random() - 0.5) * 2).toFixed(1),
      vibration: +(BASE.vibration + (Math.random() - 0.5) * 0.4).toFixed(1),
      current: +(BASE.current + (Math.random() - 0.5) * 0.6).toFixed(1),
    }
  }),
  wsInstance: null,
  run: null,

  setRole: (role) => {
    const currentTab = get().activeTab
    const managerTabs = ['overview', 'twin', 'maintenance', 'modernization', 'compare', 'upload', 'facility']
    const techTabs = ['overview', 'twin', 'report', 'work_order', 'history', 'spare_parts', 'warehouse', 'profile', 'dispatch']
    let defaultTab: TabId = 'overview'
    if (role === 'manager' && !managerTabs.includes(currentTab)) defaultTab = 'overview'
    if (role === 'technician' && !techTabs.includes(currentTab)) defaultTab = 'overview'
    set({ role, activeTab: defaultTab })
  },

  setElevatorId: (elevatorId) => {
    set({ elevatorId })
    get().disconnectWebSocket()
    get().fetchState()
    get().connectWebSocket()
  },

  setActiveTab: (activeTab) => set({ activeTab }),
  setSelectedComponent: (selectedComponent) => set({ selectedComponent }),
  focusComponent: (c) => set((s) => ({ selectedComponent: c, focusKey: s.focusKey + 1 })),

  setElevatorState: (state) => {
    const pred = normalizeStateToPrediction(state)
    const tel: Telemetry = {
      motorTemp: state.telemetry?.motor_temperature ?? BASE.motorTemp,
      vibration: state.telemetry?.vibration_level ?? BASE.vibration,
      current: state.telemetry?.motor_current ?? BASE.current,
      speed: state.telemetry?.speed ?? BASE.speed,
      load: state.telemetry?.load ?? BASE.load,
      brakeForce: state.telemetry?.brake_force ?? BASE.brakeForce,
      doorCycles: state.telemetry?.door_cycles ?? BASE.doorCycles,
      bearingTemp: state.telemetry?.bearing_temperature ?? BASE.bearingTemp,
      hours: state.telemetry?.operating_hours ?? BASE.hours,
    }

    set((s) => {
      const incident: Incident[] = pred.risk >= 60
        ? [{ id: `INC-${Date.now()}`, at: typeof pred.at === 'number' ? pred.at : Date.now(), component: pred.component, title: pred.faultState, severity: pred.severity, risk: pred.risk }]
        : []
      const newStreamRow: StreamRow = {
        t: clock(),
        motorTemp: tel.motorTemp,
        vibration: tel.vibration,
        current: tel.current,
      }

      const isDuplicate = s.predictionHistory.length > 0 &&
        s.predictionHistory[0].timestampStr === pred.timestampStr &&
        s.predictionHistory[0].risk === pred.risk &&
        s.predictionHistory[0].component === pred.component

      const predictionHistory = isDuplicate
        ? s.predictionHistory
        : [pred, ...s.predictionHistory].slice(0, 50)

      return {
        rawBackendState: state,
        telemetry: tel,
        prediction: pred,
        backendLive: true,
        stream: [newStreamRow, ...s.stream].slice(0, 25),
        predictionHistory,
        incidents: [...incident, ...s.incidents].slice(0, 50),
        trend: isDuplicate ? s.trend : [...s.trend, { t: clock(), health: 100 - pred.risk }].slice(-30),
      }
    })
  },

  fetchState: async () => {
    const elevatorId = get().elevatorId
    const data = await fetchElevatorState(elevatorId)
    if (data) {
      get().setElevatorState(data)
    }
  },

  connectWebSocket: () => {
    const existing = get().wsInstance
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return
    }

    const elevatorId = get().elevatorId
    const wsUrl = getWsUrl(elevatorId)

    set({ wsStatus: 'RECONNECTING' })

    try {
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('[ANODOS WS] Connected dynamically to:', wsUrl)
        set({ wsStatus: 'LIVE', backendLive: true, wsInstance: ws })
        ws.send(JSON.stringify({ type: 'subscribe' }))
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data && (data.telemetry || data.components || data.prediction)) {
            get().setElevatorState(data)
          }
        } catch (e) {
          console.warn('[ANODOS WS] Parse error:', e)
        }
      }

      ws.onerror = (err) => {
        console.warn('[ANODOS WS] Error:', err)
      }

      ws.onclose = () => {
        console.log('[ANODOS WS] Connection closed')
        set({ wsStatus: 'DISCONNECTED', wsInstance: null })
        setTimeout(() => {
          if (get().wsStatus !== 'LIVE') {
            get().connectWebSocket()
          }
        }, 3000)
      }
    } catch (err) {
      console.warn('[ANODOS WS] Connection attempt failed:', err)
      set({ wsStatus: 'DISCONNECTED' })
    }
  },

  disconnectWebSocket: () => {
    const ws = get().wsInstance
    if (ws) {
      ws.close()
      set({ wsInstance: null, wsStatus: 'DISCONNECTED' })
    }
  },

  setRun: (run) => set({ run }),
  setTelemetry: (t) => set((s) => ({ telemetry: { ...s.telemetry, ...t } })),

  runSimulation: async (scenario, overrides = {}) => {
    const s = get()
    const telemetry = { ...BASE, ...SCENARIOS[scenario].overrides, ...overrides }
    const ctrlMap = {
      motor_temperature: telemetry.motorTemp,
      vibration_level: telemetry.vibration,
      vibration: telemetry.vibration,
      motor_current: telemetry.current,
      bearing_temperature: telemetry.bearingTemp,
      speed: telemetry.speed,
      load: telemetry.load,
      door_cycles: telemetry.doorCycles,
      brake_force: telemetry.brakeForce,
      operating_hours: telemetry.hours
    }
    const payload = {
      elevator_id: s.elevatorId,
      mode: 'simulation',
      controls: ctrlMap,
      ...ctrlMap
    }
    set({ simulating: true, telemetry })
    try {
      const endpoint = `${getBackendUrl().replace(/\/$/, '')}/api/elevator/${s.elevatorId}/simulate`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const data = await res.json()
        get().setElevatorState(data)
      }
    } catch (e) {
      console.warn('[Simulation] simulation call failed', e)
    }
    set({ simulating: false })
  },

  tick: () =>
    set((s) => {
      if (s.simulating) return {}
      const j = (v: number, a: number) => +(v + (Math.random() - 0.5) * a).toFixed(1)
      const t = { ...s.telemetry, motorTemp: j(s.telemetry.motorTemp, 1), vibration: j(s.telemetry.vibration, 0.2), current: j(s.telemetry.current, 0.3) }
      const row: StreamRow = { t: clock(), motorTemp: t.motorTemp, vibration: t.vibration, current: t.current }
      return { telemetry: t, stream: [row, ...s.stream].slice(0, 20) }
    }),
}))
