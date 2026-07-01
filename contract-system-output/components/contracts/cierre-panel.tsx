"use client"

import { useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  ShieldCheck,
} from "lucide-react"
import type { Contract } from "@/lib/types"
import { TERMINACION_TIPO_LABELS } from "@/lib/types"
import { useApp, can } from "@/lib/store"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { TerminacionDialog } from "./terminacion-dialog"
import { ActaDialog } from "./acta-dialog"
import { FiniquitoSection } from "./finiquito-panel"

export function CierrePanel({ contract }: { contract: Contract }) {
  const { user, terminaciones, finiquitos, incumplimientos, resolverIncumplimiento } = useApp()
  const [resolviendoId, setResolviendoId] = useState<string | null>(null)

  const terminacion = terminaciones.find((t) => t.contratoId === contract.id) ?? null
  const finiquito = finiquitos.find((f) => f.contratoId === contract.id) ?? null
  const sinResolver = incumplimientos.filter(
    (i) => i.contratoId === contract.id && !i.resuelto,
  )

  async function handleResolver(id: string) {
    setResolviendoId(id)
    try {
      await resolverIncumplimiento(id, contract.id)
      toast.success("Incumplimiento marcado como resuelto.")
    } catch {
      toast.error("No se pudo resolver el incumplimiento.")
    } finally {
      setResolviendoId(null)
    }
  }

  const steps = [
    { num: 1, label: "Terminación de trabajos", desc: "Art. 64 LOPSRM", done: !!terminacion },
    {
      num: 2,
      label: "Acta de entrega-recepción",
      desc: "Respaldo documental de la entrega física",
      done: !!terminacion?.acta,
    },
    {
      num: 3,
      label: "Finiquito del contrato",
      desc: "Art. 66 LOPSRM — liquidación económica final",
      done: !!finiquito && !["borrador", "notificado"].includes(finiquito.status),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Pre-check: incumplimientos sin resolver (solo en activo) */}
      {contract.status === "activo" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              Verificación previa al cierre
            </CardTitle>
            <CardDescription>
              Todos los incumplimientos deben resolverse antes de iniciar la terminación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sinResolver.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Sin incumplimientos pendientes. Puede proceder con la terminación.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {sinResolver.length} incumplimiento(s) sin resolver bloquean la terminación.
                </div>
                {sinResolver.map((inc) => (
                  <div
                    key={inc.id}
                    className="flex items-center justify-between rounded-md border p-3 text-sm"
                  >
                    <div>
                      <span className="font-medium capitalize">{inc.tipo}</span>
                      <span className="ml-2 text-muted-foreground">— {inc.descripcion}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatDate(inc.fecha)}
                      </span>
                    </div>
                    {can(user?.role, "incumplimiento.resolver") && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolviendoId === inc.id}
                        onClick={() => handleResolver(inc.id)}
                      >
                        {resolviendoId === inc.id ? "Guardando…" : "Marcar resuelto"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proceso de cierre administrativo</CardTitle>
          <CardDescription>
            Flujo secuencial de cierre. Cada paso se habilita al completar el anterior.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-8">
            {/* Step 1: Terminación */}
            <StepRow num={1} label={steps[0].label} desc={steps[0].desc} done={steps[0].done}>
              {terminacion ? (
                <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                  <p className="flex items-center gap-1.5 font-medium">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    {TERMINACION_TIPO_LABELS[terminacion.tipo]}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Fecha: </span>
                    {formatDate(terminacion.fechaTerminacion)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Avance físico final: </span>
                    {terminacion.avanceFisicoFinal}%
                  </p>
                  {terminacion.motivo && (
                    <p>
                      <span className="text-muted-foreground">Motivo: </span>
                      {terminacion.motivo}
                    </p>
                  )}
                  <Separator className="my-2" />
                  <p className="italic text-muted-foreground text-xs">{terminacion.notaCierre}</p>
                  <p className="text-xs text-muted-foreground">
                    Registrado por {terminacion.registradoPor} ·{" "}
                    {formatDate(terminacion.fechaRegistro)}
                  </p>
                </div>
              ) : contract.status === "activo" && can(user?.role, "cierre.terminar") ? (
                <TerminacionDialog contract={contract} disabled={sinResolver.length > 0} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {contract.status === "activo"
                    ? "Sin permisos para registrar la terminación."
                    : "Terminación aún no registrada."}
                </p>
              )}
            </StepRow>

            {/* Step 2: Acta */}
            <StepRow num={2} label={steps[1].label} desc={steps[1].desc} done={steps[1].done}>
              {!terminacion ? (
                <p className="text-xs text-muted-foreground">
                  Registre primero la terminación.
                </p>
              ) : terminacion.acta ? (
                <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                  <p className="flex items-center gap-1.5 font-medium">
                    <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    Acta cargada
                  </p>
                  <p>
                    <span className="text-muted-foreground">Fecha de firma: </span>
                    {formatDate(terminacion.acta.fechaFirma)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Registrado por: </span>
                    {terminacion.acta.registradoPor}
                  </p>
                  <a
                    href={terminacion.acta.archivo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-primary underline underline-offset-2"
                  >
                    Ver documento
                  </a>
                </div>
              ) : can(user?.role, "cierre.cargar-acta") ? (
                <ActaDialog contract={contract} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sin permisos para cargar el acta.
                </p>
              )}
            </StepRow>

            {/* Step 3: Finiquito */}
            <StepRow num={3} label={steps[2].label} desc={steps[2].desc} done={steps[2].done}>
              {!terminacion?.acta ? (
                <p className="text-xs text-muted-foreground">
                  Cargue primero el acta de entrega-recepción.
                </p>
              ) : (
                <FiniquitoSection
                  contract={contract}
                  finiquito={finiquito}
                  userRole={user?.role}
                />
              )}
            </StepRow>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}

function StepRow({
  num,
  label,
  desc,
  done,
  children,
}: {
  num: number
  label: string
  desc: string
  done: boolean
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-4">
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : num}
      </div>
      <div className="flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {done && (
            <Badge
              variant="secondary"
              className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 text-[11px]"
            >
              Completado
            </Badge>
          )}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{desc}</p>
        {children}
      </div>
    </li>
  )
}
