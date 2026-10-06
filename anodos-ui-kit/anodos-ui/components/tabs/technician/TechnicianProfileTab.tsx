'use client'

import { Award, CheckCircle2, Shield, User, Wrench } from 'lucide-react'
import { useAnodos } from '@/store/useAnodos'

export default function TechnicianProfileTab() {
  const { elevatorId } = useAnodos()

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand">
            <User size={26} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-ink">
              Lead Field Engineer Profile
            </h1>
            <p className="text-xs text-muted">
              ANODOS Certified Senior Elevator Specialist
            </p>
          </div>
        </div>

        <span className="rounded-full border border-ok/40 bg-ok/10 px-3 py-1 text-xs font-bold text-ok">
          ● ACTIVE ON DUTY
        </span>
      </div>

      {/* PROFILE DETAILS GRID */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-ink flex items-center gap-2">
            <Shield size={18} className="text-brand" />
            <span>Credentials & Authorization</span>
          </h3>

          <dl className="space-y-2 text-xs">
            <div className="flex justify-between border-b border-line/40 pb-2">
              <dt className="text-muted">Technician ID:</dt>
              <dd className="font-mono font-bold text-ink">TECH-88204</dd>
            </div>
            <div className="flex justify-between border-b border-line/40 pb-2">
              <dt className="text-muted">Certification Level:</dt>
              <dd className="font-bold text-ink">Master Elevator Engineer (Level 4)</dd>
            </div>
            <div className="flex justify-between border-b border-line/40 pb-2">
              <dt className="text-muted">Assigned Site:</dt>
              <dd className="font-bold text-ink">Commercial Tower Complex A & B</dd>
            </div>
            <div className="flex justify-between border-b border-line/40 pb-2">
              <dt className="text-muted">Active Assignment:</dt>
              <dd className="font-bold text-accent">Unit {elevatorId}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-ink flex items-center gap-2">
            <Award size={18} className="text-ok" />
            <span>Safety & Equipment Qualifications</span>
          </h3>

          <ul className="space-y-2 text-xs text-ink font-semibold">
            <li className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-ok" />
              <span>OSHA High-Rise Shaft Safety Certified</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-ok" />
              <span>CatBoost AI Diagnostic Interpretation Standard</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-ok" />
              <span>High-Voltage Traction Motor & Drive Inverter Specialist</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
