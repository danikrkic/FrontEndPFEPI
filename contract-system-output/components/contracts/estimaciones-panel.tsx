"use client"

/**
 * HU009 — Seguimiento de Estimaciones
 * HU007 — Registro de estimación de obra  (NuevaEstimacionDialog)
 * HU008 — Revisión y validación de estimación (ReviewDialog)
 *
 * Cambio 2: desglose financiero completo (bruto, amortización, retención, IVA, neto)
 * Tarjeta de anticipo con barra de progreso.
 */

import { useMemo, useState } from "react"
import { Check, ChevronDown, ChevronUp, FilePlus, X } from "lucide-react"
import type { Contract, Estimacion, EstimacionStatus } from "@/lib/types"
import { useApp, can } from "@/lib/store"
import { calcularDesgloseEstimacion } from "@/lib/calculos"
import { formatDate, formatMoneyFull } from "@/lib/format"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos los estados" },
  { value: "en_revision", label: "En Revisión" },
  { value: "aceptada", label: "Aceptada" },
  { value: "rechazada", label: "Rechazada" },
]

export function EstimacionesPanel({ contract }: { contract: Contract }) {
  const { estimaciones, anticipos, convenios, user } = useApp()

  // Anticipo del contrato
  const anticipo = anticipos.find((a) => a.contratoId === contract.id) ?? null

  // ── HU009: filtros ───────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<string>("todos")
  const [filterDesde, setFilterDesde] = useState<string>("")
  const [filterHasta, setFilterHasta] = useState<string>("")

  const allList = useMemo(
    () =>
      estimaciones
        .filter((e) => e.contratoId === contract.id)
        .sort((a, b) => a.numero - b.numero),
    [estimaciones, contract.id],
  )

  const filtered = useMemo(() => {
    return allList.filter((e) => {
      if (filterStatus !== "todos" && e.status !== filterStatus) return false
      if (filterDesde && e.periodoInicio < filterDesde) return false
      if (filterHasta && e.periodoFin > filterHasta) return false
      return true
    })
  }, [allList, filterStatus, filterDesde, filterHasta])

  // Totales sobre TODO el listado (no filtrado) — avance financiero real (usa importeNeto)
  const acumuladoTotal = useMemo(
    () =>
      allList
        .filter((e) => e.status === "aceptada")
        .reduce((s, e) => s + e.importeNeto, 0),
    [allList],
  )
  const avanceFinanciero = Math.round((acumuladoTotal / Math.max(contract.monto, 1)) * 100)

  // Progreso de amortización del anticipo
  const anticipoAmortizado = anticipo
    ? anticipo.montoOtorgado - anticipo.saldoPendiente
    : 0
  const anticipoPct = anticipo
    ? Math.round((anticipoAmortizado / Math.max(anticipo.montoOtorgado, 1)) * 100)
    : 0

  return (
    <div className="flex flex-col gap-4">
      {/* KPIs financieros */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Monto contratado" value={formatMoneyFull(contract.monto)} />
        <KpiCard
          label="Acumulado estimado (neto aprobado)"
          value={formatMoneyFull(acumuladoTotal)}
        />
        <KpiCard
          label="Avance financiero"
          value={`${avanceFinanciero}%`}
          extra={<Progress value={avanceFinanciero} className="mt-2" />}
        />
      </div>

      {/* Tarjeta de anticipo (Cambio 2) */}
      {anticipo && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Anticipo otorgado</p>
                <p className="text-lg font-bold text-foreground">
                  {formatMoneyFull(anticipo.montoOtorgado)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {anticipo.porcentajeContrato}% del contrato · Entregado el {formatDate(anticipo.fechaEntrega)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Saldo pendiente</p>
                <p className={`text-lg font-bold ${anticipo.saldoPendiente === 0 ? "text-muted-foreground" : "text-foreground"}`}>
                  {formatMoneyFull(anticipo.saldoPendiente)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Amortización por estimación: {anticipo.porcentajeAmortizacion}%
                </p>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Amortizado: {formatMoneyFull(anticipoAmortizado)}</span>
                <span>{anticipoPct}%</span>
              </div>
              <Progress value={anticipoPct} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── HU009: barra de filtros ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Filtrar estimaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 pb-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Estado</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Periodo desde</Label>
            <Input
              type="date"
              value={filterDesde}
              onChange={(e) => setFilterDesde(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Periodo hasta</Label>
            <Input
              type="date"
              value={filterHasta}
              onChange={(e) => setFilterHasta(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          {(filterStatus !== "todos" || filterDesde || filterHasta) && (
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setFilterStatus("todos")
                  setFilterDesde("")
                  setFilterHasta("")
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} de {allList.length} estimación(es)
        </p>
        {can(user?.role, "estimacion.crear") ? (
          <NuevaEstimacionDialog contract={contract} anticipo={anticipo} />
        ) : null}
      </div>

      {/* ── HU009 CA2 + Cambio 5: lista con detalle expandible y separadores de convenio ─ */}
      <div className="flex flex-col gap-3">
        {filtered.map((e, idx) => {
          // Buscar si hay un convenio aprobado entre esta estimación y la anterior
          const prev = idx > 0 ? filtered[idx - 1] : null
          const convenioEntre = prev
            ? convenios.find(
                (cv) =>
                  cv.contratoId === contract.id &&
                  cv.status === "aprobado" &&
                  cv.fechaSolicitud > prev.fechaCreacion &&
                  cv.fechaSolicitud <= e.fechaCreacion,
              )
            : null

          return (
            <div key={e.id}>
              {/* Separador visual de convenio aprobado (Cambio 5) */}
              {convenioEntre && (
                <div className="flex items-center gap-2 my-1">
                  <div className="h-px flex-1 bg-amber-300 dark:bg-amber-700" />
                  <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-3 py-0.5 text-xs font-medium whitespace-nowrap">
                    — Convenio Modificatorio aprobado ({convenioEntre.fechaSolicitud}) —
                  </span>
                  <div className="h-px flex-1 bg-amber-300 dark:bg-amber-700" />
                </div>
              )}
              <EstimacionCard estimacion={e} />
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay estimaciones que coincidan con los filtros seleccionados.
          </p>
        )}
      </div>
    </div>
  )
}

// ── EstimacionCard con desglose financiero (Cambio 2) ─────────────────────────

function EstimacionCard({ estimacion: e }: { estimacion: Estimacion }) {
  const { user, reviewEstimacion } = useApp()
  const [expanded, setExpanded] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  return (
    <Card>
      <CardContent className="py-4">
        {/* Cabecera siempre visible */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                Estimación #{e.numero}
              </span>
              <StatusBadge status={e.status} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Periodo: {formatDate(e.periodoInicio)} — {formatDate(e.periodoFin)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">{formatMoneyFull(e.importeNeto)}</p>
              <p className="text-xs text-muted-foreground">neto · por {e.creadaPor}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Colapsar detalle" : "Ver detalle"}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Detalle expandible */}
        {expanded && (
          <div className="mt-4 border-t border-border pt-4">
            {/* Desglose financiero (Cambio 2) */}
            <div className="mb-4 rounded-md border border-border overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <DesgloseRow label="Importe bruto" value={e.importeBruto} />
                  <DesgloseRow label="(−) Amortización de anticipo" value={-e.amortizacionAnticipo} muted={e.amortizacionAnticipo === 0} />
                  <DesgloseRow label="(−) Retención de garantía (5%)" value={-e.retencionGarantia} />
                  <DesgloseRow label="(+) IVA (16%)" value={e.iva} />
                  <DesgloseRow label="Importe neto a pagar" value={e.importeNeto} bold />
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Carátula" value={e.caratula} />
              <DetailItem label="Números generadores" value={e.numerosGeneradores} />
              <DetailItem
                label="Registro fotográfico"
                value={`${e.registroFotografico} imagen(es)`}
              />
              <DetailItem
                label="Notas de soporte"
                value={`${e.notasSoporte} nota(s)`}
              />
              <DetailItem
                label="Fecha de registro"
                value={formatDate(e.fechaCreacion)}
              />
            </div>

            {e.observaciones && (
              <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                <p className="text-xs font-medium text-amber-800">Observaciones del revisor</p>
                <p className="text-sm text-amber-900 mt-0.5">{e.observaciones}</p>
              </div>
            )}

            {/* HU008: acción de revisión */}
            {e.status === "en_revision" && can(user?.role, "estimacion.revisar") && (
              <div className="mt-3 border-t border-border pt-3">
                <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      Revisar estimación
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Revisión de estimación #{e.numero}</DialogTitle>
                    </DialogHeader>
                    <div className="rounded-md border border-border overflow-hidden mb-2">
                      <table className="w-full text-sm">
                        <tbody>
                          <DesgloseRow label="Importe bruto" value={e.importeBruto} />
                          <DesgloseRow label="(−) Amortización anticipo" value={-e.amortizacionAnticipo} muted={e.amortizacionAnticipo === 0} />
                          <DesgloseRow label="(−) Retención garantía" value={-e.retencionGarantia} />
                          <DesgloseRow label="(+) IVA" value={e.iva} />
                          <DesgloseRow label="Importe neto" value={e.importeNeto} bold />
                        </tbody>
                      </table>
                    </div>
                    <form
                      onSubmit={async (ev) => {
                        ev.preventDefault()
                        const decision = (ev.nativeEvent as SubmitEvent)
                          .submitter as HTMLButtonElement
                        const obs = String(new FormData(ev.currentTarget).get("obs"))
                        const status = decision.value as "aceptada" | "rechazada"
                        try {
                          await reviewEstimacion(e.id, status, obs)
                          toast.success(
                            status === "aceptada"
                              ? "Estimación aceptada. Se generó orden de pago."
                              : "Estimación rechazada.",
                          )
                          setReviewOpen(false)
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "No se pudo revisar la estimación")
                        }
                      }}
                      className="grid gap-3"
                    >
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="obs">Observaciones</Label>
                        <Textarea
                          id="obs"
                          name="obs"
                          rows={3}
                          placeholder="Comentarios de la revisión..."
                        />
                      </div>
                      <DialogFooter className="gap-2 sm:gap-2">
                        <Button
                          type="submit"
                          name="decision"
                          value="rechazada"
                          variant="outline"
                        >
                          <X className="h-4 w-4" />
                          Rechazar
                        </Button>
                        <Button type="submit" name="decision" value="aceptada">
                          <Check className="h-4 w-4" />
                          Aceptar
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DesgloseRow({
  label,
  value,
  bold,
  muted,
}: {
  label: string
  value: number
  bold?: boolean
  muted?: boolean
}) {
  return (
    <tr className={`border-b border-border last:border-0 ${bold ? "bg-muted/50" : ""}`}>
      <td className={`px-3 py-2 text-xs ${muted ? "text-muted-foreground" : "text-foreground"} ${bold ? "font-semibold" : ""}`}>
        {label}
      </td>
      <td className={`px-3 py-2 text-xs text-right tabular-nums ${muted ? "text-muted-foreground" : value < 0 ? "text-red-600" : "text-foreground"} ${bold ? "font-bold" : ""}`}>
        {formatMoneyFull(Math.abs(value))}
      </td>
    </tr>
  )
}

// ── NuevaEstimacionDialog (HU007) con preview de desglose ────────────────────

import type { Anticipo } from "@/lib/types"

function NuevaEstimacionDialog({
  contract,
  anticipo,
}: {
  contract: Contract
  anticipo: Anticipo | null
}) {
  const { addEstimacion } = useApp()
  const [open, setOpen] = useState(false)
  const [importeBruto, setImporteBruto] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const desglose = useMemo(() => {
    const n = parseFloat(importeBruto) || 0
    if (!n) return null
    return calcularDesgloseEstimacion(n, anticipo)
  }, [importeBruto, anticipo])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <FilePlus className="h-4 w-4" />
          Nueva estimación
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar estimación de obra</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            setSubmitting(true)
            try {
              await addEstimacion({
                contratoId: contract.id,
                periodoInicio: String(fd.get("periodoInicio")),
                periodoFin: String(fd.get("periodoFin")),
                importeBruto: Number(fd.get("importeBruto")),
                caratula: String(fd.get("caratula")),
                numerosGeneradores: String(fd.get("generadores")),
                registroFotografico: Number(fd.get("fotos")),
                notasSoporte: Number(fd.get("notas")),
              })
              toast.success("Estimación registrada. Pendiente de revisión.")
              setImporteBruto("")
              setOpen(false)
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "No se pudo registrar la estimación")
            } finally {
              setSubmitting(false)
            }
          }}
          className="grid gap-3"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="caratula">Carátula / descripción</Label>
            <Input id="caratula" name="caratula" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="periodoInicio">Periodo inicio</Label>
              <Input id="periodoInicio" name="periodoInicio" type="date" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="periodoFin">Periodo fin</Label>
              <Input id="periodoFin" name="periodoFin" type="date" required />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="importeBruto">Importe bruto (MXN)</Label>
            <Input
              id="importeBruto"
              name="importeBruto"
              type="number"
              required
              value={importeBruto}
              onChange={(e) => setImporteBruto(e.target.value)}
            />
          </div>

          {/* Preview de desglose (Cambio 2) */}
          {desglose && (
            <div className="rounded-md border border-border overflow-hidden">
              <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">Desglose preliminar</p>
              <table className="w-full text-sm">
                <tbody>
                  <DesgloseRow label="Importe bruto" value={desglose.importeBruto} />
                  {desglose.amortizacionAnticipo > 0 && (
                    <DesgloseRow label="(−) Amortización anticipo" value={-desglose.amortizacionAnticipo} />
                  )}
                  <DesgloseRow label="(−) Retención garantía" value={-desglose.retencionGarantia} />
                  <DesgloseRow label="(+) IVA" value={desglose.iva} />
                  <DesgloseRow label="Importe neto estimado" value={desglose.importeNeto} bold />
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="generadores">Números generadores</Label>
            <Textarea id="generadores" name="generadores" rows={2} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fotos">Registro fotográfico (núm.)</Label>
              <Input id="fotos" name="fotos" type="number" defaultValue={0} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="notas">Notas de soporte (núm.)</Label>
              <Input id="notas" name="notas" type="number" defaultValue={0} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Registrando..." : "Registrar estimación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  extra,
}: {
  label: string
  value: string
  extra?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground">{value}</p>
        {extra}
      </CardContent>
    </Card>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  )
}
