"use client"

import { Fragment, useMemo, useState, useEffect } from "react"
import {
  AlertCircle,
  BarChart2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Save,
  TableProperties,
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
import type { Contract, ConceptoPrograma, CalendarioMensual } from "@/lib/types"
import { useApp, can } from "@/lib/store"
import { formatCurrency } from "@/lib/format"
import { fetchCalendarioMensual } from "@/lib/api"
import { CatalogoTable } from "@/components/contracts/catalogo-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { toast } from "sonner"

// ── helpers ───────────────────────────────────────────────────────────────────

function getMesesContrato(fechaInicio: string, fechaTermino: string): number {
  const inicio = new Date(fechaInicio)
  const termino = new Date(fechaTermino)
  const diffMs = termino.getTime() - inicio.getTime()
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(1, Math.ceil(diffDias / 30))
}

function getMesDeObra(fechaInicio: string, fecha: string): number {
  const inicio = new Date(fechaInicio + "T00:00:00")
  const f = new Date(fecha + "T00:00:00")
  const diffMs = f.getTime() - inicio.getTime()
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return diffDias >= 0 ? Math.max(1, Math.ceil(diffDias / 30)) : 1
}

const PAGE_SIZE = 12

export function ProgramaObra({ contract }: { contract: Contract }) {
  const { user, programasObra, setProgramaObra, estimaciones } = useApp()
  const puedeEditar = can(user?.role, "detalle.registrar")

  const totalMeses = getMesesContrato(contract.fechaInicio, contract.fechaTermino)
  const meses = Array.from({ length: totalMeses }, (_, i) => i + 1)

  const programa = programasObra.find((p) => p.contratoId === contract.id)

  // Estado local del Gantt (copia editable) — almacena cantidades por mes.
  // Se inicializa desde el catálogo completo y se mezcla con el programa guardado,
  // porque programa.conceptos solo incluye conceptos ya programados (no todos).
  const [draft, setDraft] = useState<ConceptoPrograma[]>(() => {
    const saved = programa?.conceptos ?? []
    return contract.catalogoConceptos.map((c) => {
      const existing = saved.find((s) => s.conceptoId === c.id)
      return existing ? JSON.parse(JSON.stringify(existing)) : { conceptoId: c.id, meses: [] }
    })
  })

  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(totalMeses / PAGE_SIZE)
  const mesesVisible = meses.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // ── draft helpers (trabajando con cantidad, no monto) ─────────────────────

  function getCantidadMes(conceptoId: string, mes: number): string {
    const cp = draft.find((d) => d.conceptoId === conceptoId)
    const mm = cp?.meses.find((m) => m.mes === mes)
    return mm ? String(mm.cantidad) : ""
  }

  function setCantidadMes(conceptoId: string, mes: number, value: string) {
    setDraft((prev) =>
      prev.map((cp) => {
        if (cp.conceptoId !== conceptoId) return cp
        const cantidad = parseFloat(value) || 0
        const exists = cp.meses.find((m) => m.mes === mes)
        const newMeses = exists
          ? cp.meses.map((m) => (m.mes === mes ? { ...m, cantidad } : m))
          : [...cp.meses, { mes, cantidad }]
        return { ...cp, meses: newMeses.filter((m) => m.cantidad > 0) }
      }),
    )
  }

  /** Cantidad total asignada en el programa para un concepto */
  function cantidadAsignada(conceptoId: string): number {
    const cp = draft.find((d) => d.conceptoId === conceptoId)
    return cp?.meses.reduce((a, m) => a + m.cantidad, 0) ?? 0
  }

  /** Monto programado total para un concepto (cantidad × precio unitario) */
  function montoConcepto(conceptoId: string): number {
    const concepto = contract.catalogoConceptos.find((c) => c.id === conceptoId)
    if (!concepto) return 0
    return cantidadAsignada(conceptoId) * concepto.precioUnitario
  }

  /** Monto programado de un concepto en un mes específico */
  function montoMes(conceptoId: string, mes: number): number {
    const concepto = contract.catalogoConceptos.find((c) => c.id === conceptoId)
    if (!concepto) return 0
    const cp = draft.find((d) => d.conceptoId === conceptoId)
    const mm = cp?.meses.find((m) => m.mes === mes)
    return (mm?.cantidad ?? 0) * concepto.precioUnitario
  }

  function cantidadRestante(conceptoId: string): number {
    const concepto = contract.catalogoConceptos.find((c) => c.id === conceptoId)
    if (!concepto) return 0
    return concepto.cantidad - cantidadAsignada(conceptoId)
  }

  const [guardando, setGuardando] = useState(false)
  const [calendario, setCalendario] = useState<CalendarioMensual | null>(null)
  const [loadingCalendario, setLoadingCalendario] = useState(false)
  const [tabActual, setTabActual] = useState("gantt")

  // Cargar calendario mensual cuando se abre esa pestaña
  useEffect(() => {
    if (tabActual !== "calendario") return
    setLoadingCalendario(true)
    fetchCalendarioMensual(contract.id)
      .then((data) => {
        setCalendario({
          meses: data.meses.map((m) => ({
            mes: m.mes,
            fechaInicio: m.fecha_inicio,
            fechaFin: m.fecha_fin,
          })),
          conceptos: data.conceptos.map((c) => ({
            conceptoId: String(c.concepto_id),
            clave: c.clave,
            descripcion: c.descripcion,
            unidad: c.unidad,
            cantidadContratada: c.cantidad_contratada,
            meses: c.meses.map((m) => ({
              mes: m.mes,
              cantidadProgramada: m.cantidad_programada,
              cantidadEjecutada: m.cantidad_ejecutada,
              cantidadAcumulada: m.cantidad_acumulada,
              terminadoEsteMes: m.terminado_este_mes,
            })),
          })),
        })
      })
      .catch(() => toast.error("No se pudo cargar el calendario mensual"))
      .finally(() => setLoadingCalendario(false))
  }, [tabActual, contract.id])

  const conceptosExcedidos = contract.catalogoConceptos.filter(
    (c) => cantidadAsignada(c.id) > c.cantidad,
  )

  const conceptosIncompletos = contract.catalogoConceptos.filter(
    (c) => cantidadAsignada(c.id) < c.cantidad,
  )

  async function handleGuardar() {
    if (conceptosExcedidos.length > 0) {
      toast.error(
        `Cantidad excede lo contratado en: ${conceptosExcedidos.map((c) => c.clave).join(", ")}. ` +
          "Ajusta las cantidades o tramita un convenio modificatorio.",
      )
      return
    }
    setGuardando(true)
    try {
      await setProgramaObra(contract.id, draft)
      if (conceptosIncompletos.length > 0) {
        toast.warning(
          `Programa guardado con cobertura incompleta en: ${conceptosIncompletos.map((c) => c.clave).join(", ")}.`,
          { duration: 6000 },
        )
      } else {
        toast.success("Programa de obra guardado")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el programa")
    } finally {
      setGuardando(false)
    }
  }

  // ── Curva S mensual ─────────────────────────────────────────────────────────

  const curvaMensualData = useMemo(() => {
    const montoContrato = Number(contract.monto) || 1

    // Programado por mes directamente desde el draft mensual
    const programadoPorMes: Record<number, number> = {}
    draft.forEach((cp) => {
      const concepto = contract.catalogoConceptos.find((c) => c.id === cp.conceptoId)
      if (!concepto) return
      cp.meses.forEach(({ mes, cantidad }) => {
        const monto = cantidad * concepto.precioUnitario
        programadoPorMes[mes] = (programadoPorMes[mes] ?? 0) + monto
      })
    })

    // Real por mes desde estimaciones aceptadas
    const estimAprobadas = estimaciones.filter(
      (e) => e.contratoId === contract.id && e.status === "aceptada",
    )
    const realPorMes: Record<number, number> = {}
    estimAprobadas.forEach((e) => {
      const mes = getMesDeObra(contract.fechaInicio, e.periodoInicio)
      realPorMes[mes] = (realPorMes[mes] ?? 0) + e.importeNeto
    })

    const totalMesesCurva = Math.max(
      ...Object.keys(programadoPorMes).map(Number),
      ...Object.keys(realPorMes).map(Number),
      totalMeses,
      1,
    )
    let acumProg = 0
    let acumReal = 0
    return Array.from({ length: totalMesesCurva }, (_, i) => {
      const mes = i + 1
      acumProg += programadoPorMes[mes] ?? 0
      acumReal += realPorMes[mes] ?? 0
      return {
        periodo: `M${mes}`,
        Programado: parseFloat(((acumProg / montoContrato) * 100).toFixed(2)),
        Real: parseFloat(((acumReal / montoContrato) * 100).toFixed(2)),
      }
    })
  }, [draft, estimaciones, contract, totalMeses])

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
    <Tabs defaultValue="gantt" onValueChange={setTabActual}>
      <div className="mb-4 flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="gantt">
            <CalendarDays className="mr-2 h-4 w-4" />
            Gantt
          </TabsTrigger>
          <TabsTrigger value="calendario">
            <TableProperties className="mr-2 h-4 w-4" />
            Calendario
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
          <Button
            size="sm"
            onClick={handleGuardar}
            disabled={guardando || conceptosExcedidos.length > 0}
            title={
              conceptosExcedidos.length > 0
                ? `Cantidad excedida en: ${conceptosExcedidos.map((c) => c.clave).join(", ")}`
                : undefined
            }
          >
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
                Distribución mensual por concepto
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Captura la cantidad a ejecutar por mes; el monto se calcula
                automáticamente con el precio unitario del catálogo.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                Mes {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, totalMeses)} / {totalMeses}
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
          {conceptosIncompletos.length > 0 && (
            <div className="mx-4 mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>{conceptosIncompletos.length} concepto(s)</strong> sin cobertura
                completa:{" "}
                {conceptosIncompletos.map((c) => c.clave).join(", ")}.{" "}
                El programa puede guardarse pero se recomienda distribuir el 100% de cada
                concepto.
              </span>
            </div>
          )}
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
                  {mesesVisible.map((m) => (
                    <th
                      key={m}
                      className="min-w-[90px] px-2 py-2 text-center font-medium"
                    >
                      M{m}
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
                      {mesesVisible.map((m) => {
                        const cantStr = getCantidadMes(c.id, m)
                        const montoM = montoMes(c.id, m)
                        return (
                          <td key={m} className="px-2 py-1.5">
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
                                    setCantidadMes(c.id, m, e.target.value)
                                  }
                                />
                                {montoM > 0 && (
                                  <span className="text-right text-[10px] tabular-nums text-muted-foreground">
                                    {formatCurrency(montoM)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="text-right">
                                <span className="block tabular-nums text-xs">
                                  {cantStr ? Number(cantStr).toLocaleString("es-MX") : "—"}
                                </span>
                                {montoM > 0 && (
                                  <span className="block text-[10px] tabular-nums text-muted-foreground">
                                    {formatCurrency(montoM)}
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

      {/* ── CALENDARIO MENSUAL ──────────────────────────────────────────── */}
      <TabsContent value="calendario">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calendario de obra mensual</CardTitle>
            <p className="text-sm text-muted-foreground">
              Programado vs. ejecutado (estimaciones aceptadas) por mes de obra.
              Un mes de obra equivale a 4 semanas a partir de la fecha de inicio.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {loadingCalendario ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Cargando…</p>
            ) : !calendario || calendario.meses.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Registra el programa de obra y al menos una estimación aceptada para ver el calendario.
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="sticky left-0 z-10 min-w-[160px] bg-muted/80 px-3 py-2 text-left font-medium">
                      Concepto
                    </th>
                    <th className="min-w-[70px] px-2 py-2 text-center font-medium">Unidad</th>
                    <th className="min-w-[90px] px-2 py-2 text-right font-medium">Contratado</th>
                    {calendario.meses.map((m) => (
                      <th
                        key={m.mes}
                        className="min-w-[110px] px-2 py-2 text-center font-medium"
                        colSpan={2}
                      >
                        <div>M{m.mes}</div>
                        {m.fechaInicio && (
                          <div className="text-[10px] font-normal text-muted-foreground">
                            {m.fechaInicio.slice(0, 7)}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="sticky left-0 z-10 bg-muted/50 px-3 py-1" />
                    <th className="px-2 py-1" />
                    <th className="px-2 py-1" />
                    {calendario.meses.map((m) => (
                      <Fragment key={m.mes}>
                        <th className="px-2 py-1 text-right text-[10px] font-normal text-blue-600 dark:text-blue-400">
                          Prog.
                        </th>
                        <th className="px-2 py-1 text-right text-[10px] font-normal text-green-600 dark:text-green-400">
                          Ejec.
                        </th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calendario.conceptos.map((c, idx) => (
                    <tr key={c.conceptoId} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                      <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5">
                        <p className="font-medium leading-none">{c.clave}</p>
                        <p className="mt-0.5 max-w-[150px] truncate text-[10px] text-muted-foreground">
                          {c.descripcion}
                        </p>
                      </td>
                      <td className="px-2 py-1.5 text-center text-muted-foreground">{c.unidad}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {c.cantidadContratada.toLocaleString("es-MX")}
                      </td>
                      {calendario.meses.map((m) => {
                        const mesData = c.meses.find((md) => md.mes === m.mes)
                        return (
                          <Fragment key={m.mes}>
                            <td className="px-2 py-1.5 text-right tabular-nums text-blue-700 dark:text-blue-400">
                              {mesData?.cantidadProgramada
                                ? mesData.cantidadProgramada.toLocaleString("es-MX")
                                : "—"}
                            </td>
                            <td
                              className={`px-2 py-1.5 text-right tabular-nums ${
                                mesData?.terminadoEsteMes
                                  ? "font-semibold text-green-600 dark:text-green-400"
                                  : ""
                              }`}
                            >
                              {mesData?.cantidadEjecutada
                                ? mesData.cantidadEjecutada.toLocaleString("es-MX")
                                : "—"}
                            </td>
                          </Fragment>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── CURVA S — periodos mensuales alineados con calendario ────── */}
      <TabsContent value="curvas">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Curva S — Avance financiero mensual</CardTitle>
            <p className="text-sm text-muted-foreground">
              Porcentaje acumulado respecto al monto contratado (
              {formatCurrency(contract.monto)}). Periodos de 4 semanas, alineados con el calendario mensual.
            </p>
          </CardHeader>
          <CardContent>
            {curvaMensualData.every((d) => d.Programado === 0) ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Captura las cantidades semanales en el Gantt y guarda el programa
                para generar la Curva S programada.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <LineChart
                  data={curvaMensualData}
                  margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="periodo"
                    tick={{ fontSize: 11 }}
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
                    cp.meses.find((m) => m.mes === page * PAGE_SIZE + 1)?.cantidad ?? 0,
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
