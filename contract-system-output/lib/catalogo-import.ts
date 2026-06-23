/**
 * Cambio 3: funciones puras de importación de catálogo (sin UI)
 * Dependencia: xlsx (SheetJS)
 */

import type { ConceptoCatalogo } from "./types"

// ── Tipos internos ────────────────────────────────────────────────────────────

export interface ColumnMapping {
  clave: number | null
  descripcion: number | null
  unidad: number | null
  cantidad: number | null
  precioUnitario: number | null
  capitulo: number | null
  importe: number | null  // columna de importe para validación cruzada
}

export interface FilaValidada {
  fila: number
  concepto: Partial<ConceptoCatalogo>
  errores: string[]
  advertencias: string[]
}

export interface ResultadoImportacion {
  filas: FilaValidada[]
  tieneErrores: boolean
}

// ── Normalización de encabezados para auto-detección ─────────────────────────

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

const PATRONES: Record<keyof ColumnMapping, string[]> = {
  clave: ["clave", "codigo", "cod", "no.", "num"],
  descripcion: ["desc", "concepto", "trabajo", "nombre"],
  unidad: ["unidad", "und", "u.m.", "um"],
  cantidad: ["cantidad", "cant", "vol", "volumen"],
  precioUnitario: ["precio", "p.u.", "pu", "unitario", "unit"],
  capitulo: ["capitulo", "cap", "partida"],
  importe: ["importe", "total", "monto", "subtotal"],
}

export function detectarColumnas(encabezados: unknown[]): ColumnMapping {
  const mapping: ColumnMapping = {
    clave: null,
    descripcion: null,
    unidad: null,
    cantidad: null,
    precioUnitario: null,
    capitulo: null,
    importe: null,
  }

  encabezados.forEach((h, idx) => {
    if (!h) return
    const norm = normalizar(String(h))
    for (const [campo, patrones] of Object.entries(PATRONES) as [keyof ColumnMapping, string[]][]) {
      if (mapping[campo] === null && patrones.some((p) => norm.includes(p))) {
        mapping[campo] = idx
      }
    }
  })

  return mapping
}

// ── Validación de filas ───────────────────────────────────────────────────────

export function validarFilas(
  filas: unknown[][],
  mapping: ColumnMapping,
  encabezadoIdx = 0,
): ResultadoImportacion {
  const clavesVistas = new Set<string>()
  const resultado: FilaValidada[] = []

  for (let i = encabezadoIdx + 1; i < filas.length; i++) {
    const row = filas[i] as unknown[]
    const errores: string[] = []
    const advertencias: string[] = []

    const clave = mapping.clave !== null ? String(row[mapping.clave] ?? "").trim() : ""
    const descripcion = mapping.descripcion !== null ? String(row[mapping.descripcion] ?? "").trim() : ""
    const unidad = mapping.unidad !== null ? String(row[mapping.unidad] ?? "").trim() : ""
    const cantidadRaw = mapping.cantidad !== null ? row[mapping.cantidad] : null
    const precioRaw = mapping.precioUnitario !== null ? row[mapping.precioUnitario] : null

    // Fila vacía → saltar sin error
    if (!clave && !descripcion) continue

    if (!clave) errores.push("Clave vacía")
    if (!descripcion) errores.push("Descripción vacía")
    if (!unidad) errores.push("Unidad vacía")

    const cantidad = parseFloat(String(cantidadRaw ?? ""))
    const precioUnitario = parseFloat(String(precioRaw ?? ""))

    if (isNaN(cantidad)) errores.push("Cantidad no numérica")
    if (isNaN(precioUnitario)) errores.push("Precio unitario no numérico")

    if (clave && clavesVistas.has(clave)) {
      errores.push(`Clave "${clave}" duplicada en el archivo`)
    } else if (clave) {
      clavesVistas.add(clave)
    }

    // Advertencia: importe no coincide (si existe columna)
    if (mapping.importe !== null && !isNaN(cantidad) && !isNaN(precioUnitario)) {
      const importeArchivo = parseFloat(String(row[mapping.importe] ?? ""))
      const importeCalculado = cantidad * precioUnitario
      if (!isNaN(importeArchivo) && Math.abs(importeArchivo - importeCalculado) / Math.max(importeCalculado, 1) > 0.01) {
        advertencias.push(`Importe del archivo (${importeArchivo.toFixed(2)}) difiere del calculado (${importeCalculado.toFixed(2)})`)
      }
    }

    const concepto: Partial<ConceptoCatalogo> = {
      clave,
      descripcion,
      unidad,
      ...(mapping.capitulo !== null ? { capitulo: String(row[mapping.capitulo] ?? "").trim() } : {}),
      ...(!isNaN(cantidad) ? { cantidad } : {}),
      ...(!isNaN(precioUnitario) ? { precioUnitario } : {}),
      ...(!isNaN(cantidad) && !isNaN(precioUnitario) ? { total: cantidad * precioUnitario } : {}),
    }

    resultado.push({ fila: i + 1, concepto, errores, advertencias })
  }

  return {
    filas: resultado,
    tieneErrores: resultado.some((r) => r.errores.length > 0),
  }
}

// ── Convertir a ConceptoCatalogo[] ────────────────────────────────────────────

export function filasAConceptos(filas: FilaValidada[]): ConceptoCatalogo[] {
  return filas
    .filter((f) => f.errores.length === 0)
    .map((f, idx) => ({
      id: `imp-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      clave: f.concepto.clave ?? "",
      descripcion: f.concepto.descripcion ?? "",
      unidad: f.concepto.unidad ?? "",
      cantidad: f.concepto.cantidad ?? 0,
      precioUnitario: f.concepto.precioUnitario ?? 0,
      total: f.concepto.total ?? 0,
      ...(f.concepto.capitulo ? { capitulo: f.concepto.capitulo } : {}),
    }))
}
