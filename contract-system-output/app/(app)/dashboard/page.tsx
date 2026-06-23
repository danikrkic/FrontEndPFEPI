"use client"

/**
 * HU012 — Tablero de Control (semáforo de avance, Residente)
 * HU013 — Visualizar Curva S (Residente / Supervisión)
 * HU014 — Consultar Curva S para seguimiento institucional (Dependencia)
 * HU019 — Consultar indicadores del contrato (Residente / Dependencia / Supervisión)
 *
 * Cambios respecto al original:
 *  - HU014: Dependencia ahora tiene acceso a la Curva S (antes solo estaba en dashboard
 *    sin control de rol). El rol "dependencia" puede ver la pestaña de Curva S.
 *  - HU019: Panel de indicadores físico-financiero con desviaciones y alertas,
 *    accesible para residente, dependencia y supervision.
 *  - HU012 CA3: doble clic en un contrato del semáforo navega a su detalle.
 *  - HU013 CA2: el avance real se calcula de estimaciones aprobadas (ya en store/types).
 */

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { CurvaSChart } from "@/components/curva-s-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ContractSelector } from "@/components/contract-selector"
import { StatusBadge } from "@/components/status-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatMoneyFull, formatDate } from "@/lib/format"
import type { Contract } from "@/lib/types"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

// ── Roles que pueden ver el panel de indicadores / curva S (HU013, HU014, HU019)
const ROLES_INDICADORES = ["residente", "dependencia", "supervision"]

type Semaforo = "verde" | "amarillo" | "rojo"

function getSemaforo(c: Contract): Semaforo {
  const desfase = c.avanceProgramado - c.avanceReal
  if (desfase <= 3) return "verde"
  if (desfase <= 10) return "amarillo"
  return "rojo"
}

const SEMAFORO_STYLES: Record<
  Semaforo,
  { dot: string; label: string; text: string }
> = {
  verde: { dot: "bg-emerald-500", label: "En tiempo", text: "text-emerald-700" },
  amarillo: { dot: "bg-amber-500", label: "En riesgo", text: "text-amber-700" },
  rojo: { dot: "bg-red-500", label: "Atrasado", text: "text-red-700" },
}

export default function DashboardPage() {
  const { contracts, user } = useApp()
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string>(contracts[0]?.id ?? "")
  const selected = contracts.find((c) => c.id === selectedId) ?? contracts[0]

  const puedeVerIndicadores =
    user?.role && ROLES_INDICADORES.includes(user.role)

  const stats = useMemo(() => {
    const total = contracts.length
    const montoTotal = contracts.reduce((s, c) => s + c.monto, 0)
    const enRiesgo = contracts.filter((c) => getSemaforo(c) !== "verde").length
    const avancePromedio =
      total > 0
        ? Math.round(contracts.reduce((s, c) => s + c.avanceReal, 0) / total)
        : 0
    return { total, montoTotal, enRiesgo, avancePromedio }
  }, [contracts])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tablero de Control"
        subtitle="Seguimiento físico-financiero, semáforo de avance y curva S por contrato"
      />

      {/* KPIs globales (HU012) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<TrendingUp className="size-5" />}
          label="Contratos"
          value={String(stats.total)}
        />
        <StatCard
          icon={<CheckCircle2 className="size-5" />}
          label="Monto en cartera"
          value={formatMoneyFull(stats.montoTotal)}
        />
        <StatCard
          icon={<AlertTriangle className="size-5" />}
          label="En riesgo / atraso"
          value={String(stats.enRiesgo)}
        />
        <StatCard
          icon={<Clock className="size-5" />}
          label="Avance promedio"
          value={`${stats.avancePromedio}%`}
        />
      </div>

      {/* Semáforo (HU012) — doble clic navega al detalle (HU012 CA3) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Semáforo de avance por contrato</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {contracts.map((c) => {
            const sem = getSemaforo(c)
            const style = SEMAFORO_STYLES[sem]
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                onDoubleClick={() => router.push(`/contratos/${c.id}`)}
                title="Clic para seleccionar · Doble clic para ver detalle"
                className={`flex flex-col gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between ${
                  selectedId === c.id
                    ? "border-primary ring-1 ring-primary/30"
                    : "border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`size-3 shrink-0 rounded-full ${style.dot}`}
                    aria-hidden
                  />
                  <div>
                    <p className="font-medium">{c.noContrato}</p>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {c.objeto}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="w-40">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Real {c.avanceReal}%</span>
                      <span>Prog. {c.avanceProgramado}%</span>
                    </div>
                    <Progress value={c.avanceReal} className="h-2" />
                  </div>
                  <span className={`w-20 text-sm font-medium ${style.text}`}>
                    {style.label}
                  </span>
                </div>
              </button>
            )
          })}
        </CardContent>
      </Card>

      {/* Panel por contrato seleccionado: Curva S + Indicadores */}
      {selected && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base">{selected.noContrato}</CardTitle>
              <StatusBadge status={selected.status} />
            </div>
            <ContractSelector
              value={selectedId}
              onChange={setSelectedId}
              className="w-full sm:w-72"
            />
          </CardHeader>
          <CardContent>
            {puedeVerIndicadores ? (
              // HU013 / HU014 / HU019: tabs con curva S e indicadores
              <Tabs defaultValue="curvs">
                <TabsList className="mb-4">
                  <TabsTrigger value="curvs">Curva S</TabsTrigger>
                  <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
                </TabsList>

                {/* HU013 / HU014 — Curva S */}
                <TabsContent value="curvs">
                  <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Metric
                      label="Monto vigente"
                      value={formatMoneyFull(selected.monto)}
                    />
                    <Metric
                      label="Término"
                      value={formatDate(selected.fechaTermino)}
                    />
                    <Metric
                      label="Avance programado"
                      value={`${selected.avanceProgramado}%`}
                    />
                    <Metric
                      label="Avance real"
                      value={`${selected.avanceReal}%`}
                    />
                  </div>
                  <CurvaSChart contract={selected} />
                  <p className="mt-2 text-xs text-muted-foreground text-center">
                    El avance real se calcula a partir de las estimaciones aprobadas
                    registradas en el sistema.
                  </p>
                </TabsContent>

                {/* HU019 — Panel de indicadores */}
                <TabsContent value="indicadores">
                  <IndicadoresPanel contract={selected} />
                </TabsContent>
              </Tabs>
            ) : (
              // Para roles sin acceso a indicadores, solo métricas básicas
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Metric
                    label="Monto vigente"
                    value={formatMoneyFull(selected.monto)}
                  />
                  <Metric label="Término" value={formatDate(selected.fechaTermino)} />
                  <Metric
                    label="Avance programado"
                    value={`${selected.avanceProgramado}%`}
                  />
                  <Metric label="Avance real" value={`${selected.avanceReal}%`} />
                </div>
                <CurvaSChart contract={selected} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── IndicadoresPanel (HU019) ──────────────────────────────────────────────────

function IndicadoresPanel({ contract }: { contract: Contract }) {
  const { estimaciones } = useApp()

  const acumulado = useMemo(
    () =>
      estimaciones
        .filter((e) => e.contratoId === contract.id && e.status === "aceptada")
        .reduce((s, e) => s + e.importeNeto, 0),
    [estimaciones, contract.id],
  )

  const avanceFisico = contract.avanceReal
  const avanceProgramado = contract.avanceProgramado
  const avanceFinanciero = Math.round(
    (acumulado / Math.max(contract.monto, 1)) * 100,
  )
  const desfaseFisico = avanceFisico - avanceProgramado
  const desfaseFinanciero = avanceFisico - avanceFinanciero

  function SemaforoIcon({ value }: { value: number }) {
    if (value >= -3) return <TrendingUp className="size-4 text-emerald-600" />
    if (value >= -10) return <Minus className="size-4 text-amber-500" />
    return <TrendingDown className="size-4 text-red-500" />
  }

  function semClass(value: number) {
    if (value >= -3) return "text-emerald-700"
    if (value >= -10) return "text-amber-600"
    return "text-red-600"
  }

  function semLabel(value: number) {
    if (value >= -3) return "En tiempo"
    if (value >= -10) return "En riesgo"
    return "Atrasado"
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Indicadores principales */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Avance físico real */}
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Avance físico real</p>
            <p className="mt-1 text-xl font-bold text-foreground">{avanceFisico}%</p>
            <Progress value={avanceFisico} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        {/* Avance físico programado */}
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Avance físico programado</p>
            <p className="mt-1 text-xl font-bold text-foreground">{avanceProgramado}%</p>
            <Progress value={avanceProgramado} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        {/* Avance financiero */}
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Avance financiero</p>
            <p className="mt-1 text-xl font-bold text-foreground">{avanceFinanciero}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatMoneyFull(acumulado)} / {formatMoneyFull(contract.monto)}
            </p>
          </CardContent>
        </Card>

        {/* Alerta de desviación física */}
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Estado general</p>
            <p className={`mt-1 text-xl font-bold ${semClass(desfaseFisico)}`}>
              {semLabel(desfaseFisico)}
            </p>
            <p className={`text-xs mt-0.5 ${semClass(desfaseFisico)}`}>
              Desfase: {desfaseFisico > 0 ? "+" : ""}{desfaseFisico}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de desviaciones (HU019 CA1 alertas) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Alertas de desviación</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pb-4">
          <DesviaciónRow
            label="Avance físico vs. programado"
            value={desfaseFisico}
            desc={`Real ${avanceFisico}% — Prog. ${avanceProgramado}%`}
          />
          <DesviaciónRow
            label="Avance físico vs. financiero"
            value={desfaseFinanciero}
            desc={`Físico ${avanceFisico}% — Financiero ${avanceFinanciero}%`}
          />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Los indicadores se actualizan con base en las estimaciones aprobadas y el
        programa de obra registrado en el sistema.
      </p>
    </div>
  )
}

function DesviaciónRow({
  label,
  value,
  desc,
}: {
  label: string
  value: number
  desc: string
}) {
  const isOk = value >= -3
  const isWarn = value < -3 && value >= -10
  const isAlert = value < -10

  const rowClass = isAlert
    ? "border-red-200 bg-red-50"
    : isWarn
    ? "border-amber-200 bg-amber-50"
    : "border-emerald-200 bg-emerald-50"

  const textClass = isAlert
    ? "text-red-700"
    : isWarn
    ? "text-amber-700"
    : "text-emerald-700"

  const Icon = isAlert ? TrendingDown : isWarn ? Minus : TrendingUp

  return (
    <div
      className={`flex items-center justify-between rounded-md border px-3 py-2.5 ${rowClass}`}
    >
      <div>
        <p className={`text-sm font-medium ${textClass}`}>{label}</p>
        <p className={`text-xs ${textClass} opacity-80`}>{desc}</p>
      </div>
      <div className={`flex items-center gap-1.5 ${textClass}`}>
        <Icon className="size-4" />
        <span className="text-sm font-semibold">
          {value > 0 ? "+" : ""}
          {value}%
        </span>
      </div>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}
