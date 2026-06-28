"use client"

/**
 * ActivacionPanel
 * Controla el flujo completo de activación del contrato:
 *  - Dependencia: solicitar activación (con checklist de condiciones)
 *  - Residente:   aprobar o rechazar la solicitud
 *  - Cualquier rol: ver el estado actual de la solicitud
 *
 * Se monta en la página de detalle del contrato cuando status === "registrado"
 */

import { useState } from "react"
import {
  Rocket,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import type { Contract } from "@/lib/types"
import { useApp, can } from "@/lib/store"
import { formatDate } from "@/lib/format"
import { useChecklist, ActivacionChecklist } from "./activacion-checklist"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
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

export function ActivacionPanel({ contract }: { contract: Contract }) {
  const {
    user,
    garantias,
    anticipos,
    programasObra,
    solicitudesActivacion,
    requestActivation,
    reviewActivation,
  } = useApp()

  const anticipo = anticipos.find((a) => a.contratoId === contract.id) ?? null
  const checklist = useChecklist(contract, garantias, programasObra, anticipo)
  const obligatoriasOk = checklist.filter((c) => c.obligatoria).every((c) => c.cumplida)

  const solicitud = solicitudesActivacion.find((s) => s.contratoId === contract.id) ?? null

  // Estados locales de diálogos
  const [solicitarOpen, setSolicitarOpen] = useState(false)
  const [revisarOpen, setRevisarOpen] = useState(false)
  const [checklistExpanded, setChecklistExpanded] = useState(false)

  const esDependencia = can(user?.role, "contrato.activar")
  const esResidente = can(user?.role, "contrato.revisar-activacion")

  // ── Render según estado de la solicitud ──────────────────────────────────────

  return (
    <Card className="border-2 border-amber-200 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/10">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
            <Rocket className="h-4 w-4 text-amber-700 dark:text-amber-300" />
          </div>
          <CardTitle className="text-base text-amber-900 dark:text-amber-200">
            Activación del contrato
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">

        {/* ── Sin solicitud: Dependencia puede solicitar ── */}
        {!solicitud && (
          <>
            <p className="text-sm text-muted-foreground">
              Este contrato está en estado <strong>registrado</strong>. Antes de comenzar la ejecución
              de obra, la Dependencia debe solicitar su activación. El Residente de Obra revisará
              las condiciones y confirmará la activación, lo que abrirá la bitácora automáticamente.
            </p>

            {/* Checklist colapsable */}
            <button
              className="flex items-center gap-2 text-sm font-medium text-foreground"
              onClick={() => setChecklistExpanded((v) => !v)}
            >
              {checklistExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Condiciones previas
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
                  obligatoriasOk
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {checklist.filter((c) => c.obligatoria && c.cumplida).length}/
                {checklist.filter((c) => c.obligatoria).length} obligatorias
              </span>
            </button>

            {checklistExpanded && <ActivacionChecklist checklist={checklist} />}

            {esDependencia && (
              <Dialog open={solicitarOpen} onOpenChange={setSolicitarOpen}>
                <DialogTrigger asChild>
                  <Button
                    disabled={!obligatoriasOk}
                    className="self-start"
                    title={
                      !obligatoriasOk
                        ? "Completa las condiciones obligatorias para habilitar este botón"
                        : undefined
                    }
                  >
                    <Rocket className="h-4 w-4" />
                    Solicitar activación
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Solicitar activación del contrato</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    Se enviará una solicitud al <strong>Residente de Obra</strong> para que
                    revise y confirme la activación. Una vez aprobada, el contrato pasará
                    a estado <strong>activo</strong> y la bitácora se abrirá automáticamente.
                  </p>
                  <ActivacionChecklist checklist={checklist} compact />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSolicitarOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={async () => {
                        try {
                          await requestActivation(contract.id)
                          toast.success("Solicitud de activación enviada al Residente de Obra")
                          setSolicitarOpen(false)
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "No se pudo enviar la solicitud")
                        }
                      }}
                    >
                      Confirmar solicitud
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {!esDependencia && (
              <p className="text-xs text-muted-foreground">
                Solo la <strong>Dependencia</strong> puede solicitar la activación de un contrato.
              </p>
            )}
          </>
        )}

        {/* ── Solicitud pendiente ── */}
        {solicitud?.status === "pendiente" && (
          <>
            <div className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30">
              <Clock className="h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  Solicitud de activación pendiente de revisión
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Solicitado por <strong>{solicitud.solicitadoPor}</strong> el{" "}
                  {formatDate(solicitud.fechaSolicitud)}
                </p>
              </div>
            </div>

            {/* Checklist de referencia */}
            <button
              className="flex items-center gap-2 text-sm font-medium text-foreground"
              onClick={() => setChecklistExpanded((v) => !v)}
            >
              {checklistExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Ver condiciones verificadas
            </button>
            {checklistExpanded && <ActivacionChecklist checklist={checklist} compact />}

            {/* Acción del Residente */}
            {esResidente && (
              <Dialog open={revisarOpen} onOpenChange={setRevisarOpen}>
                <DialogTrigger asChild>
                  <Button className="self-start">
                    Revisar y decidir
                  </Button>
                </DialogTrigger>
                <RevisionDialog
                  contract={contract}
                  checklist={checklist}
                  solicitadoPor={solicitud.solicitadoPor}
                  fechaSolicitud={solicitud.fechaSolicitud}
                  onDecision={async (aprobado, obs) => {
                    try {
                      await reviewActivation(contract.id, aprobado, obs)
                      if (aprobado) {
                        toast.success(
                          "Contrato activado. La bitácora de obra ha sido abierta automáticamente.",
                          { duration: 5000 },
                        )
                      } else {
                        toast.error("Solicitud rechazada. La Dependencia debe corregir las observaciones.")
                      }
                      setRevisarOpen(false)
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "No se pudo procesar la revisión")
                    }
                  }}
                />
              </Dialog>
            )}

            {!esResidente && !esDependencia && (
              <p className="text-xs text-muted-foreground">
                Solo el <strong>Residente de Obra</strong> puede aprobar o rechazar esta solicitud.
              </p>
            )}

            {esDependencia && (
              <p className="text-xs text-amber-700">
                Tu solicitud está siendo revisada por el Residente de Obra.
              </p>
            )}
          </>
        )}

        {/* ── Solicitud rechazada — Dependencia puede reintentar ── */}
        {solicitud?.status === "rechazada" && (
          <>
            <div className="flex items-start gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 dark:border-red-700 dark:bg-red-950/30">
              <XCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900 dark:text-red-200">
                  Solicitud rechazada
                </p>
                <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                  Rechazada por <strong>{solicitud.revisadoPor}</strong> el{" "}
                  {formatDate(solicitud.fechaRevision ?? "")}
                </p>
                {solicitud.observaciones && (
                  <p className="text-sm text-red-800 dark:text-red-300 mt-2 rounded bg-red-100 dark:bg-red-900/40 px-2 py-1">
                    {solicitud.observaciones}
                  </p>
                )}
              </div>
            </div>

            <button
              className="flex items-center gap-2 text-sm font-medium text-foreground"
              onClick={() => setChecklistExpanded((v) => !v)}
            >
              {checklistExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Condiciones previas
              <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
                obligatoriasOk ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
              }`}>
                {checklist.filter((c) => c.obligatoria && c.cumplida).length}/
                {checklist.filter((c) => c.obligatoria).length} obligatorias
              </span>
            </button>
            {checklistExpanded && <ActivacionChecklist checklist={checklist} />}

            {esDependencia && (
              <Button
                disabled={!obligatoriasOk}
                className="self-start"
                onClick={async () => {
                  try {
                    await requestActivation(contract.id)
                    toast.success("Nueva solicitud de activación enviada al Residente de Obra")
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "No se pudo enviar la solicitud")
                  }
                }}
              >
                <Rocket className="h-4 w-4" />
                Reenviar solicitud
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── RevisionDialog: el Residente aprueba o rechaza ───────────────────────────

import type { CondicionActivacion } from "./activacion-checklist"

function RevisionDialog({
  contract,
  checklist,
  solicitadoPor,
  fechaSolicitud,
  onDecision,
}: {
  contract: Contract
  checklist: CondicionActivacion[]
  solicitadoPor: string
  fechaSolicitud: string
  onDecision: (aprobado: boolean, observaciones: string) => Promise<void>
}) {
  const [obs, setObs] = useState("")

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Revisión de solicitud de activación</DialogTitle>
      </DialogHeader>

      <div className="text-sm text-muted-foreground">
        Solicitud de <strong>{solicitadoPor}</strong> el {formatDate(fechaSolicitud)}
        {" · "}<strong>{contract.noContrato}</strong>
      </div>

      <ActivacionChecklist checklist={checklist} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="obs-rechazo">
          Observaciones <span className="text-muted-foreground text-xs">(requeridas si rechazas)</span>
        </Label>
        <Textarea
          id="obs-rechazo"
          rows={3}
          placeholder="Describe las razones del rechazo o comentarios adicionales…"
          value={obs}
          onChange={(e) => setObs(e.target.value)}
        />
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-50"
          disabled={!obs.trim()}
          onClick={() => onDecision(false, obs)}
        >
          <XCircle className="h-4 w-4" />
          Rechazar
        </Button>
        <Button onClick={() => onDecision(true, obs)}>
          <CheckCircle2 className="h-4 w-4" />
          Aprobar y activar
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
