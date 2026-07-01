"use client"

import { useState } from "react"
import type { Contract, TerminacionTipo } from "@/lib/types"
import { useApp } from "@/lib/store"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

export function TerminacionDialog({
  contract,
  disabled,
}: {
  contract: Contract
  disabled?: boolean
}) {
  const { terminarContrato } = useApp()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [tipo, setTipo] = useState<TerminacionTipo>("normal")
  const [fechaTerminacion, setFechaTerminacion] = useState(new Date().toISOString().split("T")[0])
  const [avanceFisicoFinal, setAvanceFisicoFinal] = useState<number>(100)
  const [notaCierre, setNotaCierre] = useState("")
  const [motivo, setMotivo] = useState("")

  const requiereMotivo = tipo === "anticipada" || tipo === "suspension"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!notaCierre.trim()) {
      toast.error("La nota de cierre es requerida.")
      return
    }
    if (requiereMotivo && !motivo.trim()) {
      toast.error("Se requiere el motivo para este tipo de terminación.")
      return
    }
    setLoading(true)
    try {
      await terminarContrato(contract.id, {
        tipo,
        fecha_terminacion: fechaTerminacion,
        avance_fisico_final: avanceFisicoFinal,
        nota_cierre: notaCierre,
        motivo: requiereMotivo ? motivo : undefined,
      })
      toast.success("Terminación registrada. El contrato ha pasado a estado En Cierre.")
      setOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrar la terminación."
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          Registrar terminación
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar terminación de trabajos</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo de terminación</Label>
            <Select
              value={tipo}
              onValueChange={(v) => {
                setTipo(v as TerminacionTipo)
                setMotivo("")
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="anticipada">Anticipada</SelectItem>
                <SelectItem value="suspension">Suspensión de obra</SelectItem>
              </SelectContent>
            </Select>
            {tipo === "normal" && (
              <p className="text-xs text-muted-foreground">
                Requiere avance físico del 100%.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Fecha de terminación</Label>
              <Input
                type="date"
                value={fechaTerminacion}
                onChange={(e) => setFechaTerminacion(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Avance físico final (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={avanceFisicoFinal}
                onChange={(e) => setAvanceFisicoFinal(parseFloat(e.target.value))}
                required
              />
            </div>
          </div>

          {requiereMotivo && (
            <div className="space-y-1.5">
              <Label>
                Motivo justificado <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="Describa el motivo de la terminación anticipada o suspensión..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>
              Nota de cierre <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Contenido de la nota que quedará asentada en la bitácora de obra..."
              value={notaCierre}
              onChange={(e) => setNotaCierre(e.target.value)}
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              Esta nota se asentará automáticamente en la bitácora con las firmas correspondientes.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Registrando…" : "Registrar terminación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
