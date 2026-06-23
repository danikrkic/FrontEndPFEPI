import { cn } from "@/lib/utils"

const STYLES: Record<string, string> = {
  // contract
  registrado: "bg-blue-100 text-blue-700",
  activo: "bg-emerald-100 text-emerald-700",
  en_cierre: "bg-amber-100 text-amber-700",
  cerrado: "bg-gray-200 text-gray-700",
  // estimacion
  en_revision: "bg-amber-100 text-amber-700",
  aceptada: "bg-emerald-100 text-emerald-700",
  rechazada: "bg-red-100 text-red-700",
  // convenio
  pendiente: "bg-amber-100 text-amber-700",
  aprobado: "bg-emerald-100 text-emerald-700",
  // pago
  atendida: "bg-emerald-100 text-emerald-700",
}

const LABELS: Record<string, string> = {
  registrado: "Registrado",
  activo: "Activo",
  en_cierre: "En Cierre",
  cerrado: "Cerrado",
  en_revision: "En Revisión",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  atendida: "Atendida",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STYLES[status] ?? "bg-gray-100 text-gray-700",
      )}
    >
      {LABELS[status] ?? status}
    </span>
  )
}
