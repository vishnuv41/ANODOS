'use client'

import { Clock, MapPin, Navigation, Truck } from 'lucide-react'
import { useAnodos } from '@/store/useAnodos'

export default function DispatchLogisticsTab() {
  const { elevatorId, rawBackendState } = useAnodos()
  const pred = rawBackendState?.prediction
  const isHighRisk = (pred?.risk_score ?? 0) > 0.5 || pred?.fault_severity === 'High' || pred?.fault_severity === 'Critical'

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/10 text-accent">
            <Truck size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-ink">
              Emergency Dispatch & Logistics Command — {elevatorId}
            </h1>
            <p className="text-xs text-muted">
              Rapid Field Response & Mobile Service Van Tracking
            </p>
          </div>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold ${
            isHighRisk
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-ok/40 bg-ok/10 text-ok'
          }`}
        >
          {isHighRisk ? '● DISPATCH REQUIRED' : '● STANDBY / REGULAR DISPATCH'}
        </span>
      </div>

      {/* DISPATCH STATUS CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-muted uppercase">
            <Navigation size={16} className="text-brand" />
            <span>Service Vehicle Route</span>
          </div>
          <div className="text-lg font-bold text-ink">Van Alpha #82</div>
          <div className="text-xs text-muted font-medium">Logistics integration required</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-muted uppercase">
            <Clock size={16} className="text-brand" />
            <span>Estimated Arrival (ETA)</span>
          </div>
          <div className="text-lg font-bold text-ink">12 mins</div>
          <div className="text-xs text-muted font-medium">En route via Express Highway</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-muted uppercase">
            <MapPin size={16} className="text-brand" />
            <span>Destination Unit</span>
          </div>
          <div className="text-lg font-bold text-ink">Elevator {elevatorId}</div>
          <div className="text-xs text-muted font-medium">Main Tower Machine Room</div>
        </div>
      </div>
    </div>
  )
}
