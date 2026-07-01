"use client"

import { useState } from "react"
import { Calculator } from "lucide-react"
import type { Contract, Finiquito, FiniquitoStatus } from "@/lib/types"
import { FINIQUITO_STATUS_LABELS } from "@/lib/types"
import { useApp, can } from "@/lib/store"
import { formatDate, formatMoneyFull } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"

const STATUS_COLORS: Record<FiniquitoStatus, string> = {
  borrador: "bg-muted text-muted-foreground",
  notificado: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
  conforme: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  inconformidad: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  cerrado: "bg-slate-100 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300",
}

export function FiniquitoSection({
  contract,
  finiquito,
  userRole,
}: {
  contract: Contract
  finiquito: Finiquito | null
  userRole?: string
}) {
  const { anticipos } = useApp()
  const anticipo = anticipos.find((a) => a.contratoId === contract.id) ?? null

  if (!finiquito) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          El finiquito aún no ha sido emitido. Registre los créditos para calcular el saldo neto.
        </p>
        {can(userRole, "finiquito.emitir") && (
          <EmitirFiniquitoDialog
            contract={contract}
            saldoAnticipo={anticipo?.saldoPendiente ?? 0}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header / Status */}
      <div className="flex items-center justify-between">
        <Badge className={STATUS_COLORS[finiquito.status]}>
          {FINIQUITO_STATUS_LABELS[finiquito.status]}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Emitido por {finiquito.emitidoPor} · {formatDate(finiquito.fechaCreacion)}
        </span>
      </div>

      {/* Credits table */}
      <div className="rounded-md border overflow-hidden text-sm">
        <div className="bg-muted/50 px-3 py-2 font-medium text-xs uppercase tracking-wide text-muted-foreground">
          Créditos a favor del contratista
        </div>
        <div className="divide-y">
          <CreditRow label="Estimaciones pendientes de pago" value={finiquito.estimacionesPendientes} />
          <CreditRow label="Ajuste de precios" value={finiquito.ajustePrecios} />
          <CreditRow label="Otros créditos" value={finiquito.otrosCreditosContratista} />
        </div>
        <div className="flex justify-between bg-muted/30 px-3 py-2 font-semibold text-sm">
          <span>Subtotal contratista</span>
          <span>{formatMoneyFull(finiquito.totalCreditosContratista)}</span>
        </div>

        <div className="bg-muted/50 px-3 py-2 font-medium text-xs uppercase tracking-wide text-muted-foreground mt-px">
          Créditos a favor de la dependencia
        </div>
        <div className="divide-y">
          <CreditRow
            label="Saldo de anticipo no amortizado"
            value={finiquito.saldoAnticipoNoAmortizado}
            note="Jalado automáticamente del anticipo"
          />
          <CreditRow label="Penas convencionales" value={finiquito.penasConvencionales} />
          <CreditRow label="Deducibles" value={finiquito.deducibles} />
        </div>
        <div className="flex justify-between bg-muted/30 px-3 py-2 font-semibold text-sm">
          <span>Subtotal dependencia</span>
          <span>{formatMoneyFull(finiquito.totalCreditosDependencia)}</span>
        </div>

        <Separator />
        <div
          className={`flex justify-between px-3 py-3 font-bold ${
            finiquito.saldoNeto >= 0
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-red-700 dark:text-red-300"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Calculator className="h-4 w-4" />
            Saldo neto
          </span>
          <span>
            {finiquito.saldoNeto >= 0 ? "+" : ""}
            {formatMoneyFull(finiquito.saldoNeto)}
          </span>
        </div>
        {finiquito.saldoNeto >= 0 ? (
          <p className="px-3 pb-2 text-xs text-muted-foreground">
            La dependencia debe al contratista {formatMoneyFull(finiquito.saldoNeto)}.
          </p>
        ) : (
          <p className="px-3 pb-2 text-xs text-muted-foreground">
            El contratista debe a la dependencia {formatMoneyFull(Math.abs(finiquito.saldoNeto))}.
          </p>
        )}
      </div>

      {/* Notification info */}
      {finiquito.fechaNotificacion && (
        <div className="rounded-md border p-3 text-xs space-y-1 text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Notificado al contratista: </span>
            {formatDate(finiquito.fechaNotificacion)}
          </p>
          {finiquito.fechaLimiteRespuesta && (
            <p>
              <span className="font-medium text-foreground">
                Plazo de respuesta (15 días naturales):{" "}
              </span>
              {formatDate(finiquito.fechaLimiteRespuesta)}
            </p>
          )}
        </div>
      )}

      {/* Conformidad info */}
      {finiquito.status === "conforme" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
          El contratista ha registrado conformidad con el finiquito.
        </div>
      )}
      {finiquito.status === "inconformidad" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <span className="font-medium">El contratista ha registrado inconformidad.</span>
          {finiquito.motivoInconformidad && (
            <span className="block mt-1">Motivo: {finiquito.motivoInconformidad}</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {/* Edit draft */}
        {finiquito.status === "borrador" && can(userRole, "finiquito.emitir") && (
          <EmitirFiniquitoDialog
            contract={contract}
            saldoAnticipo={finiquito.saldoAnticipoNoAmortizado}
            finiquito={finiquito}
          />
        )}
        {/* Notify */}
        {finiquito.status === "borrador" && can(userRole, "finiquito.notificar") && (
          <NotificarButton contract={contract} />
        )}
        {/* Respond */}
        {finiquito.status === "notificado" && can(userRole, "finiquito.responder") && (
          <ResponderDialog contract={contract} />
        )}
        {/* Close */}
        {["conforme", "inconformidad"].includes(finiquito.status) &&
          can(userRole, "finiquito.cerrar") && <CerrarButton contract={contract} />}
      </div>
    </div>
  )
}

function CreditRow({
  label,
  value,
  note,
}: {
  label: string
  value: number
  note?: string
}) {
  return (
    <div className="flex items-start justify-between px-3 py-2">
      <div>
        <span className="text-sm">{label}</span>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      <span className="text-sm font-mono shrink-0 ml-4">{formatMoneyFull(value)}</span>
    </div>
  )
}

function EmitirFiniquitoDialog({
  contract,
  saldoAnticipo,
  finiquito,
}: {
  contract: Contract
  saldoAnticipo: number
  finiquito?: Finiquito
}) {
  const { emitirFiniquito } = useApp()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [estimacionesPendientes, setEstimacionesPendientes] = useState(
    finiquito?.estimacionesPendientes ?? 0,
  )
  const [ajustePrecios, setAjustePrecios] = useState(finiquito?.ajustePrecios ?? 0)
  const [otrosCreditosContratista, setOtrosCreditosContratista] = useState(
    finiquito?.otrosCreditosContratista ?? 0,
  )
  const [penasConvencionales, setPenasConvencionales] = useState(
    finiquito?.penasConvencionales ?? 0,
  )
  const [deducibles, setDeducibles] = useState(finiquito?.deducibles ?? 0)

  const totalContratista = estimacionesPendientes + ajustePrecios + otrosCreditosContratista
  const totalDependencia = saldoAnticipo + penasConvencionales + deducibles
  const saldoNeto = totalContratista - totalDependencia

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await emitirFiniquito(contract.id, {
        estimaciones_pendientes: estimacionesPendientes,
        ajuste_precios: ajustePrecios,
        otros_creditos_contratista: otrosCreditosContratista,
        penas_convencionales: penasConvencionales,
        deducibles,
      })
      toast.success(finiquito ? "Finiquito actualizado." : "Finiquito emitido correctamente.")
      setOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al emitir el finiquito."
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  function numField(
    label: string,
    value: number,
    onChange: (v: number) => void,
    readOnly?: boolean,
    note?: string,
  ) {
    return (
      <div className="space-y-1">
        <Label className="text-xs">{label}</Label>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={value}
          readOnly={readOnly}
          className={readOnly ? "bg-muted" : ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={finiquito ? "outline" : "default"}>
          {finiquito ? "Editar finiquito" : "Emitir finiquito"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {finiquito ? "Editar finiquito" : "Emitir finiquito del contrato"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Créditos a favor del contratista
            </p>
            <div className="space-y-2">
              {numField(
                "Estimaciones pendientes de pago",
                estimacionesPendientes,
                setEstimacionesPendientes,
              )}
              {numField("Ajuste de precios", ajustePrecios, setAjustePrecios)}
              {numField("Otros créditos", otrosCreditosContratista, setOtrosCreditosContratista)}
            </div>
          </div>

          <Separator />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Créditos a favor de la dependencia
            </p>
            <div className="space-y-2">
              {numField(
                "Saldo de anticipo no amortizado",
                saldoAnticipo,
                () => {},
                true,
                "Calculado automáticamente del anticipo registrado.",
              )}
              {numField(
                "Penas convencionales",
                penasConvencionales,
                setPenasConvencionales,
              )}
              {numField("Deducibles", deducibles, setDeducibles)}
            </div>
          </div>

          <Separator />

          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal contratista</span>
              <span>{formatMoneyFull(totalContratista)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal dependencia</span>
              <span>{formatMoneyFull(totalDependencia)}</span>
            </div>
            <Separator className="my-1" />
            <div
              className={`flex justify-between font-bold ${
                saldoNeto >= 0
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-red-700 dark:text-red-300"
              }`}
            >
              <span>Saldo neto</span>
              <span>
                {saldoNeto >= 0 ? "+" : ""}
                {formatMoneyFull(saldoNeto)}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando…" : finiquito ? "Guardar cambios" : "Emitir finiquito"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function NotificarButton({ contract }: { contract: Contract }) {
  const { notificarFiniquito } = useApp()
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    try {
      await notificarFiniquito(contract.id)
      toast.success(
        "Finiquito notificado. El contratista tiene 15 días naturales para responder.",
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al notificar."
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size="sm" onClick={handle} disabled={loading}>
      {loading ? "Notificando…" : "Notificar al contratista"}
    </Button>
  )
}

function ResponderDialog({ contract }: { contract: Contract }) {
  const { responderFiniquito } = useApp()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [conformidad, setConformidad] = useState<boolean | null>(null)
  const [motivo, setMotivo] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (conformidad === null) {
      toast.error("Seleccione conformidad o inconformidad.")
      return
    }
    if (!conformidad && !motivo.trim()) {
      toast.error("Capture el motivo de inconformidad.")
      return
    }
    setLoading(true)
    try {
      await responderFiniquito(contract.id, {
        conformidad,
        motivo_inconformidad: !conformidad ? motivo : undefined,
      })
      toast.success("Respuesta del contratista registrada.")
      setOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrar la respuesta."
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Registrar respuesta del contratista
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Respuesta al finiquito</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Respuesta del contratista</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={conformidad === true ? "default" : "outline"}
                className="flex-1"
                onClick={() => {
                  setConformidad(true)
                  setMotivo("")
                }}
              >
                Conforme
              </Button>
              <Button
                type="button"
                variant={conformidad === false ? "destructive" : "outline"}
                className="flex-1"
                onClick={() => setConformidad(false)}
              >
                Inconformidad
              </Button>
            </div>
          </div>

          {conformidad === false && (
            <div className="space-y-1.5">
              <Label>
                Motivo de inconformidad <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="Describa el motivo de inconformidad del contratista..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                required
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || conformidad === null}>
              {loading ? "Guardando…" : "Registrar respuesta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CerrarButton({ contract }: { contract: Contract }) {
  const { cerrarFiniquito } = useApp()
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    try {
      await cerrarFiniquito(contract.id)
      toast.success("Contrato cerrado exitosamente.")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cerrar el contrato."
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size="sm" onClick={handle} disabled={loading}>
      {loading ? "Cerrando…" : "Cerrar contrato"}
    </Button>
  )
}
