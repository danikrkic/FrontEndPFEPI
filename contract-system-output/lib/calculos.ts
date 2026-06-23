import type { Anticipo, ConceptoCatalogo, ConvenioConceptoAfectado } from "./types"

// ── Cambio 2: desglose financiero de estimación ──────────────────────────────

export interface DesgloseEstimacion {
  importeBruto: number
  amortizacionAnticipo: number
  retencionGarantia: number
  iva: number
  importeNeto: number
}

export function calcularDesgloseEstimacion(
  importeBruto: number,
  anticipo: Anticipo | null,
  porcentajeRetencion = 0.05,
  porcentajeIVA = 0.16
): DesgloseEstimacion {
  const amortizacion = anticipo
    ? Math.min(
        importeBruto * (anticipo.porcentajeAmortizacion / 100),
        anticipo.saldoPendiente,
      )
    : 0
  const retencionGarantia = importeBruto * porcentajeRetencion
  const baseGravable = importeBruto - amortizacion - retencionGarantia
  const iva = baseGravable * porcentajeIVA
  const importeNeto = baseGravable + iva

  return {
    importeBruto,
    amortizacionAnticipo: amortizacion,
    retencionGarantia,
    iva,
    importeNeto,
  }
}

// ── Cambio 5: helpers de propagación de convenio ─────────────────────────────

export function aplicarAjusteCantidades(
  catalogo: ConceptoCatalogo[],
  afectados: ConvenioConceptoAfectado[],
): ConceptoCatalogo[] {
  return catalogo.map((c) => {
    const ajuste = afectados.find((a) => a.conceptoId === c.id)
    if (!ajuste) return c
    return {
      ...c,
      cantidad: ajuste.cantidadNueva,
      total: ajuste.cantidadNueva * c.precioUnitario,
    }
  })
}

export function sumarDias(fechaIso: string, dias: number): string {
  const d = new Date(fechaIso + "T00:00:00")
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}
