"use client"

/**
 * HU010 — Registrar Solicitud de Convenio Modificatorio (Art. 59 y 60 LOPSRM)
 * HU011 — Revisión de Convenio Modificatorio
 *
 * Cambios respecto al original:
 *  - HU010: Solo se permite solicitar convenio sobre contratos con status "activo"
 *  - HU011: El "Como:" faltaba en el documento → es Dependencia (convenio.revisar)
 *  - HU011 CA4: Al aprobar se genera nueva versión del contrato (ya estaba en store)
 *  - HU011 CA5/CA6: Actualización de monto/plazo (ya estaba en store)
 *  - HU011 CA7: historial de versiones conservado (ContractVersion[], ya en store)
 *  - HU011 CA pendiente: motivo de rechazo obligatorio (ya validado)
 *  - Filtro de vista: pendientes vs historial
 */

import { useMemo, useState } from "react"
import { Check, GitBranch, Plus, X, History } from "lucide-react"
import { useApp, can } from "@/lib/store"
import {
  CONVENIO_TIPO_LABELS,
  type Convenio,
  type ConvenioTipo,
} from "@/lib/types"
import { formatDate, formatMoneyFull } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { ContractSelector } from "@/components/contract-selector"
import { toast } from "sonner"

const TIPOS: ConvenioTipo[] = ["plazo", "monto", "ambos"]

export default function ConveniosPage() {
  const { convenios, contracts, user } = useApp()

  const pendientes = useMemo(
    () => convenios.filter((c) => c.status === "pendiente"),
    [convenios],
  )
  const historial = useMemo(
    () => convenios.filter((c) => c.status !== "pendiente"),
    [convenios],
  )

  return (
    <div>
      <PageHeader
        title="Convenios Modificatorios"
        subtitle="Gestión de modificaciones contractuales (Art. 59 y 60 LOPSRM)"
        action={can(user?.role, "convenio.crear") ? <NuevoConvenioDialog /> : null}
      />

      <Tabs defaultValue="pendientes">
        <TabsList className="mb-4">
          <TabsTrigger value="pendientes">
            Pendientes
            {pendientes.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                {pendientes.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="historial">
            <History className="mr-1.5 h-4 w-4" />
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes">
          <div className="flex flex-col gap-3">
            {pendientes.map((cv) => (
              <ConvenioCard
                key={cv.id}
                convenio={cv}
                noContrato={
                  contracts.find((c) => c.id === cv.contratoId)?.noContrato ?? ""
                }
              />
            ))}
            {pendientes.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  No hay solicitudes pendientes de revisión.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="historial">
          <div className="flex flex-col gap-3">
            {historial.map((cv) => (
              <ConvenioCard
                key={cv.id}
                convenio={cv}
                noContrato={
                  contracts.find((c) => c.id === cv.contratoId)?.noContrato ?? ""
                }
              />
            ))}
            {historial.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  No hay convenios procesados en el historial.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── ConvenioCard ──────────────────────────────────────────────────────────────

function ConvenioCard({
  convenio: cv,
  noContrato,
}: {
  convenio: Convenio
  noContrato: string
}) {
  const { user, reviewConvenio } = useApp()
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{noContrato}</span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {CONVENIO_TIPO_LABELS[cv.tipo]}
              </span>
              <StatusBadge status={cv.status} />
            </div>
            <p className="mt-2 text-sm text-foreground">{cv.justificacion}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {cv.montoAdicional > 0
                ? `Monto adicional: ${formatMoneyFull(cv.montoAdicional)} · `
                : ""}
              {cv.diasAdicionales > 0
                ? `Días adicionales: ${cv.diasAdicionales} · `
                : ""}
              Documentos de soporte: {cv.documentos} · Solicitado por {cv.solicitadoPor} el{" "}
              {formatDate(cv.fechaSolicitud)}
            </p>

            {/* HU011 CA: motivo de rechazo */}
            {cv.status === "rechazado" && cv.motivoRechazo ? (
              <p className="mt-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                <span className="font-medium">Motivo de rechazo:</span> {cv.motivoRechazo}
              </p>
            ) : null}

            {/* HU011 CA4: aviso de nueva versión generada */}
            {cv.status === "aprobado" && (
              <p className="mt-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
                ✓ Aprobado — se generó una nueva versión del contrato con monto/plazo actualizados.
              </p>
            )}
          </div>

          {/* HU011: solo Dependencia puede revisar (convenio.revisar) */}
          {cv.status === "pendiente" && can(user?.role, "convenio.revisar") ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Revisar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Revisión de convenio modificatorio</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const decision = (e.nativeEvent as SubmitEvent)
                      .submitter as HTMLButtonElement
                    const motivo = String(new FormData(e.currentTarget).get("motivo"))
                    const status = decision.value as "aprobado" | "rechazado"
                    if (status === "rechazado" && !motivo.trim()) {
                      toast.error("Debes indicar el motivo de rechazo")
                      return
                    }
                    try {
                      await reviewConvenio(cv.id, status, motivo)
                      toast.success(
                        status === "aprobado"
                          ? "Convenio aprobado. Se generó una nueva versión del contrato."
                          : "Convenio rechazado.",
                      )
                      setOpen(false)
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "No se pudo procesar el convenio")
                    }
                  }}
                  className="grid gap-3"
                >
                  <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                    Al aprobar, se genera una nueva versión del contrato y se actualizan
                    monto y/o plazo conforme a la solicitud (Art. 59-60 LOPSRM).
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="motivo">Justificación / motivo de rechazo</Label>
                    <Textarea
                      id="motivo"
                      name="motivo"
                      rows={3}
                      placeholder="Requerido si se rechaza…"
                    />
                  </div>
                  <DialogFooter className="gap-2 sm:gap-2">
                    <Button type="submit" name="decision" value="rechazado" variant="outline">
                      <X className="h-4 w-4" />
                      Rechazar
                    </Button>
                    <Button type="submit" name="decision" value="aprobado">
                      <Check className="h-4 w-4" />
                      Aprobar
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

// ── NuevoConvenioDialog (HU010) ───────────────────────────────────────────────

function NuevoConvenioDialog() {
  const { contracts, addConvenio } = useApp()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // HU010: solo contratos activos pueden tener convenio
  const contratosActivos = useMemo(
    () => contracts.filter((c) => c.status === "activo"),
    [contracts],
  )

  const [contratoId, setContratoId] = useState(contratosActivos[0]?.id ?? "")
  const [tipo, setTipo] = useState<ConvenioTipo>("plazo")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Solicitar convenio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Nueva solicitud de convenio modificatorio
            </span>
          </DialogTitle>
        </DialogHeader>

        {contratosActivos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay contratos activos disponibles para convenio.
          </p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const documentos = (fd.getAll("documentos") as File[]).filter((f) => f.size > 0)
              setSubmitting(true)
              try {
                await addConvenio(
                  {
                    contratoId,
                    tipo,
                    justificacion: String(fd.get("justificacion")),
                    montoAdicional: tipo === "plazo" ? 0 : Number(fd.get("monto") || 0),
                    diasAdicionales: tipo === "monto" ? 0 : Number(fd.get("dias") || 0),
                    // Cambio 5: alcance del convenio (por defecto ajuste_monto_simple)
                    alcance: "ajuste_monto_simple",
                  },
                  documentos.length > 0 ? documentos : undefined,
                )
                toast.success("Solicitud de convenio modificatorio registrada")
                setOpen(false)
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "No se pudo registrar la solicitud")
              } finally {
                setSubmitting(false)
              }
            }}
            className="grid gap-3"
          >
            <div className="flex flex-col gap-2">
              <Label>Contrato (solo activos)</Label>
              <ContractSelector
                contracts={contratosActivos}
                value={contratoId}
                onChange={setContratoId}
                label=""
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tipo de modificación</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as ConvenioTipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CONVENIO_TIPO_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tipo !== "plazo" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="monto">Monto adicional (MXN)</Label>
                <Input id="monto" name="monto" type="number" defaultValue={0} />
              </div>
            )}
            {tipo !== "monto" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="dias">Días adicionales</Label>
                <Input id="dias" name="dias" type="number" defaultValue={0} />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="justificacion">
                Justificación técnica <span className="text-destructive">*</span>
              </Label>
              <Textarea id="justificacion" name="justificacion" rows={3} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="documentos">Documentos de soporte (opcional)</Label>
              <Input id="documentos" name="documentos" type="file" multiple />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Registrando..." : "Registrar solicitud"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
