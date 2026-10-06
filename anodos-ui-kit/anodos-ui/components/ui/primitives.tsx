'use client'
import { ReactNode } from 'react'
import type { Health } from '@/lib/types'
import { HEALTH_LABEL } from '@/store/useAnodos'

export const TONE: Record<Health, string> = {
  normal: 'text-ok bg-ok/12 border-ok/30', warning: 'text-warn bg-warn/12 border-warn/30',
  high: 'text-high bg-high/12 border-high/30', high_risk: 'text-high bg-high/12 border-high/30', fault: 'text-fault bg-fault/12 border-fault/30',
}
export const BAR: Record<Health, string> = { normal: 'bg-ok', warning: 'bg-warn', high: 'bg-high', high_risk: 'bg-high', fault: 'bg-fault' }
export const TEXT: Record<Health, string> = { normal: 'text-ok', warning: 'text-warn', high: 'text-high', high_risk: 'text-high', fault: 'text-fault' }

export function Panel({ title, right, children, className = '' }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-5 animate-slideUp ${className}`}>
      {(title || right) && (
        <header className="mb-4 flex items-center justify-between">
          {typeof title === 'string' ? <h3 className="label">{title}</h3> : title}
          {right}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, unit, tone, icon }: { label: string; value: ReactNode; unit?: string; tone?: Health; icon?: ReactNode }) {
  return (
    <div className="card card-hover p-4">
      <div className="flex items-center justify-between"><span className="label">{label}</span>{icon}</div>
      <div className={`mt-2 text-3xl font-bold tabular-nums ${tone ? TEXT[tone] : 'text-ink'}`}>
        {value}{unit && <span className="ml-1 text-sm font-medium text-muted">{unit}</span>}
      </div>
    </div>
  )
}

export function Badge({ health, children }: { health: Health; children?: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${TONE[health]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${BAR[health]} ${health === 'fault' ? 'animate-pulse' : ''}`} />
      {children ?? HEALTH_LABEL[health]}
    </span>
  )
}

export function RiskBar({ risk, health }: { risk: number; health: Health }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line/60">
      <div className={`h-full rounded-full transition-all duration-700 ${BAR[health]}`} style={{ width: `${Math.max(3, risk)}%` }} />
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">{children}</div>
}
