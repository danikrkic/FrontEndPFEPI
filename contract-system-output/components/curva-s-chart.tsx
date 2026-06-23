"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { Contract } from "@/lib/types"

// Generate an S-curve dataset from programmed and real progress.
function sCurve(target: number, periods: number) {
  const pts: number[] = []
  for (let i = 0; i <= periods; i++) {
    const x = i / periods
    // logistic-like easing
    const eased = x === 0 ? 0 : x === 1 ? 1 : 1 / (1 + Math.exp(-10 * (x - 0.5)))
    pts.push(Math.round(eased * target))
  }
  return pts
}

export function CurvaSChart({ contract }: { contract: Contract }) {
  const periods = 8
  const prog = sCurve(contract.avanceProgramado, periods)
  const real = sCurve(contract.avanceReal, periods)
  // Real progress only known up to current period
  const currentPeriod = Math.round((contract.avanceReal / Math.max(contract.avanceProgramado, 1)) * periods) || periods

  const data = prog.map((p, i) => ({
    periodo: `P${i}`,
    programado: p,
    real: i <= currentPeriod ? real[i] : null,
  }))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="gProg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gReal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="periodo" stroke="var(--muted-foreground)" fontSize={12} />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={12}
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: unknown) => (v == null ? "—" : `${v}%`)}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="programado"
          name="Avance programado"
          stroke="var(--chart-2)"
          fill="url(#gProg)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="real"
          name="Avance real"
          stroke="var(--chart-1)"
          fill="url(#gReal)"
          strokeWidth={2}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
