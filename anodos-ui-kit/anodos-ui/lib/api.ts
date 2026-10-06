import type { ElevatorState, ModernizationData, ModernizationOption } from './types'

export const getBackendUrl = () => {
  if (typeof process !== 'undefined' && process.env.VITE_BACKEND_URL) {
    return process.env.VITE_BACKEND_URL
  }
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  return 'http://127.0.0.1:8001'
}

export const getWsUrl = (elevatorId: string = 'E001') => {
  const httpUrl = getBackendUrl()
  let wsUrl = httpUrl.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://')
  return `${wsUrl.replace(/\/$/, '')}/ws/elevator/${elevatorId}`
}

/** Health check: GET /health */
export async function checkBackendHealth(): Promise<boolean> {
  const url = `${getBackendUrl().replace(/\/$/, '')}/health`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      return data.status === 'ok'
    }
  } catch {
    /* backend offline */
  }
  return false
}

/** Fetch authoritative elevator state: GET /api/elevator/{id}/state */
export async function fetchElevatorState(elevatorId: string = 'E001'): Promise<ElevatorState | null> {
  const url = `${getBackendUrl().replace(/\/$/, '')}/api/elevator/${elevatorId}/state`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`[ANODOS API] Failed to fetch state from ${url}:`, err)
    return null
  }
}

/** Fetch telemetry history: GET /api/elevators/{id}/telemetry?limit=50 */
export async function fetchTelemetryHistory(elevatorId: string = 'E001', limit: number = 50): Promise<any> {
  const url = `${getBackendUrl().replace(/\/$/, '')}/api/elevators/${elevatorId}/telemetry?limit=${limit}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`[ANODOS API] Telemetry history endpoint unavailable:`, err)
    return null
  }
}

/** Fetch predictions history: GET /api/elevators/{id}/predictions?limit=50 */
export async function fetchPredictionsHistory(elevatorId: string = 'E001', limit: number = 50): Promise<any> {
  const url = `${getBackendUrl().replace(/\/$/, '')}/api/elevators/${elevatorId}/predictions?limit=${limit}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`[ANODOS API] Predictions endpoint unavailable:`, err)
    return null
  }
}

/** Fetch predictive maintenance info: GET /api/elevators/{id}/maintenance */
export async function fetchMaintenanceInfo(elevatorId: string = 'E001'): Promise<any> {
  const url = `${getBackendUrl().replace(/\/$/, '')}/api/elevators/${elevatorId}/maintenance`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`[ANODOS API] Maintenance endpoint unavailable:`, err)
    return null
  }
}

/** Fetch events history: GET /api/elevators/{id}/events */
export async function fetchEventsHistory(elevatorId: string = 'E001', limit: number = 50): Promise<any> {
  const url = `${getBackendUrl().replace(/\/$/, '')}/api/elevators/${elevatorId}/events?limit=${limit}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`[ANODOS API] Events endpoint unavailable:`, err)
    return null
  }
}

/** Fetch timeline history: GET /api/elevators/{id}/timeline */
export async function fetchTimelineHistory(elevatorId: string = 'E001'): Promise<any> {
  const url = `${getBackendUrl().replace(/\/$/, '')}/api/elevators/${elevatorId}/timeline`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`[ANODOS API] Timeline endpoint unavailable:`, err)
    return null
  }
}

/** Fetch RUL info: GET /api/elevators/{id}/rul */
export async function fetchRulInfo(elevatorId: string = 'E001'): Promise<any> {
  const url = `${getBackendUrl().replace(/\/$/, '')}/api/elevators/${elevatorId}/rul`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`[ANODOS API] RUL endpoint unavailable:`, err)
    return null
  }
}

/** Fetch modernization overview: GET /api/elevator/{id}/modernization */
export async function fetchModernization(elevatorId: string = 'E001'): Promise<ModernizationData | null> {
  const url = `${getBackendUrl().replace(/\/$/, '')}/api/elevator/${elevatorId}/modernization`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`[ANODOS API] Modernization endpoint ${url} unavailable:`, err)
    return null
  }
}

/** Fetch modernization compare: GET /api/elevator/{id}/modernization/compare */
export async function fetchModernizationCompare(elevatorId: string = 'E001'): Promise<any> {
  const url = `${getBackendUrl().replace(/\/$/, '')}/api/elevator/${elevatorId}/modernization/compare`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`[ANODOS API] Modernization compare endpoint ${url} unavailable:`, err)
    return null
  }
}

/** Fetch modernization option detail: GET /api/elevator/{id}/modernization/{option_id} */
export async function fetchModernizationOption(elevatorId: string, optionId: string): Promise<ModernizationOption | null> {
  const url = `${getBackendUrl().replace(/\/$/, '')}/api/elevator/${elevatorId}/modernization/${optionId}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`[ANODOS API] Option detail endpoint ${url} unavailable:`, err)
    return null
  }
}

/** Upload JSON document payload to POST /api/elevator/{id}/modernization/upload */
export async function uploadModernizationJson(elevatorId: string, payload: Record<string, any>): Promise<{ ok: boolean; message: string }> {
  const url = `${getBackendUrl().replace(/\/$/, '')}/api/elevator/${elevatorId}/modernization/upload`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return { ok: true, message: data.message || 'Record stored in backend successfully' }
  } catch (err: any) {
    console.warn(`[ANODOS API] Modernization JSON upload failed:`, err)
    return { ok: false, message: err.message || 'Upload failed or endpoint unavailable' }
  }
}

/** Upload PDF / CSV / JSON document file to POST /api/elevator/{id}/report/upload-file */
export async function uploadReportFile(elevatorId: string, file: File): Promise<any> {
  const url = `${getBackendUrl().replace(/\/$/, '')}/api/elevator/${elevatorId}/report/upload-file`
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err: any) {
    console.warn(`[ANODOS API] Report file upload failed:`, err)
    return null
  }
}
