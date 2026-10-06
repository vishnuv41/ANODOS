'use client'

import { Panel } from '../../ui/primitives'
import { useAnodos } from '@/store/useAnodos'

export default function EquipmentFacilityTab() {
  const { elevatorId } = useAnodos()

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line/70 bg-surface/90 p-5 shadow-card">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Equipment & Facility Information</h1>
        <p className="text-xs text-muted mt-1">Enterprise Facility Management & Equipment Baseline Profile</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Manager & Facility Contact">
          <dl className="space-y-3 text-xs">
            <div className="flex justify-between border-b border-line/40 pb-2">
              <dt className="text-muted font-medium">Manager Full Name</dt>
              <dd className="font-semibold text-muted">Not configured</dd>
            </div>
            <div className="flex justify-between border-b border-line/40 pb-2">
              <dt className="text-muted font-medium">Work Email</dt>
              <dd className="font-semibold text-muted">Not configured</dd>
            </div>
            <div className="flex justify-between border-b border-line/40 pb-2">
              <dt className="text-muted font-medium">Phone Number</dt>
              <dd className="font-semibold text-muted">Not configured</dd>
            </div>
            <div className="flex justify-between border-b border-line/40 pb-2">
              <dt className="text-muted font-medium">Facility Address</dt>
              <dd className="font-semibold text-muted text-right">Not configured</dd>
            </div>
            <div className="flex justify-between border-b border-line/40 pb-2">
              <dt className="text-muted font-medium">On-Site Access Contact</dt>
              <dd className="font-semibold text-muted">Not configured</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Elevator Baseline Technical Specs">
          <dl className="space-y-3 text-xs">
            <div className="flex justify-between border-b border-line/40 pb-2">
              <dt className="text-muted font-medium">Equipment / Elevator ID</dt>
              <dd className="font-extrabold text-accent">{elevatorId}</dd>
            </div>
            <div className="flex justify-between border-b border-line/40 pb-2">
              <dt className="text-muted font-medium">Installation Year</dt>
              <dd className="font-semibold text-muted">Not configured</dd>
            </div>
            <div className="flex justify-between border-b border-line/40 pb-2">
              <dt className="text-muted font-medium">Drive Mechanism Type</dt>
              <dd className="font-bold text-ink">Geared Traction Motor</dd>
            </div>
            <div className="flex justify-between border-b border-line/40 pb-2">
              <dt className="text-muted font-medium">Rated Load Capacity</dt>
              <dd className="font-semibold text-muted">Data unavailable</dd>
            </div>
            <div className="flex justify-between border-b border-line/40 pb-2">
              <dt className="text-muted font-medium">Rated Nominal Speed</dt>
              <dd className="font-semibold text-muted">Data unavailable</dd>
            </div>
          </dl>
        </Panel>
      </div>

      <Panel title="Building Usage & Duty Cycle Baseline">
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="rounded-lg border border-line/50 p-3 bg-raised/40">
            <dt className="text-muted font-medium">Building Classification</dt>
            <dd className="font-semibold text-muted text-sm mt-1">Not configured</dd>
          </div>
          <div className="rounded-lg border border-line/50 p-3 bg-raised/40">
            <dt className="text-muted font-medium">Average Daily Trips</dt>
            <dd className="font-semibold text-muted text-sm mt-1">Data unavailable</dd>
          </div>
          <div className="rounded-lg border border-line/50 p-3 bg-raised/40">
            <dt className="text-muted font-medium">Average Daily Door Cycles</dt>
            <dd className="font-semibold text-muted text-sm mt-1">Data unavailable</dd>
          </div>
        </dl>
      </Panel>
    </div>
  )
}
