"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { useApp } from "@/lib/store"
import type { Contratista, Persona } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const NUEVO = "__nuevo__"

export function NewContractDialog() {
  const {
    addContract,
    contratistas,
    residentes,
    supervisores,
    superintendentes,
    addContratista,
    addResidente,
    addSupervisor,
    addSuperintendente,
  } = useApp()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Selección de catálogos
  const [contratistaId, setContratistaId] = useState("")
  const [residenteId, setResidenteId] = useState("")
  const [supervisorId, setSupervisorId] = useState("")
  const [superintendenteId, setSuperintendenteId] = useState("")

  function reset() {
    setContratistaId("")
    setResidenteId("")
    setSupervisorId("")
    setSuperintendenteId("")
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setSubmitting(true)
    try {
      // Contratista: existente o nuevo
      let contratista: Contratista | undefined
      if (contratistaId === NUEVO) {
        const nombre = String(fd.get("ctNombre")).trim()
        if (!nombre) return toast.error("Captura el nombre del contratista")
        contratista = await addContratista({
          nombre,
          rfc: String(fd.get("ctRfc")),
          representante: String(fd.get("ctRep")),
          telefono: String(fd.get("ctTel")),
          correo: String(fd.get("ctCorreo")),
        })
      } else {
        contratista = contratistas.find((c) => c.id === contratistaId)
      }
      if (!contratista) return toast.error("Selecciona o registra un contratista")

      // Residente: existente o nuevo
      let residente: Persona | undefined
      if (residenteId === NUEVO) {
        const nombre = String(fd.get("rNombre")).trim()
        if (!nombre) return toast.error("Captura el nombre del residente")
        residente = await addResidente({
          nombre,
          rfc: String(fd.get("rRfc")),
          telefono: String(fd.get("rTel")),
          correo: String(fd.get("rCorreo")),
        })
      } else {
        residente = residentes.find((r) => r.id === residenteId)
      }
      if (!residente) return toast.error("Asigna un residente de obra")

      // Supervisor: existente o nuevo
      let supervisor: Persona | undefined
      if (supervisorId === NUEVO) {
        const nombre = String(fd.get("sNombre")).trim()
        if (!nombre) return toast.error("Captura el nombre del supervisor")
        supervisor = await addSupervisor({
          nombre,
          rfc: String(fd.get("sRfc")),
          telefono: String(fd.get("sTel")),
          correo: String(fd.get("sCorreo")),
        })
      } else {
        supervisor = supervisores.find((s) => s.id === supervisorId)
      }
      if (!supervisor) return toast.error("Asigna un supervisor")

      // Superintendente: existente o nuevo
      let superintendente: Persona | undefined
      if (superintendenteId === NUEVO) {
        const nombre = String(fd.get("siNombre")).trim()
        if (!nombre) return toast.error("Captura el nombre del superintendente")
        superintendente = await addSuperintendente({
          nombre,
          rfc: String(fd.get("siRfc")),
          telefono: String(fd.get("siTel")),
          correo: String(fd.get("siCorreo")),
        })
      } else {
        superintendente = superintendentes.find((s) => s.id === superintendenteId)
      }
      if (!superintendente) return toast.error("Asigna un superintendente")

      await addContract({
        noContrato: String(fd.get("noContrato")),
        objeto: String(fd.get("objeto")),
        descripcion: String(fd.get("descripcion")),
        monto: Number(fd.get("monto")),
        plazoDias: Number(fd.get("plazoDias")),
        fechaInicio: String(fd.get("fechaInicio")),
        fechaTermino: String(fd.get("fechaTermino")),
        ubicacion: String(fd.get("ubicacion")),
        status: "registrado",
        contratista,
        residente,
        supervisor,
        superintendente,
      })
      toast.success("Contrato registrado correctamente")
      reset()
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar el contrato")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Nuevo Contrato
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar nuevo contrato</DialogTitle>
          <DialogDescription>
            Captura los datos del contrato de obra pública. El número de contrato
            debe ser único.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="No. de Contrato" name="noContrato" placeholder="GACM-2024-005" required />
            <Field label="Monto (MXN)" name="monto" type="number" placeholder="1000000" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="objeto">Objeto</Label>
            <Input id="objeto" name="objeto" placeholder="Construcción de..." required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea id="descripcion" name="descripcion" rows={2} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Plazo (días)" name="plazoDias" type="number" placeholder="365" required />
            <Field label="Fecha inicio" name="fechaInicio" type="date" required />
            <Field label="Fecha término" name="fechaTermino" type="date" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ubicacion">Ubicación de la obra</Label>
            <Input id="ubicacion" name="ubicacion" placeholder="Zona, municipio, estado" required />
          </div>

          {/* Datos del contratista */}
          <p className="mt-2 text-sm font-semibold text-foreground">
            Datos del contratista
          </p>
          <div className="flex flex-col gap-2">
            <Label>Contratista</Label>
            <Select value={contratistaId} onValueChange={(v) => v && setContratistaId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un contratista preregistrado">
                  {(v: string) =>
                    v === NUEVO
                      ? "Registrar nuevo contratista"
                      : contratistas.find((c) => c.id === v)?.nombre ?? ""
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {contratistas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre} — {c.rfc}
                  </SelectItem>
                ))}
                <SelectItem value={NUEVO}>+ Registrar nuevo contratista</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {contratistaId === NUEVO && (
            <div className="grid gap-4 rounded-lg border border-border bg-muted/40 p-4 sm:grid-cols-2">
              <Field label="Nombre / Razón social" name="ctNombre" required />
              <Field label="RFC" name="ctRfc" required />
              <Field label="Representante" name="ctRep" required />
              <Field label="Teléfono" name="ctTel" type="tel" required />
              <div className="sm:col-span-2">
                <Field label="Correo electrónico" name="ctCorreo" type="email" required />
              </div>
            </div>
          )}

          {/* Asignación de residente */}
          <p className="mt-2 text-sm font-semibold text-foreground">
            Residente de obra
          </p>
          <PersonPicker
            value={residenteId}
            onChange={setResidenteId}
            people={residentes}
            placeholder="Asigna un residente"
            nuevoLabel="+ Registrar nuevo residente"
            prefix="r"
          />

          {/* Asignación de supervisor */}
          <p className="mt-2 text-sm font-semibold text-foreground">Supervisor</p>
          <PersonPicker
            value={supervisorId}
            onChange={setSupervisorId}
            people={supervisores}
            placeholder="Asigna un supervisor"
            nuevoLabel="+ Registrar nuevo supervisor"
            prefix="s"
          />

          {/* Asignación de superintendente */}
          <p className="mt-2 text-sm font-semibold text-foreground">Superintendente</p>
          <PersonPicker
            value={superintendenteId}
            onChange={setSuperintendenteId}
            people={superintendentes}
            placeholder="Asigna un superintendente"
            nuevoLabel="+ Registrar nuevo superintendente"
            prefix="si"
          />

          <DialogFooter className="mt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Registrando..." : "Registrar contrato"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PersonPicker({
  value,
  onChange,
  people,
  placeholder,
  nuevoLabel,
  prefix,
}: {
  value: string
  onChange: (v: string) => void
  people: Persona[]
  placeholder: string
  nuevoLabel: string
  prefix: string
}) {
  return (
    <>
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder}>
            {(v: string) =>
              v === NUEVO
                ? nuevoLabel.replace("+ ", "")
                : people.find((p) => p.id === v)?.nombre ?? ""
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {people.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.nombre} — {p.rfc}
            </SelectItem>
          ))}
          <SelectItem value={NUEVO}>{nuevoLabel}</SelectItem>
        </SelectContent>
      </Select>
      {value === NUEVO && (
        <div className="grid gap-4 rounded-lg border border-border bg-muted/40 p-4 sm:grid-cols-2">
          <Field label="Nombre completo" name={`${prefix}Nombre`} required />
          <Field label="RFC" name={`${prefix}Rfc`} required />
          <Field label="Teléfono" name={`${prefix}Tel`} type="tel" required />
          <Field label="Correo electrónico" name={`${prefix}Correo`} type="email" required />
        </div>
      )}
    </>
  )
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} placeholder={placeholder} required={required} />
    </div>
  )
}
