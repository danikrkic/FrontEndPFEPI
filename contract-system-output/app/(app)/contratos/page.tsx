"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Eye, Pencil, Search } from "lucide-react"
import { useApp, can } from "@/lib/store"
import { formatMoney } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { NewContractDialog } from "@/components/contracts/new-contract-dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function ContratosPage() {
  const { contracts, user } = useApp()
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return contracts
    return contracts.filter(
      (c) =>
        c.noContrato.toLowerCase().includes(q) ||
        c.objeto.toLowerCase().includes(q) ||
        c.contratista.nombre.toLowerCase().includes(q),
    )
  }, [contracts, query])

  return (
    <div>
      <PageHeader
        title="Contratos"
        subtitle="Gestión de contratos de obra pública"
        action={can(user?.role, "contrato.crear") ? <NewContractDialog /> : null}
      />

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por número, objeto o contratista..."
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary hover:bg-primary">
              <TableHead className="text-primary-foreground">NO. CONTRATO</TableHead>
              <TableHead className="text-primary-foreground">OBJETO</TableHead>
              <TableHead className="text-primary-foreground">CONTRATISTA</TableHead>
              <TableHead className="text-primary-foreground">MONTO</TableHead>
              <TableHead className="text-primary-foreground">ESTADO</TableHead>
              <TableHead className="text-right text-primary-foreground">ACCIONES</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-foreground">{c.noContrato}</TableCell>
                <TableCell className="max-w-xs truncate text-foreground">{c.objeto}</TableCell>
                <TableCell className="text-muted-foreground">{c.contratista.nombre}</TableCell>
                <TableCell className="font-medium text-foreground">{formatMoney(c.monto)}</TableCell>
                <TableCell>
                  <StatusBadge status={c.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/contratos/${c.id}`}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label={`Ver contrato ${c.noContrato}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/contratos/${c.id}`}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label={`Editar contrato ${c.noContrato}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No se encontraron contratos.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
