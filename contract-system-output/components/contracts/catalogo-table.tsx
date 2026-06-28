"use client"

/**
 * Cambio 4: Componente reutilizable de catálogo de conceptos.
 * Reemplaza la lógica de tabla en catalogo-conceptos.tsx, programa-obra.tsx,
 * estimaciones (generadores) y convenios.
 *
 * Soporta 4 modos:
 *  - "catalogo"    → tabla base con edición opcional
 *  - "programa"    → + columna "cantidad programada (semana N)"
 *  - "generadores" → + columnas cantidad ejecutada y acumulado
 *  - "convenio"    → + columna cantidad nueva con celda resaltada
 */

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import type { ConceptoCatalogo } from "@/lib/types"
import { formatCurrency } from "@/lib/format"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ── Tipos de modo ─────────────────────────────────────────────────────────────

export type CatalogoModo =
  | { tipo: "catalogo" }
  | { tipo: "programa"; periodo: number }
  | { tipo: "generadores"; estimacionId: string }
  | { tipo: "convenio"; convenioId: string }

export interface ConceptoEjecutado {
  conceptoId: string
  cantidadEjecutada: number
  cantidadAcumulada: number
  porcentajeAvance: number
}

export interface ConceptoConvenio {
  conceptoId: string
  cantidadNueva: number
}

export interface CatalogoTableProps {
  conceptos: ConceptoCatalogo[]
  modo: CatalogoModo
  editable?: boolean
  onChange?: (conceptos: ConceptoCatalogo[]) => void
  /** Para modo "generadores": cantidades ejecutadas por concepto */
  ejecutados?: ConceptoEjecutado[]
  /** Para modo "convenio": cantidades nuevas propuestas */
  convenioConceptos?: ConceptoConvenio[]
  /** Para modo "programa": cantidades programadas por concepto */
  programados?: Record<string, number>
}

const PAGE_SIZE = 50

export function CatalogoTable({
  conceptos,
  modo,
  ejecutados = [],
  convenioConceptos = [],
  programados = {},
}: CatalogoTableProps) {
  const [busqueda, setBusqueda] = useState("")
  const [pagina, setPagina] = useState(0)

  // Filtro por clave o descripción
  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return conceptos
    const q = busqueda.toLowerCase()
    return conceptos.filter(
      (c) =>
        c.clave.toLowerCase().includes(q) ||
        c.descripcion.toLowerCase().includes(q),
    )
  }, [conceptos, busqueda])

  // Paginación (solo si >100 filas)
  const usaPaginacion = filtrados.length > 100
  const paginas = usaPaginacion ? Math.ceil(filtrados.length / PAGE_SIZE) : 1
  const visibles = usaPaginacion
    ? filtrados.slice(pagina * PAGE_SIZE, (pagina + 1) * PAGE_SIZE)
    : filtrados

  // Total de importes visibles
  const totalVisible = useMemo(
    () => visibles.reduce((s, c) => s + c.total, 0),
    [visibles],
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por clave o descripción…"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value)
            setPagina(0)
          }}
          className="pl-8 h-8 text-xs"
        />
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Clave</TableHead>
              {modo.tipo === "catalogo" && (
                <TableHead className="text-xs text-muted-foreground">Capítulo</TableHead>
              )}
              <TableHead className="text-xs">Descripción</TableHead>
              <TableHead className="text-xs">Unidad</TableHead>
              <TableHead className="text-xs text-right">Cant. contratada</TableHead>
              <TableHead className="text-xs text-right">P. Unitario</TableHead>
              <TableHead className="text-xs text-right">Importe</TableHead>
              {/* Columnas extra según modo */}
              {modo.tipo === "programa" && (
                <TableHead className="text-xs text-right bg-blue-50 dark:bg-blue-950/30">
                  Cant. sem. {modo.periodo}
                </TableHead>
              )}
              {modo.tipo === "generadores" && (
                <>
                  <TableHead className="text-xs text-right bg-green-50 dark:bg-green-950/30">
                    Cant. ejecutada
                  </TableHead>
                  <TableHead className="text-xs text-right bg-green-50 dark:bg-green-950/30">
                    Acumulado
                  </TableHead>
                  <TableHead className="text-xs text-right bg-green-50 dark:bg-green-950/30">
                    % Avance
                  </TableHead>
                </>
              )}
              {modo.tipo === "convenio" && (
                <TableHead className="text-xs text-right bg-amber-50 dark:bg-amber-950/30">
                  Cant. nueva
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((c) => {
              const ejec = ejecutados.find((e) => e.conceptoId === c.id)
              const conv = convenioConceptos.find((cv) => cv.conceptoId === c.id)
              const progCant = programados[c.id] ?? null

              return (
                <TableRow key={c.id}>
                  <TableCell className="text-xs font-medium">{c.clave}</TableCell>
                  {modo.tipo === "catalogo" && (
                    <TableCell className="text-xs text-muted-foreground">
                      {c.capitulo ?? "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-xs max-w-xs">{c.descripcion}</TableCell>
                  <TableCell className="text-xs">{c.unidad}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">
                    {c.cantidad.toLocaleString("es-MX")}
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums">
                    {formatCurrency(c.precioUnitario)}
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums font-medium">
                    {formatCurrency(c.total)}
                  </TableCell>
                  {/* Columna programa */}
                  {modo.tipo === "programa" && (
                    <TableCell className="text-xs text-right tabular-nums bg-blue-50/50 dark:bg-blue-950/20">
                      {progCant != null ? progCant.toLocaleString("es-MX") : "—"}
                    </TableCell>
                  )}
                  {/* Columnas generadores */}
                  {modo.tipo === "generadores" && (
                    <>
                      <TableCell className="text-xs text-right tabular-nums bg-green-50/50 dark:bg-green-950/20">
                        {ejec ? ejec.cantidadEjecutada.toLocaleString("es-MX") : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums bg-green-50/50 dark:bg-green-950/20">
                        {ejec ? ejec.cantidadAcumulada.toLocaleString("es-MX") : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums bg-green-50/50 dark:bg-green-950/20">
                        {ejec ? `${ejec.porcentajeAvance}%` : "—"}
                      </TableCell>
                    </>
                  )}
                  {/* Columna convenio */}
                  {modo.tipo === "convenio" && (
                    <TableCell
                      className={`text-xs text-right tabular-nums font-medium ${
                        conv == null
                          ? "bg-amber-50/50 dark:bg-amber-950/20 text-muted-foreground"
                          : conv.cantidadNueva > c.cantidad
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : conv.cantidadNueva < c.cantidad
                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                          : "bg-amber-50/50 dark:bg-amber-950/20"
                      }`}
                    >
                      {conv != null ? conv.cantidadNueva.toLocaleString("es-MX") : "—"}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
            {/* Fila de totales */}
            <TableRow className="bg-muted/50 sticky bottom-0">
              <TableCell
                colSpan={
                  modo.tipo === "catalogo"
                    ? 6
                    : modo.tipo === "programa"
                    ? 5
                    : modo.tipo === "generadores"
                    ? 5
                    : 5
                }
                className="text-right text-xs font-semibold"
              >
                {filtrados.length !== conceptos.length
                  ? `Total (${visibles.length} de ${filtrados.length} filtrados)`
                  : "Total"}
              </TableCell>
              <TableCell className="text-right text-xs font-bold tabular-nums">
                {formatCurrency(totalVisible)}
              </TableCell>
              {modo.tipo === "programa" && <TableCell />}
              {modo.tipo === "generadores" && <><TableCell /><TableCell /><TableCell /></>}
              {modo.tipo === "convenio" && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      {usaPaginacion && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Mostrando {pagina * PAGE_SIZE + 1}–{Math.min((pagina + 1) * PAGE_SIZE, filtrados.length)} de {filtrados.length}
          </span>
          <div className="flex gap-1">
            <button
              className="rounded px-2 py-1 hover:bg-muted disabled:opacity-40"
              disabled={pagina === 0}
              onClick={() => setPagina((p) => p - 1)}
            >
              ‹ Ant
            </button>
            <button
              className="rounded px-2 py-1 hover:bg-muted disabled:opacity-40"
              disabled={pagina >= paginas - 1}
              onClick={() => setPagina((p) => p + 1)}
            >
              Sig ›
            </button>
          </div>
        </div>
      )}

      {filtrados.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No hay conceptos que coincidan con la búsqueda.
        </p>
      )}
    </div>
  )
}
