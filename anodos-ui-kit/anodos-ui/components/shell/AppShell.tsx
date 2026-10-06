'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Cpu,
  History as HistoryIcon,
  LayoutDashboard,
  LineChart,
  Menu,
  PlayCircle,
  Sparkles,
  Wrench,
  UserCheck,
  Truck,
  ClipboardList,
  Layers,
  Database,
  Clock,
  FileText,
  Package,
  LogOut
} from 'lucide-react'
import type { TabId, UserRole } from '@/lib/types'
import { useAnodos } from '@/store/useAnodos'
import ThemeToggle from './ThemeToggle'
import LoginPage from './LoginPage'

// Import Tab Components
import Overview from '../tabs/Overview'
import TwinTab from '../tabs/TwinTab'
import AITab from '../tabs/AITab'
import MaintenanceTab from '../tabs/MaintenanceTab'
import ModernizationTab from '../tabs/manager/ModernizationTab'
import HistoryTab from '../tabs/HistoryTab'

// Import Technician Tab Components
import WorkOrderSummaryTab from '../tabs/technician/WorkOrderSummaryTab'
import DispatchLogisticsTab from '../tabs/technician/DispatchLogisticsTab'
import WarehouseAvailabilityTab from '../tabs/technician/WarehouseAvailabilityTab'
import UnseenDatasetSimulationTab from '../tabs/technician/UnseenDatasetSimulationTab'
import BatchOfflinePredictionTab from '../tabs/technician/BatchOfflinePredictionTab'
import HistoricalTimelineTab from '../tabs/technician/HistoricalTimelineTab'
import FutureMaintenanceRulTab from '../tabs/technician/FutureMaintenanceRulTab'
import EquipmentHistoryTab from '../tabs/technician/EquipmentHistoryTab'
import SparePartsTab from '../tabs/technician/SparePartsTab'
import EntireReportTab from '../tabs/technician/EntireReportTab'

// Manager Navigation Tabs
const MANAGER_TABS: { id: string; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'twin', label: 'Digital Twin', icon: Boxes },
  { id: 'ai', label: 'AI Prediction', icon: Cpu },
  { id: 'maintenance', label: 'Predictive Maintenance', icon: Wrench },
  { id: 'modernization', label: 'Modernization Center', icon: Sparkles },
  { id: 'history', label: 'Result & History', icon: HistoryIcon },
]

// Technician Navigation Groups
const TECHNICIAN_GROUPS = [
  {
    group: 'MACHINE TWIN',
    tabs: [
      { id: 'twin', label: 'Digital Twin', icon: Boxes },
      { id: 'ai', label: 'AI Prediction', icon: Cpu },
      { id: 'maintenance', label: 'Predictive Maintenance', icon: Wrench },
    ]
  },
  {
    group: 'FIELD OPERATIONS',
    tabs: [
      { id: 'work_order', label: 'Work Order Summary', icon: ClipboardList },
      { id: 'warehouse', label: 'Parts Availability', icon: Layers },
    ]
  },
  {
    group: 'DIAGNOSTICS',
    tabs: [
      { id: 'simulation', label: 'Unseen Dataset Sim', icon: Database },
      { id: 'batch_prediction', label: 'Batch Offline Engine', icon: Cpu },
      { id: 'timeline', label: 'Historical Timeline', icon: HistoryIcon },
    ]
  },
  {
    group: 'LIFECYCLE',
    tabs: [
      { id: 'rul', label: 'Future Maintenance & RUL', icon: Clock },
      { id: 'equipment_history', label: 'Equipment History', icon: Activity },
    ]
  },
  {
    group: 'REPORTS',
    tabs: [
      { id: 'report', label: 'Entire PDF Report', icon: FileText },
    ]
  }
]

const VIEW_MAP: Record<string, () => JSX.Element> = {
  overview: Overview,
  twin: TwinTab,
  ai: AITab,
  maintenance: MaintenanceTab,
  modernization: ModernizationTab,
  history: HistoryTab,

  // Technician Specific Views
  work_order: WorkOrderSummaryTab,
  dispatch: DispatchLogisticsTab,
  warehouse: WarehouseAvailabilityTab,
  simulation: UnseenDatasetSimulationTab,
  batch_prediction: BatchOfflinePredictionTab,
  timeline: HistoricalTimelineTab,
  rul: FutureMaintenanceRulTab,
  equipment_history: EquipmentHistoryTab,
  spare_parts: SparePartsTab,
  report: EntireReportTab,
}

export default function AppShell() {
  const { role, setRole, activeTab, setActiveTab, elevatorId, setElevatorId, wsStatus, connectWebSocket, fetchState, tick } = useAnodos()
  const [collapsed, setCollapsed] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(true)

  useEffect(() => {
    fetchState()
    connectWebSocket()
    const timer = setInterval(() => {
      tick()
    }, 2000)
    return () => clearInterval(timer)
  }, [connectWebSocket, fetchState, tick])

  const handleLogin = (selectedRole: UserRole) => {
    setRole(selectedRole)
    setIsAuthenticated(true)
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />
  }

  const CurrentView = VIEW_MAP[activeTab] || Overview

  return (
    <div className="min-h-screen bg-bg text-ink flex font-sans relative">
      {/* FIXED FULL-HEIGHT LEFT SLIDE SIDEBAR */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col border-r border-line/70 bg-surface/95 backdrop-blur-xl transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Sidebar Top Brand & Collapse Toggle */}
        <div className="flex h-16 items-center justify-between px-3 border-b border-line/50 shrink-0">
          {!collapsed ? (
            <div className="flex items-center gap-2 overflow-hidden px-1">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-onbrand shadow">
                <Activity size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-extrabold tracking-widest text-ink leading-none">ANODOS</span>
                <span className="text-[9px] font-bold text-muted tracking-wider uppercase">{role} PORTAL</span>
              </div>
            </div>
          ) : (
            <div className="mx-auto grid h-8 w-8 place-items-center rounded-lg bg-brand text-onbrand shadow">
              <Activity size={18} />
            </div>
          )}

          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-ink transition border border-line/40"
              title="Collapse sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Collapsed Toggle Button Row (Centered in 16w mode) */}
        {collapsed && (
          <div className="flex justify-center py-2 border-b border-line/40 shrink-0">
            <button
              onClick={() => setCollapsed(false)}
              className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-ink transition border border-line/40"
              title="Expand sidebar"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Sidebar Vertical Tabs Navigation */}
        <nav className="flex-1 space-y-4 p-2 overflow-y-auto" role="tablist">
          {role === 'manager' ? (
            <div className="space-y-1">
              {MANAGER_TABS.map(({ id, label, icon: Icon }) => {
                const active = id === activeTab
                return (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(id as TabId)}
                    title={collapsed ? label : undefined}
                    className={`group relative flex w-full items-center rounded-xl py-2.5 text-xs font-bold transition-all ${
                      collapsed ? 'justify-center px-0' : 'gap-3 px-3'
                    } ${
                      active
                        ? 'bg-accent/15 text-accent border border-accent/40 shadow-sm'
                        : 'text-muted hover:bg-raised hover:text-ink border border-transparent'
                    }`}
                  >
                    <Icon size={18} className={`shrink-0 ${active ? 'text-accent' : 'text-muted group-hover:text-ink'}`} />
                    {!collapsed && <span className="truncate">{label}</span>}
                    {active && !collapsed && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            TECHNICIAN_GROUPS.map((grp) => (
              <div key={grp.group} className="space-y-1">
                {!collapsed && (
                  <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-muted/80 block mb-1">
                    {grp.group}
                  </span>
                )}
                {grp.tabs.map(({ id, label, icon: Icon }) => {
                  const active = id === activeTab
                  return (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveTab(id as TabId)}
                      title={collapsed ? label : undefined}
                      className={`group relative flex w-full items-center rounded-xl py-2 text-xs font-bold transition-all ${
                        collapsed ? 'justify-center px-0' : 'gap-3 px-3'
                      } ${
                        active
                          ? 'bg-brand/15 text-brand border border-brand/40 shadow-sm'
                          : 'text-muted hover:bg-raised hover:text-ink border border-transparent'
                      }`}
                    >
                      <Icon size={17} className={`shrink-0 ${active ? 'text-brand' : 'text-muted group-hover:text-ink'}`} />
                      {!collapsed && <span className="truncate">{label}</span>}
                      {active && !collapsed && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </nav>

        {/* Sidebar Footer Role & Unit Info */}
        {!collapsed && (
          <div className="p-3 border-t border-line/50 text-[11px] text-muted font-medium flex items-center justify-between shrink-0 bg-raised/30">
            <div>
              Elevator: <strong className="text-ink font-bold">{elevatorId}</strong>
            </div>
            <button
              onClick={() => setIsAuthenticated(false)}
              className="text-[10px] font-bold text-accent hover:underline flex items-center gap-1"
            >
              <LogOut size={12} /> Logout
            </button>
          </div>
        )}
      </aside>

      {/* MAIN CONTENT AREA WITH PADDING TO MATCH FIXED SIDEBAR */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'pl-16' : 'pl-64'}`}>
        {/* TOP HEADER */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line/70 bg-surface/85 px-4 backdrop-blur-xl sm:px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="md:hidden rounded-lg p-1.5 text-muted hover:bg-raised hover:text-ink"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-sm font-bold tracking-tight text-ink uppercase">
              {activeTab.replace(/_/g, ' ')}
            </h2>
          </div>

          {/* Connection Status, Elevator Selector & Role Login Button */}
          <div className="flex items-center gap-3">
            {/* Elevator Unit Selector */}
            <div className="flex items-center gap-1.5 bg-raised px-2.5 py-1 rounded-lg border border-line/60 text-xs font-bold">
              <span className="text-[10px] text-muted uppercase">Unit:</span>
              {['E001', 'E002', 'E003'].map((id) => (
                <button
                  key={id}
                  onClick={() => setElevatorId(id)}
                  className={`px-2 py-0.5 rounded text-xs transition ${
                    elevatorId === id ? 'bg-brand text-onbrand font-extrabold shadow-sm' : 'text-muted hover:text-ink'
                  }`}
                >
                  {id}
                </button>
              ))}
            </div>

            {/* Connection Status */}
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                wsStatus === 'LIVE'
                  ? 'border-ok/40 bg-ok/10 text-ok'
                  : wsStatus === 'RECONNECTING'
                  ? 'border-warn/40 bg-warn/10 text-warn animate-pulse'
                  : 'border-line/60 bg-raised text-muted'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  wsStatus === 'LIVE' ? 'bg-ok' : wsStatus === 'RECONNECTING' ? 'bg-warn animate-ping' : 'bg-muted'
                }`}
              />
              ● {wsStatus}
            </span>

            {/* Role Switcher Pill Button */}
            <button
              onClick={() => setIsAuthenticated(false)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold transition shadow-sm ${
                role === 'manager'
                  ? 'bg-brand/15 text-brand border-brand/40 hover:bg-brand/25'
                  : 'bg-accent/15 text-accent border-accent/40 hover:bg-accent/25'
              }`}
            >
              {role === 'manager' ? <UserCheck size={14} /> : <Wrench size={14} />}
              <span className="uppercase">{role} PORTAL</span>
            </button>

            <ThemeToggle />
          </div>
        </header>

        {/* MAIN TAB VIEW */}
        <main className="w-full max-w-7xl mx-auto px-4 py-6 sm:px-6 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${role}-${activeTab}-${elevatorId}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
            >
              <CurrentView />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
