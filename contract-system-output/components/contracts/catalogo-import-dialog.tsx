"use client"

/**
 * Cambio 3: Importación de catálogo de conceptos desde .xlsx / .csv
 * Flujo de 4 pasos: upload → mapeo → validación → confirmación
 */

import { useCallback, useMemo, useState } from "react"
import { Upload, ChevronRight, ChevronLeft, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react"
import * as XLSX from "xlsx"
import type { Contract, ConceptoCatalogo } from "@/lib/types"
import type { ColumnMapping, FilaValidada } from "@/lib/catalogo-import"
import { detectarColumnas, validarFilas, filasAConceptos } from "@/lib/catalogo-import"
import { useApp } from "@/lib/store"
import { formatCurrency } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
import { toast } from "sonner"

type ImportStep = "upload" | "mapeo" | "validacion" | "confirmacion"

const CAMPOS_MAPEO: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: "clave", label: "Clave", required: true },
  { key: "descripcion", label: "Descripción", required: true },
  { key: "unidad", label: "Unidad", required: true },
  { key: "cantidad", label: "Cantidad", required: true },
  { key: "precioUnitario", label: "Precio unitario", required: true },
  { key: "capitulo", label: "Capítulo (opcional)", required: false },
  { key: "importe", label: "Importe (para validación)", required: false },
]

export function CatalogoImportDialog({ contract }: { contract: Contract }) {
  const { setCatalogoConceptos } = useApp()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<ImportStep>("upload")

  // Datos parseados del archivo
  const [filas, setFilas] = useState<unknown[][]>([])
  const [encabezados, setEncabezados] = useState<string[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({
    clave: null, descripcion: null, unidad: null, cantidad: null,
    precioUnitario: null, capitulo: null, importe: null,
  })
  const [resultado, setResultado] = useState<{ filas: FilaValidada[]; tieneErrores: boolean } | null>(null)

  const reset = useCallback(() => {
    setStep("upload")
    setFilas([])
    setEncabezados([])
    setMapping({ clave: null, descripcion: null, unidad: null, cantidad: null, precioUnitario: null, capitulo: null, importe: null })
    setResultado(null)
  }, [])

  const handleClose = useCallback((v: boolean) => {
    if (!v) reset()
    setOpen(v)
  }, [reset])

  // Paso 1: leer archivo
  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target!.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: "array" })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][]
      if (raw.length < 2) {
        toast.error("El archivo no tiene filas suficientes")
        return
      }
      const hdrs = (raw[0] as unknown[]).map((h) => String(h ?? ""))
      setEncabezados(hdrs)
      setFilas(raw)
      const detected = detectarColumnas(hdrs)
      setMapping(detected)
      setStep("mapeo")
    }
    reader.readAsArrayBuffer(file)
  }, [])

  // Paso 2 → 3: validar
  const handleValidar = useCallback(() => {
    const res = validarFilas(filas, mapping, 0)
    setResultado(res)
    setStep("validacion")
  }, [filas, mapping])

  // Paso 4: confirmar
  const handleConfirmar = useCallback(async () => {
    if (!resultado) return
    const conceptos = filasAConceptos(resultado.filas)
    try {
      await setCatalogoConceptos(contract.id, conceptos)
      toast.success(`${conceptos.length} conceptos importados al catálogo`)
      handleClose(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo importar el catálogo")
    }
  }, [resultado, contract, setCatalogoConceptos, handleClose])

  const conceptosOk = useMemo(
    () => resultado?.filas.filter((f) => f.errores.length === 0).length ?? 0,
    [resultado],
  )

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4" />
          Importar Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar catálogo de conceptos</DialogTitle>
        </DialogHeader>

        {/* Indicador de pasos */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          {(["upload", "mapeo", "validacion", "confirmacion"] as ImportStep[]).map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`rounded-full px-2 py-0.5 font-medium ${step === s ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {i + 1}
              </span>
              {s === "upload" ? "Archivo" : s === "mapeo" ? "Mapeo" : s === "validacion" ? "Validación" : "Confirmar"}
              {i < 3 && <ChevronRight className="h-3 w-3" />}
            </span>
          ))}
        </div>

        {/* PASO 1: upload */}
        {step === "upload" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Upload className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Selecciona un archivo <strong>.xlsx</strong> o <strong>.csv</strong> con el catálogo de conceptos.
            </p>
            <Label htmlFor="file-input" className="cursor-pointer">
              <div className="rounded-md border border-dashed border-border px-6 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
                Seleccionar archivo
              </div>
              <input
                id="file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFile}
              />
            </Label>
          </div>
        )}

        {/* PASO 2: mapeo de columnas */}
        {step === "mapeo" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Verifica que cada campo del sistema corresponda a la columna correcta del archivo.
            </p>
            <div className="grid gap-3">
              {CAMPOS_MAPEO.map(({ key, label, required }) => (
                <div key={key} className="grid grid-cols-2 items-center gap-3">
                  <Label className="text-xs">
                    {label}{required && <span className="text-destructive ml-0.5">*</span>}
                  </Label>
                  <Select
                    value={mapping[key] !== null ? String(mapping[key]) : "ninguna"}
                    onValueChange={(v) =>
                      setMapping((m) => ({ ...m, [key]: v === "ninguna" ? null : parseInt(v) }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ninguna">— Sin columna —</SelectItem>
                      {encabezados.map((h, i) => (
                        <SelectItem key={i} value={String(i)}>{h || `Columna ${i + 1}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <DialogFooter className="mt-2">
              <Button variant="outline" size="sm" onClick={() => setStep("upload")}>
                <ChevronLeft className="h-4 w-4" /> Atrás
              </Button>
              <Button size="sm" onClick={handleValidar}>
                Validar <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* PASO 3: validación */}
        {step === "validacion" && resultado && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {conceptosOk} filas válidas
              </span>
              {resultado.tieneErrores && (
                <span className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {resultado.filas.filter((f) => f.errores.length > 0).length} con errores
                </span>
              )}
              {resultado.filas.some((f) => f.advertencias.length > 0) && (
                <span className="flex items-center gap-1 text-sm text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  {resultado.filas.filter((f) => f.advertencias.length > 0).length} advertencias
                </span>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">Fila</th>
                    <th className="px-2 py-1.5 text-left font-medium">Clave</th>
                    <th className="px-2 py-1.5 text-left font-medium">Descripción</th>
                    <th className="px-2 py-1.5 text-right font-medium">Total</th>
                    <th className="px-2 py-1.5 text-left font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.filas.map((f) => (
                    <tr key={f.fila} className={`border-t border-border ${f.errores.length > 0 ? "bg-red-50 dark:bg-red-950/20" : f.advertencias.length > 0 ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                      <td className="px-2 py-1.5 tabular-nums">{f.fila}</td>
                      <td className="px-2 py-1.5">{f.concepto.clave ?? "—"}</td>
                      <td className="px-2 py-1.5 max-w-xs truncate">{f.concepto.descripcion ?? "—"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {f.concepto.total != null ? formatCurrency(f.concepto.total) : "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {f.errores.length > 0 ? (
                          <span className="text-destructive">{f.errores.join("; ")}</span>
                        ) : f.advertencias.length > 0 ? (
                          <span className="text-amber-700">{f.advertencias.join("; ")}</span>
                        ) : (
                          <span className="text-emerald-700">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter className="mt-2">
              <Button variant="outline" size="sm" onClick={() => setStep("mapeo")}>
                <ChevronLeft className="h-4 w-4" /> Atrás
              </Button>
              <Button
                size="sm"
                disabled={resultado.tieneErrores || conceptosOk === 0}
                onClick={() => setStep("confirmacion")}
              >
                Continuar <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* PASO 4: confirmación */}
        {step === "confirmacion" && resultado && (
          <div className="flex flex-col gap-4">
            <div className="rounded-md bg-muted/50 border border-border px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                Se importarán <strong>{conceptosOk}</strong> conceptos al catálogo de <strong>{contract.noContrato}</strong>.
              </p>
              {contract.catalogoConceptos.length > 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  El contrato ya tiene {contract.catalogoConceptos.length} concepto(s). El catálogo anterior se guardará como snapshot en el historial de versiones.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setStep("validacion")}>
                <ChevronLeft className="h-4 w-4" /> Atrás
              </Button>
              <Button size="sm" onClick={handleConfirmar}>
                Confirmar importación
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
