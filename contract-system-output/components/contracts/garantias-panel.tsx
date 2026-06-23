"use client"

import { useState } from "react"
import { ShieldCheck, Plus, FileText, Download } from "lucide-react"
import type { Contract, Garantia, GarantiaTipo } from "@/lib/types"
import { GARANTIA_TIPO_LABELS, calcularGarantiaStatus } from "@/lib/types"
import { useApp, can } from "@/lib/store"
import { formatCurrency, formatDate } from "@/lib/format"
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

const GARANTIA_TIPOS: GarantiaTipo[] = ["cumplimiento", "anticipo", "vicios_ocultos"]

const GARANTIA_BADGE: Record<GarantiaTipo, string> = {
  cumplimiento: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  anticipo: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  vicios_ocultos: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
}

// Cambio 1: badge de status calculado
const STATUS_BADGE: Record<string, string> = {
  vigente: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  por_vencer: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  vencida: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  liberada: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

const STATUS_LABELS: Record<string, string> = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencida: "Vencida",
  liberada: "Liberada",
}

function getStatusEfectivo(g: Garantia) {
  if (g.status === "liberada") return "liberada"
  return calcularGarantiaStatus(g.fechaVigencia)
}

export function GarantiasPanel({ contract }: { contract: Contract }) {
  const { user, garantias, addGarantia, garantiasTiposUsados } = useApp()
  const puedeRegistrar = can(user?.role, "garantia.registrar")

  const garantiasContrato = garantias.filter((g) => g.contratoId === contract.id)
  const tiposUsados = garantiasTiposUsados(contract.id)
  const tiposDisponibles = GARANTIA_TIPOS.filter((t) => !tiposUsados.has(t))
  const todasRegistradas = tiposDisponibles.length === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Garantías del contrato</h3>
          <p className="text-sm text-muted-foreground">
            Cada contrato puede tener hasta 3 garantías: cumplimiento, anticipo y
            vicios ocultos. El estado se calcula automáticamente según la fecha de vigencia.
          </p>
        </div>
        {puedeRegistrar && !todasRegistradas && (
          <NuevaGarantiaDialog
            contract={contract}
            tiposDisponibles={tiposDisponibles}
            onAdd={addGarantia}
          />
        )}
        {puedeRegistrar && todasRegistradas && (
          <p className="text-xs text-muted-foreground">
            Todas las garantías han sido registradas.
          </p>
        )}
      </div>

      {garantiasContrato.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ShieldCheck className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Sin garantías registradas</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Las garantías de cumplimiento, anticipo y vicios ocultos deben
                registrarse al inicio del contrato.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {garantiasContrato.map((g) => {
            const statusEfectivo = getStatusEfectivo(g)
            return (
              <Card key={g.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${GARANTIA_BADGE[g.tipo]}`}
                    >
                      {GARANTIA_TIPO_LABELS[g.tipo]}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[statusEfectivo]}`}
                    >
                      {STATUS_LABELS[statusEfectivo]}
                    </span>
                  </div>
                  <CardTitle className="mt-2 text-lg">{formatCurrency(g.monto)}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <p className="text-xs font-medium text-foreground">{g.institucionAfianzadora}</p>
                  <p className="text-xs">Póliza: {g.numeroPoliza}</p>
                  <p className="text-xs">Emisión: {formatDate(g.fechaEmision)}</p>
                  <p className="text-xs">Vigencia: {formatDate(g.fechaVigencia)}</p>
                  <p className="text-xs mt-2">
                    Registrada el {formatDate(g.fechaRegistro)} por {g.registradoPor}
                  </p>
                  {/* Documento de la póliza */}
                  {g.documento ? (
                    <div className="mt-2 flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-xs">{g.documento.nombre}</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                        onClick={() => toast.success(`Descargando ${g.documento!.nombre}`)}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 mt-1">Sin póliza digitalizada</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
          {/* Slots vacíos para tipos no registrados */}
          {tiposDisponibles.map((t) => (
            <Card
              key={t}
              className="border-dashed border-muted-foreground/30 bg-muted/20"
            >
              <CardContent className="flex h-full flex-col items-center justify-center py-10 text-center">
                <ShieldCheck className="mb-2 h-6 w-6 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">
                  {GARANTIA_TIPO_LABELS[t]}
                </p>
                <p className="text-xs text-muted-foreground/60">Pendiente de registro</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function NuevaGarantiaDialog({
  contract,
  tiposDisponibles,
  onAdd,
}: {
  contract: Contract
  tiposDisponibles: GarantiaTipo[]
  onAdd: ReturnType<typeof useApp>["addGarantia"]
}) {
  const { user } = useApp()
  const [open, setOpen] = useState(false)
  const [tipo, setTipo] = useState<GarantiaTipo>(tiposDisponibles[0] ?? "cumplimiento")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Registrar garantía
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar garantía / póliza de fianza</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            onAdd({
              contratoId: contract.id,
              tipo,
              institucionAfianzadora: String(fd.get("institucion")),
              numeroPoliza: String(fd.get("poliza")),
              monto: parseFloat(String(fd.get("monto"))) || 0,
              fechaEmision: String(fd.get("fechaEmision")),
              fechaVigencia: String(fd.get("fechaVigencia")),
              status: "vigente",
              documento: null,
              fechaRegistro: new Date().toISOString().slice(0, 10),
              registradoPor: user?.name ?? "",
            })
            toast.success("Garantía registrada")
            setOpen(false)
          }}
          className="grid gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label>Tipo de garantía</Label>
            <Select
              value={tipo}
              onValueChange={(v) => setTipo(v as GarantiaTipo)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tiposDisponibles.map((t) => (
                  <SelectItem key={t} value={t}>
                    {GARANTIA_TIPO_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="institucion">Institución afianzadora</Label>
            <Input
              id="institucion"
              name="institucion"
              required
              placeholder="Ej. Afianzadora Insurgentes S.A."
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="poliza">Número de póliza</Label>
            <Input
              id="poliza"
              name="poliza"
              required
              placeholder="Ej. AI-2024-00123"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="monto">Monto (MXN)</Label>
            <Input
              id="monto"
              name="monto"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fechaEmision">Fecha de emisión</Label>
              <Input id="fechaEmision" name="fechaEmision" type="date" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fechaVigencia">Fecha de vigencia</Label>
              <Input id="fechaVigencia" name="fechaVigencia" type="date" required />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit">Registrar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
