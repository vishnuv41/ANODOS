'use client'

import { Package } from 'lucide-react'
import { useAnodos } from '@/store/useAnodos'

export default function SparePartsTab() {
  const { elevatorId, rawBackendState } = useAnodos()
  const pred = rawBackendState?.prediction
  const affectedComp = pred?.affected_component || 'brake'

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand">
            <Package size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-ink">
              Recommended Spare Parts & Components — {elevatorId}
            </h1>
            <p className="text-xs text-muted">
              Component Inventory Catalog & Maintenance Part Requisitions
            </p>
          </div>
        </div>

        <div className="text-right text-xs">
          <span className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1 font-bold text-brand">
            Flagged Component: {affectedComp.toUpperCase()}
          </span>
        </div>
      </div>

      {/* RECOMMENDED PARTS GRID */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Part 1: Primary Flagged Component Part */}
        <div className="rounded-xl border border-accent/40 bg-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="rounded bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent uppercase">
              Primary Target ({affectedComp})
            </span>
            <span className="text-xs font-bold text-ok">In Stock</span>
          </div>
          <h3 className="text-base font-bold text-ink capitalize">
            Industrial {affectedComp} Assembly Pack (OEM)
          </h3>
          <p className="text-xs text-muted">
            Heavy-duty OEM replacement assembly recommended for elevator unit {elevatorId}.
          </p>

          <dl className="space-y-1.5 border-t border-line/60 pt-3 text-xs">
            <div className="flex justify-between">
              <dt className="text-muted">Part Number:</dt>
              <dd className="font-mono font-bold text-ink">ANO-PRT-{affectedComp.substring(0, 3).toUpperCase()}-902</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Compatibility:</dt>
              <dd className="font-bold text-ink">{elevatorId} (Standard Shaft Spec)</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Unit Cost:</dt>
              <dd className="font-bold text-ink">Pricing integration required</dd>
            </div>
          </dl>

          <button
            disabled
            className="w-full rounded-lg border border-line bg-raised py-2 text-xs font-bold text-muted cursor-not-allowed"
          >
            Requisition Part (Pricing integration required)
          </button>
        </div>

        {/* Part 2: Auxiliary Controller & Relays */}
        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="rounded bg-raised px-2 py-0.5 text-[11px] font-bold text-muted uppercase">
              Auxiliary
            </span>
            <span className="text-xs font-bold text-ok">In Stock</span>
          </div>
          <h3 className="text-base font-bold text-ink">
            Main Controller Logic & Relay Module
          </h3>
          <p className="text-xs text-muted">
            Solid-state microprocessor board for elevator logic control and safety relay switches.
          </p>

          <dl className="space-y-1.5 border-t border-line/60 pt-3 text-xs">
            <div className="flex justify-between">
              <dt className="text-muted">Part Number:</dt>
              <dd className="font-mono font-bold text-ink">ANO-CTRL-BOARD-44</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Compatibility:</dt>
              <dd className="font-bold text-ink">Universal Pass & Freight</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Unit Cost:</dt>
              <dd className="font-bold text-ink">Pricing integration required</dd>
            </div>
          </dl>

          <button
            disabled
            className="w-full rounded-lg border border-line bg-raised py-2 text-xs font-bold text-muted cursor-not-allowed"
          >
            Requisition Part (Pricing integration required)
          </button>
        </div>

        {/* Part 3: Door Operator Belt & Pulley Kit */}
        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="rounded bg-raised px-2 py-0.5 text-[11px] font-bold text-muted uppercase">
              Wear & Tear Kit
            </span>
            <span className="text-xs font-bold text-ok">In Stock</span>
          </div>
          <h3 className="text-base font-bold text-ink">
            Traction Motor Bearings & Belt Service Kit
          </h3>
          <p className="text-xs text-muted">
            High-friction belt, precision bearings, and alignment shims for vibration suppression.
          </p>

          <dl className="space-y-1.5 border-t border-line/60 pt-3 text-xs">
            <div className="flex justify-between">
              <dt className="text-muted">Part Number:</dt>
              <dd className="font-mono font-bold text-ink">ANO-KIT-BEARINGS-08</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Compatibility:</dt>
              <dd className="font-bold text-ink">E001, E002, E003</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Unit Cost:</dt>
              <dd className="font-bold text-ink">Pricing integration required</dd>
            </div>
          </dl>

          <button
            disabled
            className="w-full rounded-lg border border-line bg-raised py-2 text-xs font-bold text-muted cursor-not-allowed"
          >
            Requisition Part (Pricing integration required)
          </button>
        </div>
      </div>
    </div>
  )
}
