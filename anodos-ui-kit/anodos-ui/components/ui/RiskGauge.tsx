'use client'
import { healthOf, HEALTH_HEX } from '@/store/useAnodos'

/** Semicircle speedometer — same LOW / MEDIUM / HIGH idea as MedTouch RiskGauge. */
export default function RiskGauge({ risk }: { risk: number }) {
  const R = 90, C = Math.PI * R
  const angle = -90 + (Math.min(100, risk) / 100) * 180
  const color = HEALTH_HEX[healthOf(risk)]
  const seg = (from: number, to: number, c: string) => (
    <circle cx="110" cy="110" r={R} fill="none" stroke={c} strokeWidth="16" strokeOpacity=".25"
      strokeDasharray={`${((to - from) / 100) * C} ${C * 2}`} strokeDashoffset={-(from / 100) * C} transform="rotate(180 110 110)" />
  )
  return (
    <svg viewBox="0 0 220 130" className="mx-auto w-full max-w-[320px]">
      {seg(0, 30, HEALTH_HEX.normal)}{seg(30, 60, HEALTH_HEX.warning)}{seg(60, 80, HEALTH_HEX.high)}{seg(80, 100, HEALTH_HEX.fault)}
      <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '110px 110px', transition: 'transform 1s cubic-bezier(.2,.9,.3,1.2)' }}>
        <path d="M110 110 L110 34" stroke={color} strokeWidth="4" strokeLinecap="round" />
        <circle cx="110" cy="110" r="8" fill={color} />
      </g>
      <text x="110" y="100" textAnchor="middle" className="fill-ink" fontSize="30" fontWeight="800">{risk}%</text>
      <text x="16" y="126" className="fill-muted" fontSize="9">LOW</text>
      <text x="204" y="126" textAnchor="end" className="fill-muted" fontSize="9">FAULT</text>
    </svg>
  )
}
