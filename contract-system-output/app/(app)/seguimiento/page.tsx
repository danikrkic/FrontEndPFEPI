"use client"

import { useMemo, useState } from "react"
import { useApp, can } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { ContractSelector } from "@/components/contract-selector"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDate, formatMoneyFull } from "@/lib/format"
import {
  AVANCE_TIPO_LABELS,
  INCUMPLIMIENTO_TIPO_LABELS,
  type AvanceTipo,
  type IncumplimientoTipo,
  type Contract,
} from "@/lib/types"
import { toast } from "sonner"
import {
  Plus,
  Activity,
  AlertTriangle,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react"

const AVANCE_BADGE: Record<AvanceTipo, string> = {
  avance: "bg-emerald-100 text-emerald-800",
  incidencia: "bg-amber-100 text-amber-800",
  atraso: "bg-red-100 text-red-800",
  relevante: "bg-blue-100 text-blue-800",
}

// ─── HU019: indicadores del contrato ────────────────────────────────────────

function IndicadoresPanel({ contract }: { contract: Contract }) {
  const { estimaciones } = useApp()

  const acumulado = useMemo(
    () =>
      estimaciones
        .filter((e) => e.contratoId === contract.id && e.status === "aceptada")
        .reduce((s, e) => s + e.importeNeto, 0),
    [estimaciones, contract.id],
  )

  const avanceFisico = contract.avanceReal
  const avanceProgramado = contract.avanceProgramado
  const avanceFinanciero = Math.round((acumulado / Math.max(contract.monto, 1)) * 100)
  const desfaseFisico = avanceFisico - avanceProgramado
  const desfaseFinanciero = avanceFisico - avanceFinanciero

  function Semaforo({ value }: { value: number }) {
    if (value >= -3) return <TrendingUp className="size-4 text-emerald-600" />
    if (value >= -10) return <Minus className="size-4 text-amber-500" />
    return <TrendingDown className="size-4 text-red-500" />
  }

  function semClass(value: number) {
    if (value >= -3) return "text-emerald-700"
    if (value >= -10) return "text-amber-600"
    return "text-red-600"
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Avance físico real"
        value={`${avanceFisico}%`}
        sub={<Progress value={avanceFisico} className="mt-2 h-1.5" />}
      />
      <KpiCard
        label="Avance físico programado"
        value={`${avanceProgramado}%`}
        sub={<Progress value={avanceProgramado} className="mt-2 h-1.5" />}
      />
      <KpiCard
        label="Avance financiero"
        value={`${avanceFinanciero}%`}
        sub={
          <p className="mt-1 text-xs text-muted-foreground">
            {formatMoneyFull(acumulado)} / {formatMoneyFull(contract.monto)}
          </p>
        }
      />
      <KpiCard
        label="Alertas de desviación"
        value={
          <span className="flex items-center gap-1.5">
            <Semaforo value={desfaseFisico} />
            <span className={semClass(desfaseFisico)}>
              Físico: {desfaseFisico > 0 ? "+" : ""}
              {desfaseFisico}%
            </span>
          </span>
        }
        sub={
          <p className={`mt-1 text-xs ${semClass(desfaseFinanciero)}`}>
            Financiero: {desfaseFinanciero > 0 ? "+" : ""}
            {desfaseFinanciero}% vs avance físico
          </p>
        }
      />
    </div>
  )
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-lg font-semibold text-foreground">{value}</div>
        {sub}
      </CardContent>
    </Card>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SeguimientoPage() {
  const { contracts } = useApp()
  const [contratoId, setContratoId] = useState(contracts[0]?.id ?? "")
  const contract = contracts.find((c) => c.id === contratoId)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Seguimiento Diario"
        subtitle="Indicadores del contrato, avances, incidencias, incumplimientos y minutas"
      />

      <ContractSelector value={contratoId} onChange={setContratoId} className="w-full sm:w-96" />

      {contract && <IndicadoresPanel contract={contract} />}

      <Tabs defaultValue="avances">
        <TabsList>
          <TabsTrigger value="avances">Avances e incidencias</TabsTrigger>
          <TabsTrigger value="incumplimientos">Incumplimientos</TabsTrigger>
          <TabsTrigger value="minutas">Minutas</TabsTrigger>
        </TabsList>
        <TabsContent value="avances" className="mt-4">
          <AvancesTab contratoId={contratoId} />
        </TabsContent>
        <TabsContent value="incumplimientos" className="mt-4">
          <IncumplimientosTab contratoId={contratoId} />
        </TabsContent>
        <TabsContent value="minutas" className="mt-4">
          <MinutasTab contratoId={contratoId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Avances ─────────────────────────────────────────────────────────────────

function AvancesTab({ contratoId }: { contratoId: string }) {
  const { avances, addAvance, user } = useApp()
  const [open, setOpen] = useState(false)
  const [filtro, setFiltro] = useState<"todos" | AvanceTipo>("todos")
  const [tipo, setTipo] = useState<AvanceTipo>("avance")
  const [descripcion, setDescripcion] = useState("")
  const [evidencia, setEvidencia] = useState("")
  const puede = can(user?.role, "avance.registrar")

  const list = useMemo(
    () =>
      avances
        .filter((a) => a.contratoId === contratoId)
        .filter((a) => filtro === "todos" || a.tipo === filtro),
    [avances, contratoId, filtro],
  )

  async function submit() {
    if (!descripcion.trim()) {
      toast.error("Describe el avance o incidencia")
      return
    }
    try {
      await addAvance({
        contratoId,
        tipo,
        descripcion,
        evidencia: evidencia || "Sin evidencia adjunta",
      })
      toast.success("Registro guardado")
      setDescripcion("")
      setEvidencia("")
      setTipo("avance")
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el registro")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={filtro} onValueChange={(v) => v && setFiltro(v as typeof filtro)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {Object.entries(AVANCE_TIPO_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {puede && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Registrar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar avance o incidencia</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <div className="flex flex-col gap-2">
                  <Label>Tipo</Label>
                  <Select value={tipo} onValueChange={(v) => v && setTipo(v as AvanceTipo)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(AVANCE_TIPO_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Descripción</Label>
                  <Textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={4}
                    placeholder="Detalle del avance, incidencia o situación relevante"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Evidencia (referencia)</Label>
                  <Input
                    value={evidencia}
                    onChange={(e) => setEvidencia(e.target.value)}
                    placeholder="ej. foto_avance_2024-06-15.jpg"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={submit}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<Activity className="size-6" />} text="Sin registros para este contrato." />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge className={`${AVANCE_BADGE[a.tipo]} hover:${AVANCE_BADGE[a.tipo]}`}>
                    {AVANCE_TIPO_LABELS[a.tipo]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(a.fecha)}</span>
                </div>
                <p className="text-sm">{a.descripcion}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Evidencia: {a.evidencia}</span>
                  <span>Registró: {a.autor}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Incumplimientos ─────────────────────────────────────────────────────────

function IncumplimientosTab({ contratoId }: { contratoId: string }) {
  const { incumplimientos, addIncumplimiento, user } = useApp()
  const [open, setOpen] = useState(false)
  const [tipo, setTipo] = useState<IncumplimientoTipo>("atraso")
  const [descripcion, setDescripcion] = useState("")
  const [evidenciaRef, setEvidenciaRef] = useState("")
  const puede = can(user?.role, "incumplimiento.registrar")

  const list = useMemo(
    () => incumplimientos.filter((i) => i.contratoId === contratoId),
    [incumplimientos, contratoId],
  )

  async function submit() {
    if (!descripcion.trim()) {
      toast.error("Describe el incumplimiento")
      return
    }
    try {
      await addIncumplimiento({
        contratoId,
        tipo,
        descripcion,
        evidenciaRef: evidenciaRef || "Sin referencia",
      })
      toast.success("Incumplimiento registrado")
      setDescripcion("")
      setEvidenciaRef("")
      setTipo("atraso")
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar el incumplimiento")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        {puede && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Registrar incumplimiento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar incumplimiento</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <div className="flex flex-col gap-2">
                  <Label>Tipo</Label>
                  <Select value={tipo} onValueChange={(v) => v && setTipo(v as IncumplimientoTipo)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(INCUMPLIMIENTO_TIPO_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Descripción</Label>
                  <Textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Referencia de evidencia</Label>
                  <Input
                    value={evidenciaRef}
                    onChange={(e) => setEvidenciaRef(e.target.value)}
                    placeholder="ej. acta_incumplimiento_03.pdf"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={submit}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="size-6" />}
          text="Sin incumplimientos registrados."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((i) => (
            <Card key={i.id}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                    {INCUMPLIMIENTO_TIPO_LABELS[i.tipo]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(i.fecha)}</span>
                </div>
                <p className="text-sm">{i.descripcion}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Evidencia: {i.evidenciaRef}</span>
                  <span>Registró: {i.autor}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Minutas ─────────────────────────────────────────────────────────────────

function MinutasTab({ contratoId }: { contratoId: string }) {
  const { minutas, addMinuta, user } = useApp()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    titulo: "",
    participantes: "",
    acuerdos: "",
    observaciones: "",
    compromisos: "",
  })
  const puede = can(user?.role, "minuta.registrar")

  const list = useMemo(
    () => minutas.filter((m) => m.contratoId === contratoId),
    [minutas, contratoId],
  )

  async function submit() {
    if (!form.titulo.trim() || !form.acuerdos.trim()) {
      toast.error("Captura al menos el título y los acuerdos")
      return
    }
    try {
      await addMinuta({ contratoId, ...form })
      toast.success("Minuta registrada")
      setForm({ titulo: "", participantes: "", acuerdos: "", observaciones: "", compromisos: "" })
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar la minuta")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        {puede && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Nueva minuta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar minuta de obra</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <Field label="Título">
                  <Input
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    placeholder="Reunión semanal de obra"
                  />
                </Field>
                <Field label="Participantes">
                  <Input
                    value={form.participantes}
                    onChange={(e) => setForm({ ...form, participantes: e.target.value })}
                    placeholder="Residente, Superintendente, Supervisión..."
                  />
                </Field>
                <Field label="Acuerdos">
                  <Textarea
                    value={form.acuerdos}
                    onChange={(e) => setForm({ ...form, acuerdos: e.target.value })}
                    rows={3}
                  />
                </Field>
                <Field label="Compromisos">
                  <Textarea
                    value={form.compromisos}
                    onChange={(e) => setForm({ ...form, compromisos: e.target.value })}
                    rows={2}
                  />
                </Field>
                <Field label="Observaciones">
                  <Textarea
                    value={form.observaciones}
                    onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                    rows={2}
                  />
                </Field>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={submit}>Guardar minuta</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<FileText className="size-6" />} text="Sin minutas registradas." />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium">{m.titulo}</h3>
                  <span className="text-xs text-muted-foreground">{formatDate(m.fecha)}</span>
                </div>
                <p className="text-xs text-muted-foreground">Participantes: {m.participantes}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <MinutaField label="Acuerdos" value={m.acuerdos} />
                  <MinutaField label="Compromisos" value={m.compromisos} />
                  <MinutaField label="Observaciones" value={m.observaciones} />
                </div>
                <p className="text-xs text-muted-foreground">Registró: {m.autor}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function MinutaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-muted-foreground">
      {icon}
      <p className="text-sm">{text}</p>
    </div>
  )
}
