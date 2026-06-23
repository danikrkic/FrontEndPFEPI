"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { Contract, ContractVersion } from "@/lib/types"
import { formatDate, formatMoneyFull, formatCurrency } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function VersionesPanel({ contract }: { contract: Contract }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial de versiones</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ol className="relative ml-3 border-l border-border">
          {contract.versiones.map((v) => (
            <VersionItem key={v.version} version={v} />
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

function VersionItem({ version: v }: { version: ContractVersion }) {
  const [expanded, setExpanded] = useState(false)
  const tieneCatalogo = v.catalogoConceptos && v.catalogoConceptos.length > 0

  return (
    <li className="mb-6 ml-6 last:mb-0">
      <span className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-primary" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">
          Versión {v.version}
        </span>
        <span className="text-xs text-muted-foreground">{formatDate(v.fecha)}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{v.motivo}</p>
      <p className="mt-1 text-sm text-foreground">
        Monto: {formatMoneyFull(v.monto)} · Término: {formatDate(v.fechaTermino)}
      </p>
      {/* Cambio 5: catálogo snapshot de la versión */}
      {tieneCatalogo && (
        <div className="mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => setExpanded((x) => !x)}
          >
            {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
            {expanded ? "Ocultar catálogo" : `Ver catálogo (${v.catalogoConceptos!.length} conceptos)`}
          </Button>
          {expanded && (
            <div className="mt-2 overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Clave</TableHead>
                    <TableHead className="text-xs">Descripción</TableHead>
                    <TableHead className="text-xs text-right">Cantidad</TableHead>
                    <TableHead className="text-xs text-right">P.U.</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {v.catalogoConceptos!.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{c.clave}</TableCell>
                      <TableCell className="text-xs max-w-xs">{c.descripcion}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{c.cantidad.toLocaleString("es-MX")}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{formatCurrency(c.precioUnitario)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums font-medium">{formatCurrency(c.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
