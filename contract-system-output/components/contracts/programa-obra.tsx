"use client"

import { useMemo, useState } from "react"
import {
  BarChart2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Save,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import type { Contract, ConceptoPrograma } from "@/lib/types"
import { useApp, can } from "@/lib/store"
import { formatCurrency } from "@/lib/format"
import { CatalogoTable } from "@/components/contracts/catalogo-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { toast } from "sonner"

// ── helpers ───────────────────────────────────────────────────────────────────

function getSemanasContrato(fechaInicio: string, fechaTermino: string): number {
  const inicio = new Date(fechaInicio)
  const termino = new Date(fechaTermino)
  const diffMs = termino.getTime() - inicio.getTime()
  return Math.max(1, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)))
}

const PAGE_SIZE = 8

export function ProgramaObra({ contract }: { contract: Contract }) {
  const { user, programasObra, setProgramaObra, estimaciones } = useApp()
  const puedeEditar = can(user?.role, "detalle.registrar")

  const totalSemanas = getSemanasContrato(contract.fechaInicio, contract.fechaTermino)
  const semanas = Array.from({ length: totalSemanas }, (_, i) => i + 1)

  const programa = programasObra.find((p) => p.contratoId === contract.id)

  // Estado local del Gantt (copia editable) — almacena cantidades por semana
  const [draft, setDraft] = useState<ConceptoPrograma[]>(() => {
    if (programa) return JSON.parse(JSON.stringify(programa.conceptos))
    return contract.catalogoConceptos.map((c) => ({
      conceptoId: c.id,
      semanas: [],
    }))
  })

  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(totalSemanas / PAGE_SIZE)
  const semanasVisible = semanas.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // ── draft helpers (trabajando con cantidad, no monto) ─────────────────────

  function getCantidadSemana(conceptoId: string, semana: number): string {
    const cp = draft.find((d) => d.conceptoId === conceptoId)
    const sw = cp?.semanas.find((s) => s.semana === semana)
    return sw ? String(sw.cantidad) : ""
  }

  function setCantidadSemana(conceptoId: string, semana: number, value: string) {
    setDraft((prev) =>
      prev.map((cp) => {
        if (cp.conceptoId !== conceptoId) return cp
        const cantidad = parseFloat(value) || 0
        const exists = cp.semanas.find((s) => s.semana === semana)
        const newSemanas = exists
          ? cp.semanas.map((s) =>
              s.semana === semana ? { ...s, cantidad } : s,
            )
          : [...cp.semanas, { semana, cantidad }]
        return { ...cp, semanas: newSemanas.filter((s) => s.cantidad > 0) }
      }),
    )
  }

  /** Cantidad total asignada en el programa para un concepto */
  function cantidadAsignada(conceptoId: string): number {
    const cp = draft.find((d) => d.conceptoId === conceptoId)
    return cp?.semanas.reduce((a, s) => a + s.cantidad, 0) ?? 0
  }

  /** Monto programado total para un concepto (cantidad × precio unitario) */
  function montoConcepto(conceptoId: string): number {
    const concepto = contract.catalogoConceptos.find((c) => c.id === conceptoId)
    if (!concepto) return 0
    return cantidadAsignada(conceptoId) * concepto.precioUnitario
  }

  /** Monto programado de un concepto en una semana específica */
  function montoSemana(conceptoId: string, semana: number): number {
    const concepto = contract.catalogoConceptos.find((c) => c.id === conceptoId)
    if (!concepto) return 0
    const cp = draft.find((d) => d.conceptoId === conceptoId)
    const sw = cp?.semanas.find((s) => s.semana === semana)
    return (sw?.cantidad ?? 0) * concepto.precioUnitario
  }

  function cantidadRestante(conceptoId: string): number {
    const concepto = contract.catalogoConceptos.find((c) => c.id === conceptoId)
    if (!concepto) return 0
    return concepto.cantidad - cantidadAsignada(conceptoId)
  }

  const [guardando, setGuardando] = useState(false)

  async function handleGuardar() {
    setGuardando(true)
    try {
      await setProgramaObra(contract.id, draft)
      toast.success("Programa de obra guardado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el programa")
    } finally {
      setGuardando(false)
    }
  }

  // ── Curva S ────────────────────────────────────────────────────────────────

  const curvaData = useMemo(() => {
    const montoContrato = contract.monto || 1

    // Monto programado por semana derivado de cantidades × precioUnitario
    const programadoPorSemana: Record<number, number> = {}
    draft.forEach((cp) => {
      const concepto = contract.catalogoConceptos.find((c) => c.id === cp.conceptoId)
      if (!concepto) return
      cp.semanas.forEach(({ semana, cantidad }) => {
        const monto = cantidad * concepto.precioUnitario
        programadoPorSemana[semana] = (programadoPorSemana[semana] ?? 0) + monto
      })
    })

    // Real acumulado desde estimaciones aprobadas
    const estimAprobadas = estimaciones.filter(
      (e) => e.contratoId === contract.id && e.status === "aceptada",
    )
    const realPorSemana: Record<number, number> = {}
    estimAprobadas.forEach((e) => {
      const inicio = new Date(contract.fechaInicio)
      const periodoInicio = new Date(e.periodoInicio)
      const diffDias = Math.floor(
        (periodoInicio.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24),
      )
      const semana = Math.max(1, Math.ceil(diffDias / 7))
      realPorSemana[semana] = (realPorSemana[semana] ?? 0) + e.importeNeto
    })

    let acumProgramado = 0
    let acumReal = 0

    return semanas.map((s) => {
      acumProgramado += programadoPorSemana[s] ?? 0
      acumReal += realPorSemana[s] ?? 0
      return {
        semana: `S${s}`,
        Programado: parseFloat(((acumProgramado / montoContrato) * 100).toFixed(2)),
        Real: parseFloat(((acumReal / montoContrato) * 100).toFixed(2)),
      }
    })
  }, [draft, estimaciones, contract, semanas])

  const sinConceptos = contract.catalogoConceptos.length === 0

  if (sinConceptos) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">Sin catálogo de conceptos</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Primero debes registrar el catálogo de conceptos del contrato para
            poder generar el programa de obra.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Tabs defaultValue="gantt">
      <div className="mb-4 flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="gantt">
            <CalendarDays className="mr-2 h-4 w-4" />
            Gantt
          </TabsTrigger>
          <TabsTrigger value="curvas">
            <BarChart2 className="mr-2 h-4 w-4" />
            Curva S
          </TabsTrigger>
          <TabsTrigger value="catalogo">
            Catálogo
          </TabsTrigger>
        </TabsList>
        {puedeEditar && (
          <Button size="sm" onClick={handleGuardar} disabled={guardando}>
            <Save className="h-4 w-4" />
            {guardando ? "Guardando..." : "Guardar programa"}
          </Button>
        )}
      </div>

      {/* ── GANTT ──────────────────────────────────────────────────────── */}
      <TabsContent value="gantt">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">
                Distribución semanal por concepto
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Captura la cantidad a ejecutar por semana; el monto se calcula
                automáticamente con el precio unitario del catálogo.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                Sem. {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, totalSemanas)} / {totalSemanas}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="sticky left-0 z-10 min-w-[180px] bg-muted/80 px-4 py-2 text-left font-medium">
                    Concepto
                  </th>
                  <th className="min-w-[80px] px-3 py-2 text-center font-medium">
                    Unidad
                  </th>
                  <th className="min-w-[90px] px-3 py-2 text-right font-medium">
                    Total cant.
                  </th>
                  <th className="min-w-[90px] px-3 py-2 text-right font-medium text-green-700 dark:text-green-400">
                    Asignado
                  </th>
                  <th className="min-w-[90px] px-3 py-2 text-right font-medium text-orange-600 dark:text-orange-400">
                    Restante
                  </th>
                  <th className="min-w-[100px] px-3 py-2 text-right font-medium text-blue-700 dark:text-blue-400">
                    Monto prog.
                  </th>
                  {semanasVisible.map((s) => (
                    <th
                      key={s}
                      className="min-w-[90px] px-2 py-2 text-center font-medium"
                    >
                      S{s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contract.catalogoConceptos.map((c, idx) => {
                  const restante = cantidadRestante(c.id)
                  const asignado = cantidadAsignada(c.id)
                  const monto = montoConcepto(c.id)
                  return (
                    <tr
                      key={c.id}
                      className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}
                    >
                      <td className="sticky left-0 z-10 bg-inherit px-4 py-2">
                        <p className="font-medium leading-none">{c.clave}</p>
                        <p className="mt-0.5 max-w-[160px] truncate text-xs text-muted-foreground">
                          {c.descripcion}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                        {c.unidad}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {c.cantidad.toLocaleString("es-MX")}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          asignado > c.cantidad
                            ? "font-semibold text-destructive"
                            : "text-green-700 dark:text-green-400"
                        }`}
                      >
                        {asignado.toLocaleString("es-MX")}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          restante < 0
                            ? "font-semibold text-destructive"
                            : restante === 0
                              ? "text-muted-foreground"
                              : "text-orange-600 dark:text-orange-400"
                        }`}
                      >
                        {restante < 0 ? "−" : ""}
                        {Math.abs(restante).toLocaleString("es-MX")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-blue-700 dark:text-blue-400">
                        {formatCurrency(monto)}
                      </td>
                      {semanasVisible.map((s) => {
                        const cantStr = getCantidadSemana(c.id, s)
                        const montoS = montoSemana(c.id, s)
                        return (
                          <td key={s} className="px-2 py-1.5">
                            {puedeEditar ? (
                              <div className="flex flex-col gap-0.5">
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  className="h-7 w-24 text-right tabular-nums text-xs"
                                  placeholder="0"
                                  value={cantStr}
                                  onChange={(e) =>
                                    setCantidadSemana(c.id, s, e.target.value)
                                  }
                                />
                                {montoS > 0 && (
                                  <span className="text-right text-[10px] tabular-nums text-muted-foreground">
                                    {formatCurrency(montoS)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="text-right">
                                <span className="block tabular-nums text-xs">
                                  {cantStr ? Number(cantStr).toLocaleString("es-MX") : "—"}
                                </span>
                                {montoS > 0 && (
                                  <span className="block text-[10px] tabular-nums text-muted-foreground">
                                    {formatCurrency(montoS)}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── CURVA S — se genera automáticamente desde el programa ──────── */}
      <TabsContent value="curvas">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Curva S — Avance financiero</CardTitle>
            <p className="text-sm text-muted-foreground">
              Porcentaje acumulado respecto al monto contratado (
              {formatCurrency(contract.monto)}). El avance programado se calcula
              automáticamente a partir de la distribución de cantidades del Gantt.
            </p>
          </CardHeader>
          <CardContent>
            {curvaData.every((d) => d.Programado === 0) ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Captura las cantidades semanales en el Gantt y guarda el programa
                para generar la Curva S programada.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <LineChart
                  data={curvaData}
                  margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="semana"
                    tick={{ fontSize: 11 }}
                    interval={Math.floor(totalSemanas / 10)}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v}%`}
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [
                      typeof value === "number" ? `${value.toFixed(1)}%` : "—",
                      String(name ?? ""),
                    ]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Programado"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    name="Avance programado"
                  />
                  <Line
                    type="monotone"
                    dataKey="Real"
                    stroke="#22c55e"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Avance real"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      {/* Cambio 4: resumen del catálogo usando CatalogoTable en modo "programa" */}
      <TabsContent value="catalogo">
        <Card>
          <CardContent className="pt-4">
            {contract.catalogoConceptos.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay catálogo de conceptos registrado.
              </p>
            ) : (
              <CatalogoTable
                conceptos={contract.catalogoConceptos}
                modo={{ tipo: "programa", periodo: page * PAGE_SIZE + 1 }}
                programados={Object.fromEntries(
                  draft.map((cp) => [
                    cp.conceptoId,
                    cp.semanas.find((s) => s.semana === page * PAGE_SIZE + 1)?.cantidad ?? 0,
                  ]),
                )}
              />
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
