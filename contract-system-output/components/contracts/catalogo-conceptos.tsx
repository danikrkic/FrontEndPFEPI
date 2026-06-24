"use client"

/**
 * Cambio 3 + Cambio 4:
 *  - Botón "Importar Excel" conectado a CatalogoImportDialog
 *  - Tabla delegada a CatalogoTable en modo "catalogo"
 */

import { useState } from "react"
import { Plus, Table2, Trash2 } from "lucide-react"
import type { ConceptoCatalogo, Contract } from "@/lib/types"
import { useApp, can } from "@/lib/store"
import { formatCurrency } from "@/lib/format"
import { CatalogoImportDialog } from "@/components/contracts/catalogo-import-dialog"
import { CatalogoTable } from "@/components/contracts/catalogo-table"
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

function uid() {
  return `cc-${Math.random().toString(36).slice(2, 8)}`
}

export function CatalogoConceptos({ contract }: { contract: Contract }) {
  const { user, setCatalogoConceptos } = useApp()
  const conceptos = contract.catalogoConceptos
  const puedeEditar = can(user?.role, "detalle.registrar")

  async function addConcepto(c: Omit<ConceptoCatalogo, "id" | "total">) {
    const nuevo: ConceptoCatalogo = {
      ...c,
      id: uid(),
      total: c.cantidad * c.precioUnitario,
    }
    try {
      await setCatalogoConceptos(contract.id, [...conceptos, nuevo])
      toast.success("Concepto agregado al catálogo")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo agregar el concepto")
    }
  }

  async function removeConcepto(id: string) {
    try {
      await setCatalogoConceptos(
        contract.id,
        conceptos.filter((c) => c.id !== id),
      )
      toast.success("Concepto eliminado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar el concepto")
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Table2 className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Catálogo de Conceptos</CardTitle>
        </div>
        {puedeEditar && (
          <div className="flex items-center gap-2">
            {/* Cambio 3: importar desde Excel */}
            <CatalogoImportDialog contract={contract} />
            <ConceptoDialog onAdd={addConcepto} />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {conceptos.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay conceptos registrados. Agrega conceptos manualmente o importa un Excel.
          </p>
        ) : (
          /* Cambio 4: tabla reutilizable en modo "catalogo" */
          <CatalogoTable
            conceptos={conceptos}
            modo={{ tipo: "catalogo" }}
            editable={puedeEditar}
            onChange={(nuevos) =>
              setCatalogoConceptos(contract.id, nuevos).catch((err) =>
                toast.error(err instanceof Error ? err.message : "No se pudo actualizar el catálogo"),
              )
            }
          />
        )}
        {/* Botón de eliminar conceptos individualmente (fuera de CatalogoTable para mantener la lógica aquí) */}
        {puedeEditar && conceptos.length > 0 && (
          <div className="mt-3 flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Eliminar concepto individual:</p>
            <div className="flex flex-wrap gap-2">
              {conceptos.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => removeConcepto(c.id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  {c.clave}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ConceptoDialog({
  onAdd,
}: {
  onAdd: (c: Omit<ConceptoCatalogo, "id" | "total">) => void
}) {
  const [open, setOpen] = useState(false)
  const [cantidad, setCantidad] = useState("")
  const [precio, setPrecio] = useState("")
  const [unidad, setUnidad] = useState("")
  const [unidadCustom, setUnidadCustom] = useState("")

  const unidades = ["m²", "m³", "ml", "kg", "ton", "pza", "lote", "servicio", "otro"]
  const unidadFinal = unidad === "otro" ? unidadCustom : unidad

  const totalPreview =
    cantidad && precio ? Number(cantidad) * Number(precio) : 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Agregar concepto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar concepto</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            onAdd({
              clave: String(fd.get("clave")),
              descripcion: String(fd.get("descripcion")),
              unidad: unidadFinal,
              cantidad: Number(fd.get("cantidad")),
              precioUnitario: Number(fd.get("precio")),
            })
            setCantidad("")
            setPrecio("")
            setUnidad("")
            setUnidadCustom("")
            setOpen(false)
          }}
          className="grid gap-3"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="clave">Clave</Label>
            <Input id="clave" name="clave" placeholder="CIM-001" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Input
              id="descripcion"
              name="descripcion"
              placeholder="Concepto de obra"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Unidad de medida</Label>
            <Select value={unidad} onValueChange={(v) => v && setUnidad(v)} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una unidad" />
              </SelectTrigger>
              <SelectContent>
                {unidades.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {unidad === "otro" && (
              <Input
                placeholder="Especifica la unidad"
                value={unidadCustom}
                onChange={(e) => setUnidadCustom(e.target.value)}
                required
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cantidad">Cantidad</Label>
              <Input
                id="cantidad"
                name="cantidad"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                required
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="precio">Precio unitario</Label>
              <Input
                id="precio"
                name="precio"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total calculado</span>
            <span className="font-semibold tabular-nums">
              {formatCurrency(totalPreview)}
            </span>
          </div>
          <DialogFooter>
            <Button type="submit">Agregar al catálogo</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
