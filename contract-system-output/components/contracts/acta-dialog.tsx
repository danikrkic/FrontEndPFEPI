"use client"

import { useRef, useState } from "react"
import type { Contract } from "@/lib/types"
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
import { toast } from "sonner"

export function ActaDialog({ contract }: { contract: Contract }) {
  const { cargarActa } = useApp()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fechaFirma, setFechaFirma] = useState(new Date().toISOString().split("T")[0])
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const archivo = fileRef.current?.files?.[0]
    if (!archivo) {
      toast.error("Seleccione el archivo del acta.")
      return
    }
    setLoading(true)
    try {
      await cargarActa(contract.id, archivo, fechaFirma)
      toast.success("Acta de entrega-recepción cargada correctamente.")
      setOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cargar el acta."
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Cargar acta de entrega-recepción
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cargar acta de entrega-recepción</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Fecha de firma del acta</Label>
            <Input
              type="date"
              value={fechaFirma}
              onChange={(e) => setFechaFirma(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Archivo del acta (PDF, imagen)</Label>
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png" ref={fileRef} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Cargando…" : "Cargar acta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
