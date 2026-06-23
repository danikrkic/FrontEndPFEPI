"use client"

import { useMemo, useState } from "react"
import { BookOpen, PenLine } from "lucide-react"
import type { Contract, NoteType } from "@/lib/types"
import { NOTE_TYPE_LABELS, ROLE_LABELS } from "@/lib/types"
import { useApp, can } from "@/lib/store"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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

const NOTE_TYPES: NoteType[] = ["instruccion", "respuesta", "acuerdo", "observacion"]

/**
 * Verifica si el usuario actualmente logueado es el residente asignado
 * a este contrato. El link entre User y Persona se establece via user.personaId.
 */
function isResidendeAsignado(user: ReturnType<typeof useApp>["user"], contract: Contract) {
  if (!user || user.role !== "residente") return false
  if (!user.personaId) return false
  return user.personaId === contract.residente.id
}

export function BitacoraPanel({ contract }: { contract: Contract }) {
  const { bitacoras, user, openBitacora, addNote } = useApp()
  const bitacora = bitacoras.find((b) => b.contratoId === contract.id)
  const abierta = bitacora?.abierta ?? false

  const esResidendeDelContrato = isResidendeAsignado(user, contract)
  const puedeAbrir =
    can(user?.role, "bitacora.abrir") &&
    contract.status === "activo" &&
    esResidendeDelContrato

  const [filterTipo, setFilterTipo] = useState<string>("todos")
  const [filterDesde, setFilterDesde] = useState<string>("")
  const [filterHasta, setFilterHasta] = useState<string>("")

  const notasFiltradas = useMemo(() => {
    if (!bitacora) return []
    return bitacora.notas.filter((n) => {
      if (filterTipo !== "todos" && n.tipo !== filterTipo) return false
      if (filterDesde && n.fecha < filterDesde) return false
      if (filterHasta && n.fecha > filterHasta) return false
      return true
    })
  }, [bitacora, filterTipo, filterDesde, filterHasta])

  if (!abierta) {
    let mensaje = ""
    if (contract.status !== "activo") {
      mensaje = "El contrato debe estar activo para aperturar la bitácora."
    } else if (user?.role !== "residente") {
      mensaje = "Solo el residente de obra asignado puede aperturar la bitácora."
    } else if (!esResidendeDelContrato) {
      mensaje = `Solo el residente asignado (${contract.residente.nombre}) puede aperturar esta bitácora.`
    }

    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <BookOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Bitácora no aperturada</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              La bitácora de obra solo puede aperturarse para contratos activos por el
              residente de obra asignado, registrando la nota de apertura conforme a la LOPySRM.
            </p>
          </div>
          {puedeAbrir ? (
            <AperturaDialog contratoId={contract.id} onOpen={openBitacora} />
          ) : (
            <p className="text-xs text-muted-foreground">{mensaje}</p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nota de apertura</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Aperturada el {formatDate(bitacora!.fechaApertura!)}
          </p>
          <p className="mt-2 text-sm text-foreground">{bitacora!.notaApertura}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-4 py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Tipo de nota</Label>
              <Select value={filterTipo} onValueChange={(v) => v && setFilterTipo(v)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  {NOTE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {NOTE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs" htmlFor="f-desde">
                Desde
              </Label>
              <Input
                id="f-desde"
                type="date"
                className="w-40"
                value={filterDesde}
                onChange={(e) => setFilterDesde(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs" htmlFor="f-hasta">
                Hasta
              </Label>
              <Input
                id="f-hasta"
                type="date"
                className="w-40"
                value={filterHasta}
                onChange={(e) => setFilterHasta(e.target.value)}
              />
            </div>
            {(filterTipo !== "todos" || filterDesde || filterHasta) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterTipo("todos")
                  setFilterDesde("")
                  setFilterHasta("")
                }}
              >
                Limpiar
              </Button>
            )}
          </div>
          {can(user?.role, "bitacora.notear") ? (
            <NotaDialog contract={contract} addNote={addNote} />
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {notasFiltradas.map((n) => (
          <Card key={n.id}>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                    #{n.numero}
                  </span>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {NOTE_TYPE_LABELS[n.tipo]}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(n.fecha)}</span>
              </div>
              <p className="mt-2 text-sm text-foreground">{n.contenido}</p>
              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Firmas de los responsables
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {n.firmas.map((f, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-border bg-muted/40 px-3 py-2"
                    >
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {f.responsable}
                      </p>
                      <p className="text-sm font-medium text-foreground">{f.nombre}</p>
                      <p className="font-mono text-xs italic text-muted-foreground">
                        {f.firma}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Autor: {n.autor} · {ROLE_LABELS[n.rol]}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
        {notasFiltradas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay notas registradas con este criterio.
          </p>
        ) : null}
      </div>
    </div>
  )
}

function AperturaDialog({
  contratoId,
  onOpen,
}: {
  contratoId: string
  onOpen: (id: string, nota: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <BookOpen className="h-4 w-4" />
          Aperturar bitácora
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aperturar bitácora de obra</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const nota = String(new FormData(e.currentTarget).get("nota"))
            onOpen(contratoId, nota)
            toast.success("Bitácora aperturada correctamente")
            setOpen(false)
          }}
          className="grid gap-3"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="nota">Nota de apertura</Label>
            <Textarea
              id="nota"
              name="nota"
              rows={4}
              required
              defaultValue="Se apertura la bitácora de obra conforme a lo establecido en la LOPySRM."
            />
          </div>
          <DialogFooter>
            <Button type="submit">Aperturar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function NotaDialog({
  contract,
  addNote,
}: {
  contract: Contract
  addNote: ReturnType<typeof useApp>["addNote"]
}) {
  const { user } = useApp()
  const [open, setOpen] = useState(false)
  const [tipo, setTipo] = useState<NoteType>("instruccion")

  const autorNombre = user?.name ?? ""
  const responsables = useMemo(() => {
    const lista = [
      { responsable: "Residente de Obra", nombre: contract.residente.nombre },
      { responsable: "Supervisión", nombre: contract.supervisor.nombre },
    ]
    return lista.filter((r) => r.nombre !== autorNombre)
  }, [contract, autorNombre])

  const sugerirFirma = (nombre: string) =>
    nombre
      .split(" ")
      .map((p, i) => (i === 0 ? p[0] + "." : p))
      .join(" ")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PenLine className="h-4 w-4" />
          Registrar nota
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar nota en bitácora</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            if (!user) return
            const firmas = [
              {
                responsable: "Autor",
                nombre: autorNombre,
                firma: String(fd.get("firma-autor")),
              },
              ...responsables.map((r, i) => ({
                responsable: r.responsable,
                nombre: r.nombre,
                firma: String(fd.get(`firma-${i}`)),
              })),
            ]
            addNote(contract.id, {
              tipo,
              contenido: String(fd.get("contenido")),
              autor: autorNombre,
              rol: user.role,
              fecha: new Date().toISOString().slice(0, 10),
              firmas,
            })
            toast.success("Nota registrada con las firmas de los responsables")
            setOpen(false)
          }}
          className="grid gap-3"
        >
          <div className="flex flex-col gap-2">
            <Label>Tipo de nota</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as NoteType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {NOTE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contenido">Contenido</Label>
            <Textarea id="contenido" name="contenido" rows={4} required />
          </div>

          <div className="rounded-md border border-border p-3">
            <p className="mb-2 text-sm font-medium text-foreground">
              Firmas de los responsables
            </p>
            <div className="grid gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs" htmlFor="firma-autor">
                  Autor — {autorNombre}
                </Label>
                <Input
                  id="firma-autor"
                  name="firma-autor"
                  required
                  defaultValue={sugerirFirma(autorNombre)}
                />
              </div>
              {responsables.map((r, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Label className="text-xs" htmlFor={`firma-${i}`}>
                    {r.responsable} — {r.nombre}
                  </Label>
                  <Input
                    id={`firma-${i}`}
                    name={`firma-${i}`}
                    required
                    defaultValue={sugerirFirma(r.nombre)}
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit">Registrar nota</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
