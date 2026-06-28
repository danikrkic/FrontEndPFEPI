"use client"

/**
 * ActivacionChecklist
 * Evalúa en tiempo real las 5 condiciones previas a la activación de un contrato
 * y las muestra como checklist visual. Exporta también el hook puro `useChecklist`.
 */

import { useMemo } from "react"
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import type { Anticipo, Contract, Garantia, ProgramaObra } from "@/lib/types"
import { formatDate } from "@/lib/format"

export interface CondicionActivacion {
  id: string
  label: string
  descripcion: string
  cumplida: boolean
  obligatoria: boolean
  detalle?: string
}

export function useChecklist(
  contract: Contract,
  garantias: Garantia[],
  programasObra: ProgramaObra[],
  anticipo?: Anticipo | null,
): CondicionActivacion[] {
  return useMemo(() => {
    const garantiasContrato = garantias.filter((g) => g.contratoId === contract.id)
    const garantiaCumplimiento = garantiasContrato.find(
      (g) => g.tipo === "cumplimiento" && g.status !== "vencida" && g.status !== "liberada",
    )
    const garantiaAnticipo = garantiasContrato.find(
      (g) => g.tipo === "anticipo" && g.status !== "vencida" && g.status !== "liberada",
    )
    const programa = programasObra.find((p) => p.contratoId === contract.id)
    const tienePrograma = (programa?.conceptos.length ?? 0) > 0
    const tieneContrato = contract.documentos.some((d) => d.bloque === "contrato")
    const tieneCatalogo = contract.catalogoConceptos.length > 0
    const tieneAnticipo = anticipo != null

    return [
      {
        id: "catalogo",
        label: "Catálogo de conceptos",
        descripcion: "Al menos 1 concepto registrado en el catálogo de la obra",
        cumplida: tieneCatalogo,
        obligatoria: true,
        detalle: tieneCatalogo
          ? `${contract.catalogoConceptos.length} concepto(s) registrados`
          : "Sin conceptos — agrega conceptos en la pestaña Catálogo",
      },
      {
        id: "garantia_cumplimiento",
        label: "Garantía de cumplimiento",
        descripcion: "Póliza de fianza de cumplimiento registrada y vigente",
        cumplida: !!garantiaCumplimiento,
        obligatoria: true,
        detalle: garantiaCumplimiento
          ? `Póliza ${garantiaCumplimiento.numeroPoliza} · Vigente hasta ${formatDate(garantiaCumplimiento.fechaVigencia)}`
          : "Sin garantía de cumplimiento — regístrala en la pestaña Garantías",
      },
      {
        id: "programa",
        label: "Programa de obra",
        descripcion: "Al menos la semana 1 del programa de obra capturada",
        cumplida: tienePrograma,
        obligatoria: true,
        detalle: tienePrograma
          ? `Programa con ${programa!.conceptos.length} concepto(s) programados`
          : "Sin programa de obra — captura el programa en la pestaña Programa",
      },
      {
        id: "contrato_digital",
        label: "Contrato digitalizado",
        descripcion: "Al menos un documento en el bloque 'contrato' subido al sistema",
        cumplida: tieneContrato,
        obligatoria: true,
        detalle: tieneContrato
          ? `${contract.documentos.filter((d) => d.bloque === "contrato").length} documento(s) de contrato`
          : "Sin contrato digitalizado — súbelo en la pestaña Documentación",
      },
      {
        id: "garantia_anticipo",
        label: tieneAnticipo ? "Garantía de anticipo" : "Anticipo (no aplica)",
        descripcion: tieneAnticipo
          ? "El contrato tiene anticipo registrado — se requiere garantía de anticipo vigente"
          : "El contrato no tiene anticipo registrado",
        cumplida: tieneAnticipo ? !!garantiaAnticipo : true,
        obligatoria: tieneAnticipo,
        detalle: tieneAnticipo
          ? garantiaAnticipo
            ? `Póliza ${garantiaAnticipo.numeroPoliza} · Vigente hasta ${formatDate(garantiaAnticipo.fechaVigencia)}`
            : "Falta la garantía de anticipo — regístrala en la pestaña Garantías"
          : "Sin anticipo registrado en este contrato",
      },
    ]
  }, [contract, garantias, programasObra, anticipo])
}

export function ActivacionChecklist({
  checklist,
  compact = false,
}: {
  checklist: CondicionActivacion[]
  compact?: boolean
}) {
  const obligatoriasOk = checklist
    .filter((c) => c.obligatoria)
    .every((c) => c.cumplida)

  return (
    <div className="flex flex-col gap-2">
      {!compact && (
        <div
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
            obligatoriasOk
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-amber-50 text-amber-800 border border-amber-200"
          }`}
        >
          {obligatoriasOk ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {obligatoriasOk
            ? "Todas las condiciones obligatorias están cumplidas. El contrato puede activarse."
            : "Hay condiciones pendientes. Completa los requisitos antes de solicitar la activación."}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {checklist.map((c) => (
          <div
            key={c.id}
            className={`flex items-start gap-3 rounded-md border px-3 py-2.5 ${
              c.cumplida
                ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20"
                : c.obligatoria
                ? "border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-950/20"
                : "border-amber-200 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/10"
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {c.cumplida ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : c.obligatoria ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-500" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{c.label}</p>
                {!c.obligatoria && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    Opcional
                  </span>
                )}
              </div>
              {!compact && (
                <p className="text-xs text-muted-foreground">{c.descripcion}</p>
              )}
              {c.detalle && (
                <p
                  className={`text-xs mt-0.5 ${
                    c.cumplida ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
                  }`}
                >
                  {c.detalle}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
