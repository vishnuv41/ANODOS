'use client'

import { useState } from 'react'
import { Activity, ShieldCheck, UserCheck, Wrench, Lock, CheckCircle2, ArrowRight } from 'lucide-react'
import { useAnodos } from '@/store/useAnodos'
import type { UserRole } from '@/lib/types'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { role, setRole } = useAnodos()
  const [selectedRole, setSelectedRole] = useState<UserRole>(role)
  const [username, setUsername] = useState<string>(role === 'manager' ? 'manager' : 'technician')
  const [password, setPassword] = useState<string>('••••••••')

  if (!isOpen) return null

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setRole(selectedRole)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl space-y-6">
        {/* LOGO & TITLE */}
        <div className="text-center space-y-2">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand text-onbrand shadow-lg">
            <Activity size={26} />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-ink">ANODOS PLATFORM</h2>
          <p className="text-xs text-muted font-medium">
            Elevator Digital Twin & Predictive Intelligence Login
          </p>
        </div>

        {/* LOGIN FORM */}
        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          {/* USERNAME */}
          <div>
            <label className="font-bold text-muted uppercase tracking-wider block mb-1">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-line bg-raised px-3.5 py-2.5 font-medium text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                placeholder="Enter username..."
                required
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div>
            <label className="font-bold text-muted uppercase tracking-wider block mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-line bg-raised px-3.5 py-2.5 font-mono text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                placeholder="Enter password..."
                required
              />
            </div>
          </div>

          {/* ROLE SELECTION RADIO CARDS */}
          <div>
            <label className="font-bold text-muted uppercase tracking-wider block mb-2">
              Select Operating Role
            </label>

            <div className="grid grid-cols-2 gap-3">
              {/* MANAGER ROLE */}
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('manager')
                  setUsername('manager')
                }}
                className={`flex flex-col items-start p-3.5 rounded-xl border transition-all text-left ${
                  selectedRole === 'manager'
                    ? 'border-brand bg-brand/10 text-ink ring-2 ring-brand/30 shadow-sm'
                    : 'border-line/70 bg-raised text-muted hover:border-line hover:text-ink'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <UserCheck size={18} className={selectedRole === 'manager' ? 'text-brand' : 'text-muted'} />
                  {selectedRole === 'manager' && <CheckCircle2 size={14} className="text-brand" />}
                </div>
                <span className="font-bold text-sm text-ink block">Manager</span>
                <span className="text-[10px] text-muted leading-tight mt-0.5">
                  Modernization decision, ROI, & fleet overview
                </span>
              </button>

              {/* TECHNICIAN ROLE */}
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('technician')
                  setUsername('technician')
                }}
                className={`flex flex-col items-start p-3.5 rounded-xl border transition-all text-left ${
                  selectedRole === 'technician'
                    ? 'border-accent bg-accent/10 text-ink ring-2 ring-accent/30 shadow-sm'
                    : 'border-line/70 bg-raised text-muted hover:border-line hover:text-ink'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <Wrench size={18} className={selectedRole === 'technician' ? 'text-accent' : 'text-muted'} />
                  {selectedRole === 'technician' && <CheckCircle2 size={14} className="text-accent" />}
                </div>
                <span className="font-bold text-sm text-ink block">Technician</span>
                <span className="text-[10px] text-muted leading-tight mt-0.5">
                  Field dispatch, work order, simulation, & tools
                </span>
              </button>
            </div>
          </div>

          {/* BACKEND STATUS NOTICE */}
          <div className="rounded-xl border border-line/60 bg-raised p-3 text-[11px] text-muted font-medium">
            <span className="font-bold text-ink block mb-0.5">Single Backend Source of Truth:</span>
            Both portals connect to the same FastAPI backend (<code className="font-mono text-brand font-bold">http://localhost:8001</code>) and share live WebSocket predictions for unit E001.
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-brand text-onbrand font-black text-xs uppercase tracking-wider shadow-lg hover:bg-brand/90 transition flex items-center justify-center gap-2 mt-2"
          >
            <span>LOGIN TO {selectedRole.toUpperCase()} PORTAL</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  )
}
