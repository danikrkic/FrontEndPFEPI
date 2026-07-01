"use client"

import { useRef, useState } from "react"
import { Camera, CheckCircle2, ClipboardList, XCircle } from "lucide-react"
import type { Contract, ReporteAvanceConcepto } from "@/lib/types"
import { REPORTE_AVANCE_STATUS_LABELS } from "@/lib/types"
import { useApp, can } from "@/lib/store"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

const STATUS_BADGE: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  validado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  rechazado: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
}

export function ReportesAvancePanel({ contract }: { contract: Contract }) {
  const { user } = useApp()
  const reportes = contract.reportesAvance

  const puedeRegistrar = can(user?.role, "avance_concepto.registrar")
  const puedeValidar = can(user?.role, "avance_concepto.validar")

  const pendientes = reportes.filter((r) => r.status === "pendiente")
  const historial = [...reportes].sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion))

  // Un reporte rechazado ya fue corregido si otro reporte lo referencia como reporteAnteriorId.
  const idsConCorreccion = new Set(
    reportes.filter((r) => r.reporteAnteriorId).map((r) => r.reporteAnteriorId as string),
  )

  const conceptosDisponibles = contract.catalogoConceptos.filter((c) => c.estado !== "terminado")

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4" />
            Reportes de avance por concepto
          </CardTitle>
          {puedeRegistrar && (
            <ReporteAvanceDialog
              contract={contract}
              conceptos={conceptosDisponibles}
              trigger={<Button size="sm">Registrar reporte</Button>}
            />
          )}
        </CardHeader>
        <CardContent>
          {!puedeRegistrar && !puedeValidar && reportes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aún no hay reportes de avance registrados para este contrato.
            </p>
          )}

          {puedeValidar && (
            <div className="mb-6">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <ClipboardList className="h-4 w-4" />
                Pendientes de validación ({pendientes.length})
              </h3>
              {pendientes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay reportes pendientes.</p>
              ) : (
                <div className="space-y-3">
                  {pendientes.map((r) => (
                    <ReporteCard key={r.id} contract={contract} reporte={r} puedeValidar />
                  ))}
                </div>
              )}
            </div>
          )}

          {historial.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">Historial</h3>
              <div className="space-y-3">
                {historial
                  .filter((r) => !(puedeValidar && r.status === "pendiente"))
                  .map((r) => (
                    <ReporteCard
                      key={r.id}
                      contract={contract}
                      reporte={r}
                      puedeCorregir={
                        puedeRegistrar &&
                        r.status === "rechazado" &&
                        r.creadoPor === user?.name &&
                        !idsConCorreccion.has(r.id)
                      }
                    />
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ReporteCard({
  contract,
  reporte,
  puedeValidar,
  puedeCorregir,
}: {
  contract: Contract
  reporte: ReporteAvanceConcepto
  puedeValidar?: boolean
  puedeCorregir?: boolean
}) {
  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{reporte.concepto.clave}</span>
          <span className="text-xs text-muted-foreground">{reporte.concepto.descripcion}</span>
        </div>
        <Badge variant="secondary" className={`text-[11px] ${STATUS_BADGE[reporte.status] ?? ""}`}>
          {REPORTE_AVANCE_STATUS_LABELS[reporte.status]}
        </Badge>
      </div>
      <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <p>Fecha: {formatDate(reporte.fecha)}</p>
        <p>
          Cantidad: {reporte.cantidad} {reporte.concepto.unidad}
        </p>
        <p>Frente / ubicación: {reporte.frenteUbicacion}</p>
        <p>Registrado por: {reporte.creadoPor}</p>
      </div>
      <a
        href={reporte.fotografia}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block h-16 w-16 overflow-hidden rounded-md border border-border"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={reporte.fotografia}
          alt={`Evidencia del reporte de ${reporte.concepto.clave}`}
          className="h-full w-full object-cover"
        />
      </a>
      {reporte.observaciones && (
        <p className="mt-2 rounded-md bg-muted/40 p-2 text-xs italic text-muted-foreground">
          Observaciones: {reporte.observaciones}
        </p>
      )}
      {puedeValidar && <ValidarReporteActions reporte={reporte} contract={contract} />}
      {puedeCorregir && (
        <div className="mt-3">
          <ReporteAvanceDialog
            contract={contract}
            conceptos={[reporte.concepto]}
            reporteAnterior={reporte}
            trigger={
              <Button size="sm" variant="outline">
                Corregir y reenviar
              </Button>
            }
          />
        </div>
      )}
    </div>
  )
}

function ValidarReporteActions({
  reporte,
  contract,
}: {
  reporte: ReporteAvanceConcepto
  contract: Contract
}) {
  const { revisarReporteAvance } = useApp()
  const [loading, setLoading] = useState<"validado" | "rechazado" | null>(null)
  const [rechazoOpen, setRechazoOpen] = useState(false)
  const [observaciones, setObservaciones] = useState("")

  async function handleValidar() {
    setLoading("validado")
    try {
      const resp = await revisarReporteAvance(contract.id, reporte.id, "validado", "")
      toast.success(
        resp.conceptoTerminado
          ? `Reporte validado. El concepto ${reporte.concepto.clave} quedó Terminado.`
          : "Reporte validado correctamente.",
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo validar el reporte.")
    } finally {
      setLoading(null)
    }
  }

  async function handleRechazar() {
    if (!observaciones.trim()) {
      toast.error("Debe registrar observaciones para rechazar el reporte.")
      return
    }
    setLoading("rechazado")
    try {
      await revisarReporteAvance(contract.id, reporte.id, "rechazado", observaciones)
      toast.success("Reporte rechazado.")
      setRechazoOpen(false)
      setObservaciones("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo rechazar el reporte.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mt-3 flex gap-2">
      <Button size="sm" disabled={loading !== null} onClick={handleValidar}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        {loading === "validado" ? "Validando…" : "Aceptar"}
      </Button>
      <Dialog open={rechazoOpen} onOpenChange={setRechazoOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" disabled={loading !== null}>
            <XCircle className="h-3.5 w-3.5" />
            Rechazar
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar reporte de avance</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Observaciones</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={4}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRechazoOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={loading !== null} onClick={handleRechazar}>
              {loading === "rechazado" ? "Guardando…" : "Rechazar reporte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReporteAvanceDialog({
  contract,
  conceptos,
  reporteAnterior,
  trigger,
}: {
  contract: Contract
  conceptos: Contract["catalogoConceptos"]
  reporteAnterior?: ReporteAvanceConcepto
  trigger: React.ReactNode
}) {
  const { registrarReporteAvance } = useApp()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [conceptoId, setConceptoId] = useState(reporteAnterior?.conceptoId ?? conceptos[0]?.id ?? "")
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])
  const [cantidad, setCantidad] = useState(reporteAnterior ? String(reporteAnterior.cantidad) : "")
  const [frenteUbicacion, setFrenteUbicacion] = useState(reporteAnterior?.frenteUbicacion ?? "")
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fotografia = fileRef.current?.files?.[0]
    if (!fotografia) {
      toast.error("Debe adjuntar una fotografía de evidencia.")
      return
    }
    if (!conceptoId) {
      toast.error("Seleccione un concepto.")
      return
    }
    setLoading(true)
    try {
      await registrarReporteAvance(
        contract.id,
        {
          conceptoId,
          fecha,
          cantidad: Number(cantidad),
          frenteUbicacion,
          reporteAnteriorId: reporteAnterior?.id,
        },
        fotografia,
      )
      toast.success("Reporte de avance registrado y enviado a validación.")
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar el reporte.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {reporteAnterior ? "Corregir y reenviar reporte" : "Registrar reporte de avance"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Concepto</Label>
            <Select
              value={conceptoId}
              onValueChange={(v) => v && setConceptoId(v)}
              disabled={!!reporteAnterior}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un concepto" />
              </SelectTrigger>
              <SelectContent>
                {conceptos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.clave} — {c.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Fecha</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Cantidad ejecutada</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Frente de trabajo / ubicación</Label>
            <Input
              value={frenteUbicacion}
              onChange={(e) => setFrenteUbicacion(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Fotografía de evidencia</Label>
            <Input type="file" accept="image/*" ref={fileRef} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Enviando…" : "Enviar a validación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
