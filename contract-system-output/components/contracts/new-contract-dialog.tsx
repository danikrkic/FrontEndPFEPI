"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { useApp } from "@/lib/store"
import type { Contratista, EmpresaSupervision, Persona } from "@/lib/types"
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
    empresasSupervision,
    residentes,
    addContratista,
    addEmpresaSupervision,
    addResidente,
    addSupervisor,
    addSuperintendente,
  } = useApp()

  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [contratistaId, setContratistaId] = useState("")
  const [empresaSupervisionId, setEmpresaSupervisionId] = useState("")
  const [residenteId, setResidenteId] = useState("")
  const [supervisorId, setSupervisorId] = useState("")
  const [superintendenteId, setSuperintendenteId] = useState("")
  const [fechaInicio, setFechaInicio] = useState("")
  const [plazoDias, setPlazoDias] = useState("")

  const fechaTerminoCalc = calcFechaTermino(fechaInicio, plazoDias)
  const hoy = new Date().toISOString().split("T")[0]
  const esRetroactivo = !!fechaInicio && fechaInicio < hoy

  const selectedContratista = contratistas.find((c) => c.id === contratistaId)
  const selectedEmpresaSup = empresasSupervision.find((e) => e.id === empresaSupervisionId)
  const superintendentesDisponibles = selectedContratista?.superintendentes ?? []
  const supervisoresDisponibles = selectedEmpresaSup?.supervisores ?? []

  function reset() {
    setContratistaId("")
    setEmpresaSupervisionId("")
    setResidenteId("")
    setSupervisorId("")
    setSuperintendenteId("")
    setFechaInicio("")
    setPlazoDias("")
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setSubmitting(true)
    try {
      // ── Contratista ───────────────────────────────────────────────────────
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

      // ── Superintendente (vinculado al contratista) ────────────────────────
      let superintendente: Persona | undefined
      if (superintendenteId === NUEVO) {
        const nombre = String(fd.get("siNombre")).trim()
        if (!nombre) return toast.error("Captura el nombre del superintendente")
        superintendente = await addSuperintendente(
          { nombre, rfc: String(fd.get("siRfc")), telefono: String(fd.get("siTel")), correo: String(fd.get("siCorreo")) },
          contratista.id,
        )
      } else {
        superintendente = superintendentesDisponibles.find((p) => p.id === superintendenteId)
      }
      if (!superintendente) return toast.error("Asigna un superintendente")

      // ── Empresa de Supervisión ────────────────────────────────────────────
      let empresaSup: EmpresaSupervision | undefined
      if (empresaSupervisionId === NUEVO) {
        const nombre = String(fd.get("esNombre")).trim()
        if (!nombre) return toast.error("Captura el nombre de la empresa de supervisión")
        empresaSup = await addEmpresaSupervision({
          nombre,
          rfc: String(fd.get("esRfc")),
          representante: String(fd.get("esRep")),
          telefono: String(fd.get("esTel")),
          correo: String(fd.get("esCorreo")),
        })
      } else {
        empresaSup = empresasSupervision.find((e) => e.id === empresaSupervisionId)
      }
      if (!empresaSup) return toast.error("Selecciona o registra una empresa de supervisión")

      // ── Supervisor (vinculado a la empresa de supervisión) ────────────────
      let supervisor: Persona | undefined
      if (supervisorId === NUEVO) {
        const nombre = String(fd.get("sNombre")).trim()
        if (!nombre) return toast.error("Captura el nombre del supervisor")
        supervisor = await addSupervisor(
          { nombre, rfc: String(fd.get("sRfc")), telefono: String(fd.get("sTel")), correo: String(fd.get("sCorreo")) },
          empresaSup.id,
        )
      } else {
        supervisor = supervisoresDisponibles.find((p) => p.id === supervisorId)
      }
      if (!supervisor) return toast.error("Asigna un supervisor")

      // ── Residente (de la dependencia) ─────────────────────────────────────
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

      if (residente.id === supervisor?.id) {
        return toast.error("El supervisor no puede ser la misma persona que el residente.")
      }

      await addContract({
        noContrato: String(fd.get("noContrato")),
        objeto: String(fd.get("objeto")),
        descripcion: String(fd.get("descripcion")),
        monto: Number(fd.get("monto")),
        plazoDias: Number(plazoDias),
        fechaInicio,
        fechaTermino: fechaTerminoCalc,
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
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
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
            Captura los datos del contrato de obra pública. El número de contrato debe ser único.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          {/* ── Datos generales ── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="No. de Contrato" name="noContrato" placeholder="GACM-2024-005" required />
            <Field label="Monto (MXN)" name="monto" type="number" placeholder="1000000" required />
          </div>
          <Field label="Objeto" name="objeto" placeholder="Construcción de..." required />
          <div className="flex flex-col gap-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea id="descripcion" name="descripcion" rows={2} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="plazoDias">Plazo (días)</Label>
              <Input
                id="plazoDias"
                name="plazoDias"
                type="number"
                placeholder="365"
                required
                value={plazoDias}
                onChange={(e) => setPlazoDias(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fechaInicio">Fecha inicio</Label>
              <Input
                id="fechaInicio"
                name="fechaInicio"
                type="date"
                required
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Fecha término</Label>
              <p className="flex h-9 items-center rounded-md border border-border bg-muted/50 px-3 text-sm text-muted-foreground">
                {fechaTerminoCalc || "—"}
              </p>
            </div>
          </div>
          {esRetroactivo && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              La fecha de inicio es anterior a hoy. ¿Es un contrato retroactivo?
            </p>
          )}
          <Field label="Ubicación de la obra" name="ubicacion" placeholder="Zona, municipio, estado" required />

          {/* ── Empresa Contratista ── */}
          <SectionTitle>Empresa Contratista</SectionTitle>
          <CatalogoPicker
            value={contratistaId}
            onChange={(v) => { setContratistaId(v); setSuperintendenteId("") }}
            items={contratistas}
            placeholder="Selecciona una empresa contratista"
            nuevoLabel="+ Registrar nueva empresa contratista"
          >
            {contratistaId === NUEVO && (
              <EmpresaForm prefix="ct" />
            )}
          </CatalogoPicker>

          {/* ── Superintendente ── */}
          <SectionTitle>Superintendente</SectionTitle>
          <p className="text-xs text-muted-foreground -mt-2">
            {contratistaId && contratistaId !== NUEVO
              ? `Mostrando superintendentes de ${selectedContratista?.nombre}`
              : "Selecciona primero una empresa contratista"}
          </p>
          <PersonPicker
            value={superintendenteId}
            onChange={setSuperintendenteId}
            people={superintendentesDisponibles}
            placeholder="Selecciona un superintendente"
            nuevoLabel="+ Registrar nuevo superintendente"
            prefix="si"
            disabled={!contratistaId || contratistaId === NUEVO}
          />

          {/* ── Empresa de Supervisión ── */}
          <SectionTitle>Empresa de Supervisión</SectionTitle>
          <CatalogoPicker
            value={empresaSupervisionId}
            onChange={(v) => { setEmpresaSupervisionId(v); setSupervisorId("") }}
            items={empresasSupervision}
            placeholder="Selecciona una empresa de supervisión"
            nuevoLabel="+ Registrar nueva empresa de supervisión"
          >
            {empresaSupervisionId === NUEVO && (
              <EmpresaForm prefix="es" />
            )}
          </CatalogoPicker>

          {/* ── Supervisor ── */}
          <SectionTitle>Supervisor</SectionTitle>
          <p className="text-xs text-muted-foreground -mt-2">
            {empresaSupervisionId && empresaSupervisionId !== NUEVO
              ? `Mostrando supervisores de ${selectedEmpresaSup?.nombre}`
              : "Selecciona primero una empresa de supervisión"}
          </p>
          <PersonPicker
            value={supervisorId}
            onChange={setSupervisorId}
            people={supervisoresDisponibles}
            placeholder="Selecciona un supervisor"
            nuevoLabel="+ Registrar nuevo supervisor"
            prefix="s"
            disabled={!empresaSupervisionId || empresaSupervisionId === NUEVO}
          />

          {/* ── Residente de Obra ── */}
          <SectionTitle>Residente de Obra</SectionTitle>
          <p className="text-xs text-muted-foreground -mt-2">
            Residentes de la dependencia
          </p>
          <PersonPicker
            value={residenteId}
            onChange={setResidenteId}
            people={residentes}
            placeholder="Asigna un residente de obra"
            nuevoLabel="+ Registrar nuevo residente"
            prefix="r"
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

function calcFechaTermino(fechaInicio: string, plazoDias: string): string {
  if (!fechaInicio || !plazoDias) return ""
  const dias = parseInt(plazoDias, 10)
  if (isNaN(dias) || dias <= 0) return ""
  const d = new Date(fechaInicio + "T12:00:00")
  d.setDate(d.getDate() + dias)
  return d.toISOString().split("T")[0]
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm font-semibold text-foreground">{children}</p>
}

function CatalogoPicker({
  value,
  onChange,
  items,
  placeholder,
  nuevoLabel,
  children,
}: {
  value: string
  onChange: (v: string) => void
  items: Array<{ id: string; nombre: string; rfc: string }>
  placeholder: string
  nuevoLabel: string
  children?: React.ReactNode
}) {
  return (
    <>
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.id} value={i.id}>
              {i.nombre} — {i.rfc}
            </SelectItem>
          ))}
          <SelectItem value={NUEVO}>{nuevoLabel}</SelectItem>
        </SelectContent>
      </Select>
      {children}
    </>
  )
}

function EmpresaForm({ prefix }: { prefix: string }) {
  return (
    <div className="grid gap-4 rounded-lg border border-border bg-muted/40 p-4 sm:grid-cols-2">
      <Field label="Nombre / Razón social" name={`${prefix}Nombre`} required />
      <Field label="RFC" name={`${prefix}Rfc`} required />
      <Field label="Representante legal" name={`${prefix}Rep`} required />
      <Field label="Teléfono" name={`${prefix}Tel`} type="tel" required />
      <div className="sm:col-span-2">
        <Field label="Correo electrónico" name={`${prefix}Correo`} type="email" required />
      </div>
    </div>
  )
}

function PersonPicker({
  value,
  onChange,
  people,
  placeholder,
  nuevoLabel,
  prefix,
  disabled = false,
}: {
  value: string
  onChange: (v: string) => void
  people: Persona[]
  placeholder: string
  nuevoLabel: string
  prefix: string
  disabled?: boolean
}) {
  return (
    <>
      <Select value={value} onValueChange={(v) => v && onChange(v)} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
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
