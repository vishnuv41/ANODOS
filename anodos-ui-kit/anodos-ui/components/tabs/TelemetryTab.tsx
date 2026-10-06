'use client'

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAnodos } from '@/store/useAnodos'
import { Empty, Panel, Stat } from '../ui/primitives'

export default function TelemetryTab() {
  const { telemetry: t, stream } = useAnodos()

  const tiles: [string, number, string][] = [
    ['Motor Temp', t.motorTemp, '°C'],
    ['Vibration', t.vibration, 'mm/s'],
    ['Motor Current', t.current, 'A'],
    ['Speed', t.speed, 'm/s'],
    ['Load', t.load, 'kg'],
    ['Brake Force', t.brakeForce, '%'],
    ['Door Cycles', t.doorCycles, ''],
    ['Bearing Temp', t.bearingTemp, '°C'],
    ['Operating Hrs', t.hours, 'h'],
  ]

  const chartData = [...stream].reverse()

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">Live Telemetry</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {tiles.map(([l, v, u]) => (
          <Stat key={l} label={l} value={v} unit={u} />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Sensor Trend (Real-time Stream)">
          {chartData.length === 0 ? (
            <Empty>Waiting for live sensor stream data...</Empty>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="rgb(var(--line))" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="t" tick={{ fill: 'rgb(var(--muted))', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'rgb(var(--muted))', fontSize: 10 }} tickLine={false} axisLine={false} width={34} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgb(var(--surface))',
                      border: '1px solid rgb(var(--line))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line name="Motor Temp (°C)" dataKey="motorTemp" stroke="#FF8800" dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line name="Vibration (mm/s)" dataKey="vibration" stroke="#00C851" dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line name="Motor Current (A)" dataKey="current" stroke="#33B5E5" dot={false} strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Live Sensor Stream">
          {stream.length === 0 ? (
            <Empty>No stream data received yet</Empty>
          ) : (
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-sm tabular-nums">
                <thead className="sticky top-0 bg-surface text-left">
                  <tr className="label border-b border-line/60">
                    <th className="py-2">Time</th>
                    <th>Temp (°C)</th>
                    <th>Vibration</th>
                    <th>Current (A)</th>
                  </tr>
                </thead>
                <tbody>
                  {stream.map((r, i) => (
                    <tr key={i} className="border-t border-line/40 font-mono text-xs">
                      <td className="py-1.5 font-bold text-ink">{r.t}</td>
                      <td className="text-high">{r.motorTemp}°C</td>
                      <td className="text-ok">{r.vibration} mm/s</td>
                      <td className="text-accent">{r.current} A</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
