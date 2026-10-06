'use client'

import { useEffect, useRef, useState } from 'react'
import type { CompId } from '@/lib/types'
import { createViewer } from '@/lib/scene/scene'
import { HEALTH_HEX, HEALTH_LABEL, selectComponents, useAnodos } from '@/store/useAnodos'

type Theme = 'light' | 'dark'

type ExistingViewer = {
  focusComponent: (id: string) => boolean
  setView: (view: string) => void
  setTheme: (theme: Theme) => void
  zoomBy: (factor: number) => void
  resize: () => void
  dispose: () => void
}

const THEME_KEY = 'anodos-twin-theme'
const VIEWS = [
  ['reset', 'Reset'],
  ['front', 'Front'],
  ['side', 'Side'],
  ['top', 'Top'],
  ['machine', 'Machine'],
] as const

const btn = 'rounded px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-raised border border-line/50 bg-surface/80'

export default function DigitalTwinViewer({ height = 480 }: { height?: number | string }) {
  const [mounted, setMounted] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<ExistingViewer | null>(null)
  const focusKey = useAnodos((state) => state.focusKey)
  const selectedComponent = useAnodos((state) => state.selectedComponent)
  const setSelectedComponent = useAnodos((state) => state.setSelectedComponent)

  const [theme, setTheme] = useState<Theme>('light')
  const themeRef = useRef<Theme>('light')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved === 'light' || saved === 'dark') setTheme(saved)
    } catch {
      /* storage unavailable */
    }
  }, [])

  useEffect(() => {
    themeRef.current = theme
    viewerRef.current?.setTheme(theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* storage unavailable */
    }
  }, [theme])

  // Initialize 3D Viewer when canvas element is mounted
  useEffect(() => {
    if (!mounted || !canvasRef.current || !hostRef.current) return

    let cachedPrediction: unknown = Symbol('none')
    let cachedComponents: Record<string, string> = {}
    let cachedRisk: Record<string, number> = {}

    try {
      viewerRef.current = createViewer({
        canvas: canvasRef.current,
        container: hostRef.current,
        theme: themeRef.current,
        getState: () => {
          const state = useAnodos.getState()
          if (state.prediction !== cachedPrediction) {
            cachedPrediction = state.prediction
            const list = selectComponents(state.prediction)
            cachedComponents = Object.fromEntries(
              list.map((component) => [component.id, component.health === 'high' ? 'high_risk' : component.health])
            )
            cachedRisk = {}
            for (const component of list as any[]) {
              const r = component.risk ?? component.risk_score
              if (typeof r === 'number' && r >= 0 && r <= 1) cachedRisk[component.id] = r
            }
          }
          return {
            selected_component: state.selectedComponent,
            components: cachedComponents,
            component_risk: cachedRisk,
          }
        },
        onSelect: (id: string | null) => setSelectedComponent(id as CompId | null),
        onHover: () => {},
        onError: (err: any) => console.warn('[3D Viewer]', err),
        onFirstFrame: () => {},
      }) as ExistingViewer
    } catch (err) {
      console.error('[DigitalTwinViewer] Failed to create 3D viewer instance:', err)
    }

    // Auto-resize 3D scene when sidebar opens/closes or window resizes
    const resizeObserver = new ResizeObserver(() => {
      viewerRef.current?.resize()
    })
    if (hostRef.current) {
      resizeObserver.observe(hostRef.current)
    }

    return () => {
      resizeObserver.disconnect()
      viewerRef.current?.dispose()
      viewerRef.current = null
    }
  }, [mounted, setSelectedComponent])

  useEffect(() => {
    if (viewerRef.current && selectedComponent) {
      viewerRef.current.focusComponent(selectedComponent)
    }
  }, [focusKey, selectedComponent])

  const setView = (view: string) => viewerRef.current?.setView(view)
  const zoom = (factor: number) => viewerRef.current?.zoomBy(factor)

  return (
    <div className="flex flex-col gap-3 w-full h-full">
      {/* 3D Canvas Container */}
      <div
        ref={hostRef}
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
        className="relative w-full overflow-hidden rounded-xl border border-line/70 bg-surface/80 shadow-card"
      >
        <canvas ref={canvasRef} className="block h-full w-full outline-none" aria-label="ANODOS elevator digital twin" />

        {/* Bottom-Left inside Canvas: Health Legend Badges */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex flex-wrap gap-3 rounded-lg border border-line/60 bg-surface/85 px-3 py-1.5 text-[11px] font-semibold backdrop-blur">
          {(['normal', 'warning', 'high', 'fault'] as const).map((health) => (
            <span key={health} className="flex items-center gap-1.5 text-muted">
              <i className="h-2.5 w-2.5 rounded-full" style={{ background: HEALTH_HEX[health] }} />
              {health === 'high' ? 'High risk' : HEALTH_LABEL[health]}
            </span>
          ))}
        </div>
      </div>

      {/* Control Toolbar Row — Placed OUTSIDE & BELOW 3D View */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/60 bg-surface/85 p-2 backdrop-blur">
        {/* Theme switcher */}
        <div className="flex items-center gap-1.5" role="group" aria-label="Theme">
          <span className="text-xs font-bold text-muted px-1">Theme:</span>
          {(['light', 'dark'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
              className={`${btn} ${theme === value ? 'bg-raised font-bold text-accent border-accent/60 shadow-sm' : ''}`}
            >
              {value === 'light' ? 'White' : 'Dark'}
            </button>
          ))}
        </div>

        {/* Camera view presets */}
        <div className="flex items-center gap-1.5" role="group" aria-label="Camera view">
          <span className="text-xs font-bold text-muted px-1">View:</span>
          {VIEWS.map(([view, label]) => (
            <button key={view} type="button" onClick={() => setView(view)} className={btn}>
              {label}
            </button>
          ))}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1.5" role="group" aria-label="Zoom">
          <span className="text-xs font-bold text-muted px-1">Zoom:</span>
          <button type="button" onClick={() => zoom(0.8)} className={btn} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoom(1.25)} className={btn} aria-label="Zoom out">
            −
          </button>
        </div>
      </div>
    </div>
  )
}