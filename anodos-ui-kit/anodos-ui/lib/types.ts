export type Health = 'normal' | 'warning' | 'high_risk' | 'high' | 'fault'
export type CompId = 'motor' | 'bearing' | 'brake' | 'door' | 'controller' | 'pulley' | 'rope' | 'counterweight' | 'guide_rail' | 'cabin' | 'shaft'

export type UserRole = 'manager' | 'technician'

export type ManagerTabId = 'twin' | 'maintenance' | 'modernization' | 'compare' | 'upload' | 'facility'
export type TechnicianTabId = 'twin' | 'report' | 'work_order' | 'history' | 'spare_parts' | 'warehouse' | 'profile' | 'dispatch'

export type TabId = ManagerTabId | TechnicianTabId | 'overview' | 'ai' | 'telemetry' | 'simulation'

export interface BackendTelemetry {
  motor_current: number | null
  motor_voltage: number | null
  vibration_level: number | null
  speed: number | null
  motor_temperature: number | null
  bearing_temperature: number | null
  door_cycles: number | null
  load: number | null
  brake_force?: number | null
  operating_hours?: number | null
}

export interface CatBoostFeatureSnapshot {
  load?: number | null
  speed?: number | null
  vibration?: number | null
  motor_current?: number | null
  motor_temperature?: number | null
  door_cycles?: number | null
  brake_force?: number | null
  operating_hours?: number | null
}

export interface StructuredExplanation {
  text?: string
  model_supporting_signals?: string[]
  physical_stress?: string
}

export interface MaintenanceRecommendation {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string
  summary: string
  reasoning: string
  recommended_actions: string[]
  evidence: string[]
}

export interface BackendPrediction {
  id?: string
  timestamp?: string
  risk_score: number // 0 to 1 float
  fault_state: number | string
  fault_category: string
  fault_severity: 'Low' | 'Medium' | 'High' | 'Critical' | string
  affected_component: CompId
  feature_source?: 'scenario' | 'unseen_dataset' | 'telemetry' | string | null
  feature_snapshot?: CatBoostFeatureSnapshot | null
  explanation?: string | StructuredExplanation | null
}

export interface ElevatorState {
  elevator_id: string
  telemetry: BackendTelemetry
  prediction: BackendPrediction
  components: Record<CompId, 'normal' | 'warning' | 'high_risk' | 'fault'>
  explanations: (string | { text: string; component_id?: string; severity?: string })[]
  maintenance?: MaintenanceRecommendation
  source?: string
  timestamp?: string
  dataset_row?: Record<string, any>
}

export interface Telemetry {
  motorTemp: number
  vibration: number
  current: number
  speed: number
  load: number
  brakeForce: number
  doorCycles: number
  bearingTemp: number
  hours: number
}

export interface Prediction {
  risk: number            // 0-100 formatted
  confidence: number      // 0-100
  horizonH: number
  horizon: string
  faultState: string      
  faultCategory: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  component: CompId
  componentScores: Partial<Record<CompId, number>>
  rulHours: number
  explanations: string[]
  explanation: string
  explanationDetail?: StructuredExplanation
  model: { name: string; samples: number; accuracy: number; rocAuc: number }
  metrics: Record<string, number>
  at: number | string
  timestampStr?: string
  featureSource?: string
  featureSnapshot?: CatBoostFeatureSnapshot
  feature_source?: string
  feature_snapshot?: CatBoostFeatureSnapshot
  risk_score?: number
  fault_severity?: string
  fault_category?: string
  affected_component?: CompId
  maintenance?: MaintenanceRecommendation
}

export interface Run { id: string; scenario: string; payload: unknown; at: number; source: 'backend' | 'demo' }
export interface Incident { id: string; at: number; component: CompId; title: string; severity: Prediction['severity']; risk: number }
export interface StreamRow { t: string; motorTemp: number; vibration: number; current: number }

export interface ModernizationOption {
  option_id: 'REPAIR_PART' | 'REPLACE_MODERNIZE_SECTION' | 'FULL_REPLACEMENT' | string
  name: string
  description: string
  cost: { value: number | null; currency: string; source: string }
  downtime: { downtime_hours: number | null; planned_start: string | null; planned_end: string | null; schedule_status: string }
  before: { condition: string; risk_score: number | null; affected_component: string; component_state?: string }
  after: { status: string; risk_score: number | null; condition: string; component_state?: string }
  benefits: string[]
  limitations: string[]
}

export interface ModernizationDecision {
  status: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL' | string
  recommended_option: string
  recommended_option_name: string
  decision_reason: string
  decision_case: string
  confidence?: number | null
}

export interface ModernizationRisk {
  catboost_probability: number
  physics_degradation: number
  composite_risk: number
  risk_percentage: number
  risk_band: string
  risk_formula: string
}

export interface ModernizationFault {
  fault_state: number | string
  fault_category: string
  fault_severity: string
  affected_component: CompId | string
}

export interface ModernizationRul {
  current_rul_hours: number | null
  current_rul_years: number | null
  projected_rul_hours: number | null
  projected_rul_years: number | null
  impact_delta_hours: number | null
  impact_delta_years: number | null
  status: string
  reason: string
}

export interface ModernizationElevatorLifecycle {
  elevator_age_years?: number | null
  age_years?: number | null
  operating_hours: number | null
  days_since_maintenance?: number | null
  last_maintenance_date?: string | null
  maintenance_frequency?: string | null
  obsolescence_status: string
}

export interface ModernizationOptionItem {
  id: string
  name: string
  description?: string
  component?: string
  hardware_cost_inr?: number | null
  labor_cost_inr?: number | null
  total_cost_inr?: number | null
  downtime_hours?: number | null
  expected_risk_after?: number | null
  expected_risk_pct?: number | null
  expected_condition?: string
  expected_maintenance_impact?: string
  expected_energy_impact?: string
  tco_5yr_inr?: number | null
  rul_impact_years?: number | null
  status: 'RECOMMENDED' | 'AVAILABLE' | 'ALTERNATIVE' | 'REVIEW_REQUIRED' | string
}

export interface ModernizationCost {
  hardware_cost_inr: number | null
  technician_hours: number | null
  hourly_rate_inr: number | null
  labor_cost_inr: number | null
  installation_cost_inr?: number | null
  total_cost_inr: number | null
  currency: string
  cost_source?: string
  source?: string
}

export interface ModernizationDowntime {
  installation_hours: number | null
  testing_hours: number | null
  total_downtime_hours: number | null
  planned_start: string | null
  planned_end: string | null
  schedule_status: string
}

export interface ModernizationBefore {
  risk_score: number | null
  risk_percentage: number | null
  condition: string
  fault_state: number | string | null
  fault_category?: string
  fault_severity?: string
  affected_component: string
  maintenance_status?: string
}

export interface ModernizationAfter {
  risk_score: number | null
  risk_percentage: number | null
  condition: string
  fault_state: number | string | null
  expected_rul_delta_years: number | null
  expected_energy_savings_percent: number | null
  expected_fault_reduction_percent: number | null
  projection_status: string
}

export interface EngineeringEvidenceItem {
  parameter: string
  value: number
  unit: string
  impact: string
}

export interface ModernizationEngineering {
  dominant_component: string
  physics_degradation?: number
  component_degradation?: Record<string, number>
  evidence?: EngineeringEvidenceItem[]
  recommendations?: string[]
}

export interface ModernizationProvenance {
  model_name: string
  model_type: string
  prediction_source: string
  feature_source: string
  data_source: string
  prediction_timestamp: string
  feature_snapshot?: CatBoostFeatureSnapshot
}

export interface ModernizationDisclaimers {
  pricing_disclaimer?: string
  pricing?: string
  inventory_disclaimer?: string
  inventory?: string
  rul_disclaimer?: string
  rul?: string
  projection_disclaimer?: string
  projection?: string
}

export interface ModernizationPayload {
  elevator_id: string
  analysis_timestamp?: string
  decision: ModernizationDecision
  risk: ModernizationRisk
  fault: ModernizationFault
  rul: ModernizationRul
  elevator: ModernizationElevatorLifecycle
  current_state?: Record<string, any>
  options: ModernizationOptionItem[]
  cost: ModernizationCost
  downtime: ModernizationDowntime
  before: ModernizationBefore
  after: ModernizationAfter
  engineering: ModernizationEngineering
  provenance: ModernizationProvenance
  disclaimers: ModernizationDisclaimers
  scenarios?: Record<string, any>
}

export type ModernizationData = ModernizationPayload | any
