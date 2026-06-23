"use client"

import { useState } from "react"
import { Download, FileText, Upload } from "lucide-react"
import type { Contract, DocBlock } from "@/lib/types"
import { DOC_BLOCK_LABELS } from "@/lib/types"
import { useApp, can } from "@/lib/store"
import { formatDate } from "@/lib/format"
import { CatalogoConceptos } from "@/components/contracts/catalogo-conceptos"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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
import { toast } from "sonner"

// Cambio 1: fianzas y garantias eliminados — los documentos de garantía
// viven dentro de cada Garantia.documento (ver garantias-panel.tsx)
const BLOCKS: DocBlock[] = [
  "contrato",
  "catalogo",
  "programa",
  "juridico",
]

export function DocumentosPanel({ contract }: { contract: Contract }) {
  const { user } = useApp()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Documentación contractual organizada por bloque de información.
        </p>
        {can(user?.role, "detalle.registrar") ? (
          <UploadDialog contract={contract} />
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {BLOCKS.map((block) => {
          const docs = contract.documentos.filter((d) => d.bloque === block)
          return (
            <Card key={block}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{DOC_BLOCK_LABELS[block]}</CardTitle>
                  <span
                    className={
                      docs.length
                        ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                        : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                    }
                  >
                    {docs.length ? `${docs.length} doc.` : "Sin documentos"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 pt-0">
                {docs.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{d.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.formato} · {d.tamano} · {formatDate(d.fecha)}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      aria-label={`Descargar ${d.nombre}`}
                      onClick={() => toast.success(`Descargando ${d.nombre}`)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {docs.length === 0 ? (
                  <p className="py-2 text-xs text-muted-foreground">
                    No hay documentos en este bloque.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <CatalogoConceptos contract={contract} />
    </div>
  )
}

function UploadDialog({ contract }: { contract: Contract }) {
  const { addDocument, user } = useApp()
  const [open, setOpen] = useState(false)
  const [bloque, setBloque] = useState<DocBlock>("contrato")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4" />
          Cargar documento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cargar documento contractual</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const nombre = String(fd.get("nombre"))
            const ext = nombre.split(".").pop()?.toUpperCase() ?? "PDF"
            addDocument(contract.id, {
              id: `d-${Math.random().toString(36).slice(2, 8)}`,
              bloque,
              nombre,
              formato: ext,
              tamano: String(fd.get("tamano") || "1.0 MB"),
              fecha: new Date().toISOString().slice(0, 10),
              subidoPor: user?.name ?? "",
            })
            toast.success("Documento cargado")
            setOpen(false)
          }}
          className="grid gap-3"
        >
          <div className="flex flex-col gap-2">
            <Label>Bloque de información</Label>
            <Select value={bloque} onValueChange={(v) => setBloque(v as DocBlock)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLOCKS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {DOC_BLOCK_LABELS[b]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {bloque === "catalogo" ? (
            <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Para el catálogo de conceptos también puedes capturarlo como tabla
              (clave, descripción, cantidad, precio unitario y total) desde la sección
              "Catálogo de Conceptos" al pie de esta página.
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre">Nombre del archivo</Label>
            <Input id="nombre" name="nombre" placeholder="documento.pdf" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tamano">Tamaño</Label>
            <Input id="tamano" name="tamano" placeholder="1.2 MB" />
          </div>
          <DialogFooter>
            <Button type="submit">Cargar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
