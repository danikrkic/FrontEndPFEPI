"use client"

import { useMemo, useState, useEffect } from "react"
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

const NOTE_TYPES_BASE: NoteType[] = ["instruccion", "respuesta", "acuerdo", "observacion"]
const NOTE_TYPES_RESIDENTE: NoteType[] = [...NOTE_TYPES_BASE, "concepto_terminado"]

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
                  {NOTE_TYPES_RESIDENTE.map((t) => (
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
              {n.notaPadreNumero != null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  En respuesta a nota <span className="font-medium">#{n.notaPadreNumero}</span>
                </p>
              )}
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
              {n.fotos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {n.fotos.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block h-16 w-16 overflow-hidden rounded-md border border-border"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Fotografía ${i + 1} de la nota #${n.numero}`} className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
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
  onOpen: (id: string, nota: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
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
          onSubmit={async (e) => {
            e.preventDefault()
            const nota = String(new FormData(e.currentTarget).get("nota"))
            setSubmitting(true)
            try {
              await onOpen(contratoId, nota)
              toast.success("Bitácora aperturada correctamente")
              setOpen(false)
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "No se pudo aperturar la bitácora")
            } finally {
              setSubmitting(false)
            }
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
            <Button type="submit" disabled={submitting}>
              {submitting ? "Aperturando..." : "Aperturar"}
            </Button>
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
  const { user, bitacoras } = useApp()
  const bitacora = bitacoras.find((b) => b.contratoId === contract.id)
  const [open, setOpen] = useState(false)
  const [tipo, setTipo] = useState<NoteType>("instruccion")
  const [selectedConceptos, setSelectedConceptos] = useState<string[]>([])
  const [notaPadreId, setNotaPadreId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setTipo("instruccion")
      setSelectedConceptos([])
      setNotaPadreId(null)
    }
  }, [open])

  const notasReferenciables = useMemo(() => {
    if (!bitacora) return []
    if (tipo !== "respuesta" && tipo !== "acuerdo") return []
    return bitacora.notas
  }, [bitacora, tipo])

  const tiposDisponibles = user?.role === "residente" ? NOTE_TYPES_RESIDENTE : NOTE_TYPES_BASE

  const autorNombre = user?.name ?? ""
  const responsables = useMemo(() => {
    const lista = [
      { responsable: "Residente de Obra", nombre: contract.residente.nombre },
      { responsable: "Superintendente", nombre: contract.superintendente.nombre },
      { responsable: "Supervisión", nombre: contract.supervisor.nombre },
    ]
    return lista.filter((r) => r.nombre !== autorNombre)
  }, [contract, autorNombre])

  function toggleConcepto(id: string) {
    setSelectedConceptos((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PenLine className="h-4 w-4" />
          Registrar nota
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar nota en bitácora</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            if (!user) return
            if (tipo === "concepto_terminado" && selectedConceptos.length === 0) {
              toast.error("Selecciona al menos un concepto para este tipo de nota.")
              return
            }
            const fotos = (fd.getAll("fotos") as File[]).filter((f) => f.size > 0)
            setSubmitting(true)
            try {
              await addNote(
                contract.id,
                {
                  tipo,
                  contenido: String(fd.get("contenido")),
                  ...(tipo === "concepto_terminado" && { conceptos: selectedConceptos }),
                  ...((tipo === "respuesta" || tipo === "acuerdo") && notaPadreId
                    ? { notaPadreId }
                    : {}),
                },
                fotos.length > 0 ? fotos : undefined,
              )
              toast.success("Nota registrada con las firmas de los responsables")
              setOpen(false)
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "No se pudo registrar la nota")
            } finally {
              setSubmitting(false)
            }
          }}
          className="grid gap-3"
        >
          <div className="flex flex-col gap-2">
            <Label>Tipo de nota</Label>
            <Select value={tipo} onValueChange={(v) => { setTipo(v as NoteType); setSelectedConceptos([]) }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tiposDisponibles.map((t) => (
                  <SelectItem key={t} value={t}>
                    {NOTE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selector de nota padre: para respuesta/acuerdo (Punto K) */}
          {(tipo === "respuesta" || tipo === "acuerdo") && notasReferenciables.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>En respuesta a nota (opcional)</Label>
              <Select
                value={notaPadreId ?? "ninguna"}
                onValueChange={(v) => setNotaPadreId(v === "ninguna" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ninguna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguna">Ninguna</SelectItem>
                  {notasReferenciables.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      #{n.numero} · {NOTE_TYPE_LABELS[n.tipo]} — {n.contenido.slice(0, 50)}
                      {n.contenido.length > 50 ? "…" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Selector de conceptos: solo para concepto_terminado */}
          {tipo === "concepto_terminado" && contract.catalogoConceptos.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Conceptos terminados <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground">
                Selecciona los conceptos que han alcanzado el 100% de su cantidad contratada.
              </p>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border">
                {contract.catalogoConceptos.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-2 last:border-0 hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5"
                      checked={selectedConceptos.includes(c.id)}
                      onChange={() => toggleConcepto(c.id)}
                    />
                    <span className="text-xs font-medium">{c.clave}</span>
                    <span className="truncate text-xs text-muted-foreground">{c.descripcion}</span>
                  </label>
                ))}
              </div>
              {selectedConceptos.length === 0 && (
                <p className="text-xs text-destructive">Selecciona al menos un concepto.</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="contenido">Contenido</Label>
            <Textarea id="contenido" name="contenido" rows={4} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fotos">Fotografías (opcional)</Label>
            <Input id="fotos" name="fotos" type="file" accept="image/*" multiple />
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">
              La nota quedará firmada automáticamente por ti ({autorNombre}) y por{" "}
              {responsables.map((r) => r.nombre).join(", ")}, conforme a la LOPySRM.
            </p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Registrando..." : "Registrar nota"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
