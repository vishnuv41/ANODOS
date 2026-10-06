'use client'

import { useState } from 'react'
import {
  Building,
  CheckCircle2,
  Lock,
  Shield,
  ArrowRight,
  Server,
  Building2,
  Wrench,
  Sparkles,
} from 'lucide-react'
import { useAnodos } from '@/store/useAnodos'
import type { UserRole } from '@/lib/types'

interface LoginPageProps {
  onLogin: (role: UserRole) => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const { backendLive } = useAnodos()
  const [selectedRole, setSelectedRole] = useState<UserRole>('manager')
  const [username, setUsername] = useState<string>('marcus.vance@metropolis-tower.com')
  const [password, setPassword] = useState<string>('••••••••••••')

  const handleRoleSelect = (r: UserRole) => {
    setSelectedRole(r)
    if (r === 'manager') {
      setUsername('marcus.vance@metropolis-tower.com')
      setPassword('••••••••••••')
    } else {
      setUsername('tech.marcus@metropolis-tower.com')
      setPassword('••••••••••••')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onLogin(selectedRole)
  }

  const handleQuickAccess = (r: UserRole) => {
    setSelectedRole(r)
    onLogin(r)
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-bg via-surface to-raised flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* BACKGROUND DECORATIVE GRID PATTERN */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* LOGIN CARD CONTAINER (MATCHES SCREENSHOT SPEC) */}
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-2xl space-y-6 relative z-10">
        
        {/* LOGO & TITLE HEADER */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-onbrand shadow-md shadow-brand/30">
            <Shield size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-ink uppercase">ANODOS</h1>
            <p className="text-xs font-semibold text-muted mt-0.5">
              Predictive Maintenance & Digital Twin Platform
            </p>
          </div>
        </div>

        {/* DEMO PORTAL ANNOUNCEMENT BANNER */}
        <div className="rounded-xl border border-brand/30 bg-brand/10 p-3.5 text-xs flex items-start gap-3">
          <Lock size={18} className="text-brand shrink-0 mt-0.5" />
          <p className="text-ink leading-relaxed font-medium">
            <strong className="font-bold text-brand">Demo Portal:</strong> Select a role below to access the role-specific operational dashboard.
          </p>
        </div>

        {/* LOGIN FORM */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* SELECT OPERATIONAL ROLE TOGGLE */}
          <div className="space-y-2">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-muted block">
              SELECT OPERATIONAL ROLE
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleRoleSelect('manager')}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-xs font-bold transition-all ${
                  selectedRole === 'manager'
                    ? 'border-brand bg-brand/10 text-brand ring-2 ring-brand/30 shadow-sm'
                    : 'border-line bg-surface text-muted hover:border-line/80 hover:text-ink'
                }`}
              >
                <Building size={16} />
                <span>Building Manager</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('technician')}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-xs font-bold transition-all ${
                  selectedRole === 'technician'
                    ? 'border-brand bg-brand/10 text-brand ring-2 ring-brand/30 shadow-sm'
                    : 'border-line bg-surface text-muted hover:border-line/80 hover:text-ink'
                }`}
              >
                <Wrench size={16} />
                <span>Technician</span>
              </button>
            </div>
          </div>

          {/* EMAIL / USERNAME INPUT */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink block">
              Email / Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-line bg-raised/70 px-4 py-3 text-xs font-semibold text-ink focus:border-brand focus:bg-surface focus:outline-none focus:ring-1 focus:ring-brand transition-all"
              placeholder="name@company.com"
              required
            />
          </div>

          {/* PASSWORD INPUT */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink block">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-line bg-raised/70 px-4 py-3 text-xs font-mono text-ink focus:border-brand focus:bg-surface focus:outline-none focus:ring-1 focus:ring-brand transition-all"
              placeholder="••••••••••••"
              required
            />
          </div>

          {/* SIGN IN BUTTON */}
          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-brand text-onbrand font-bold text-xs uppercase tracking-wider shadow-lg shadow-brand/20 hover:bg-brand/90 transition flex items-center justify-center gap-2"
          >
            <span>Sign In to Dashboard</span>
            <ArrowRight size={16} />
          </button>
        </form>

        {/* DIVIDER & 1-CLICK QUICK ACCESS */}
        <div className="space-y-4 pt-2 border-t border-line/60">
          <div className="relative flex items-center justify-center">
            <span className="bg-surface px-3 text-[10px] font-extrabold uppercase tracking-widest text-muted">
              1-CLICK QUICK DEMO ACCESS
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleQuickAccess('manager')}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-line bg-surface hover:bg-raised text-xs font-semibold text-ink transition"
            >
              <CheckCircle2 size={14} className="text-brand" />
              <span>Enter as Manager</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickAccess('technician')}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-line bg-surface hover:bg-raised text-xs font-semibold text-ink transition"
            >
              <CheckCircle2 size={14} className="text-brand" />
              <span>Enter as Tech</span>
            </button>
          </div>
        </div>

        {/* FOOTER BENCHMARK METADATA */}
        <div className="text-center pt-2">
          <p className="text-[10px] font-semibold text-muted">
            KONE Elevate Hackathon Presentation • Unseen 10k Dataset Simulation
          </p>
          <p className="text-[9px] font-mono text-muted/80 mt-0.5">
            Baseline: Traction VVVF • 1000kg (13 Persons) • 2.5m/s
          </p>
        </div>

      </div>
    </div>
  )
}

