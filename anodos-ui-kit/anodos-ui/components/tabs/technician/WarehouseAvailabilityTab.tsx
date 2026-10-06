'use client'

import { Layers, MapPin } from 'lucide-react'
import { useAnodos } from '@/store/useAnodos'

export default function WarehouseAvailabilityTab() {
  const { elevatorId, rawBackendState } = useAnodos()
  const affectedComp = rawBackendState?.prediction?.affected_component || 'brake'

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand">
            <Layers size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-ink">
              Multi-Warehouse Parts Availability Matrix
            </h1>
            <p className="text-xs text-muted">
              Live Stock Status Across Regional Storage Depots for Unit {elevatorId}
            </p>
          </div>
        </div>

        <div className="text-xs text-muted font-medium">
          Inventory API: <strong className="text-ink">Inventory integration required</strong>
        </div>
      </div>

      {/* WAREHOUSE LOCATIONS */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Warehouse 1 */}
        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-accent" />
            <h3 className="font-bold text-ink">Central Depot — Hub Alpha</h3>
          </div>
          <p className="text-xs text-muted">Distance: 4.2 km from Site</p>

          <div className="space-y-2 border-t border-line/60 pt-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-medium text-ink capitalize">{affectedComp} Kit</span>
              <span className="rounded bg-ok/15 px-2 py-0.5 font-bold text-ok text-[11px]">In Stock (3 Units)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-ink">Traction Motor</span>
              <span className="rounded bg-ok/15 px-2 py-0.5 font-bold text-ok text-[11px]">In Stock (1 Unit)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-ink">Controller Board</span>
              <span className="rounded bg-warn/15 px-2 py-0.5 font-bold text-warn text-[11px]">Low Stock (1 Unit)</span>
            </div>
          </div>
        </div>

        {/* Warehouse 2 */}
        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-brand" />
            <h3 className="font-bold text-ink">North Logistics Center</h3>
          </div>
          <p className="text-xs text-muted">Distance: 18.5 km from Site</p>

          <div className="space-y-2 border-t border-line/60 pt-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-medium text-ink capitalize">{affectedComp} Kit</span>
              <span className="rounded bg-ok/15 px-2 py-0.5 font-bold text-ok text-[11px]">In Stock (5 Units)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-ink">Door Operator Engine</span>
              <span className="rounded bg-ok/15 px-2 py-0.5 font-bold text-ok text-[11px]">In Stock (2 Units)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-ink">Shaft Cables</span>
              <span className="rounded bg-ok/15 px-2 py-0.5 font-bold text-ok text-[11px]">In Stock (12 Spools)</span>
            </div>
          </div>
        </div>

        {/* Warehouse 3 */}
        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-muted" />
            <h3 className="font-bold text-ink">South Terminal Reserve</h3>
          </div>
          <p className="text-xs text-muted">Distance: 32.0 km from Site</p>

          <div className="space-y-2 border-t border-line/60 pt-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-medium text-ink capitalize">{affectedComp} Kit</span>
              <span className="rounded bg-raised px-2 py-0.5 font-bold text-muted text-[11px]">Out of Stock</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-ink">Safety Brakes</span>
              <span className="rounded bg-ok/15 px-2 py-0.5 font-bold text-ok text-[11px]">In Stock (4 Units)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-ink">Counterweight Blocks</span>
              <span className="rounded bg-ok/15 px-2 py-0.5 font-bold text-ok text-[11px]">In Stock (8 Units)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
