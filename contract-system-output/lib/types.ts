export type Role =
  | "dependencia"
  | "residente"
  | "superintendente"
  | "supervision"
  | "finanzas"

export interface User {
  id: string
  name: string
  email: string
  password: string
  role: Role
  initials: string
  /** Links this user account to a Persona (residente) for bitácora access control */
  personaId?: string
}

export const ROLE_LABELS: Record<Role, string> = {
  dependencia: "Dependencia",
  residente: "Residente de Obra",
  superintendente: "Superintendente",
  supervision: "Supervisión",
  finanzas: "Finanzas",
}

export type ContractStatus = "registrado" | "activo" | "en_cierre" | "cerrado"

// ── Activación de contrato ────────────────────────────────────────────────────
export type SolicitudActivacionStatus = "pendiente" | "aprobada" | "rechazada"

export interface SolicitudActivacion {
  contratoId: string
  status: SolicitudActivacionStatus
  solicitadoPor: string
  fechaSolicitud: string
  revisadoPor: string | null
  fechaRevision: string | null
  observaciones: string
}

export interface Contratista {
  id: string
  nombre: string
  rfc: string
  representante: string
  telefono: string
  correo: string
}

export interface Persona {
  id: string
  nombre: string
  rfc: string
  telefono: string
  correo: string
}

export interface ContractDocument {
  id: string
  bloque: DocBlock
  nombre: string
  formato: string
  tamano: string
  fecha: string
  subidoPor: string
}

export interface ConceptoCatalogo {
  id: string
  clave: string
  descripcion: string
  unidad: string
  cantidad: number
  precioUnitario: number
  total: number
  capitulo?: string
}

// ── Cambio 1: "fianzas" y "garantias" eliminados de DocBlock ─────────────────
export type DocBlock =
  | "contrato"
  | "catalogo"
  | "programa"
  | "juridico"

export const DOC_BLOCK_LABELS: Record<DocBlock, string> = {
  contrato: "Contrato Digitalizado",
  catalogo: "Catálogo de Conceptos",
  programa: "Programa de Obra",
  juridico: "Información Jurídica",
}

export interface ContractVersion {
  version: number
  fecha: string
  monto: number
  fechaTermino: string
  motivo: string
  catalogoConceptos?: ConceptoCatalogo[]
}

export interface Contract {
  id: string
  noContrato: string
  objeto: string
  descripcion: string
  monto: number
  plazoDias: number
  fechaInicio: string
  fechaTermino: string
  ubicacion: string
  contratista: Contratista
  residente: Persona
  supervisor: Persona
  status: ContractStatus
  version: number
  avanceProgramado: number
  avanceReal: number
  documentos: ContractDocument[]
  catalogoConceptos: ConceptoCatalogo[]
  versiones: ContractVersion[]
  /** Fecha en que el contrato fue activado (ISO date) */
  fechaActivacion?: string
}

export type NoteType = "instruccion" | "respuesta" | "acuerdo" | "observacion"

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  instruccion: "Instrucción",
  respuesta: "Respuesta",
  acuerdo: "Acuerdo",
  observacion: "Observación",
}

export interface NotaFirma {
  responsable: string
  nombre: string
  firma: string
}

export interface BitacoraNote {
  id: string
  numero: number
  tipo: NoteType
  contenido: string
  autor: string
  rol: Role
  fecha: string
  firmas: NotaFirma[]
}

export interface Bitacora {
  contratoId: string
  abierta: boolean
  fechaApertura: string | null
  notaApertura: string
  notas: BitacoraNote[]
}

export type EstimacionStatus = "en_revision" | "aceptada" | "rechazada"

// ── Cambio 2: desglose financiero de Estimacion ──────────────────────────────
export interface Estimacion {
  id: string
  contratoId: string
  numero: number
  periodoInicio: string
  periodoFin: string
  caratula: string
  numerosGeneradores: string
  registroFotografico: number
  notasSoporte: number
  status: EstimacionStatus
  observaciones: string
  creadaPor: string
  fechaCreacion: string
  // Desglose financiero (sustituye el campo plano "monto")
  importeBruto: number
  amortizacionAnticipo: number
  retencionGarantia: number
  iva: number
  importeNeto: number
}

// ── Cambio 2: Anticipo ────────────────────────────────────────────────────────
export interface Anticipo {
  id: string
  contratoId: string
  montoOtorgado: number
  porcentajeContrato: number
  porcentajeAmortizacion: number
  fechaEntrega: string
  saldoPendiente: number
  garantiaId: string
}

export type ConvenioTipo = "plazo" | "monto" | "ambos"
export type ConvenioStatus = "pendiente" | "aprobado" | "rechazado"

export const CONVENIO_TIPO_LABELS: Record<ConvenioTipo, string> = {
  plazo: "Ampliación de Plazo",
  monto: "Modificación de Monto",
  ambos: "Plazo y Monto",
}

// ── Cambio 5: alcance y conceptos afectados en Convenio ──────────────────────
export type ConvenioAlcance = "ajuste_monto_simple" | "conceptos_nuevos" | "ajuste_cantidades"

export interface ConvenioConceptoAfectado {
  conceptoId: string
  cantidadAnterior: number
  cantidadNueva: number
}

export interface Convenio {
  id: string
  contratoId: string
  tipo: ConvenioTipo
  justificacion: string
  montoAdicional: number
  diasAdicionales: number
  documentos: number
  status: ConvenioStatus
  motivoRechazo: string
  solicitadoPor: string
  fechaSolicitud: string
  alcance: ConvenioAlcance
  conceptosAfectados?: ConvenioConceptoAfectado[]
  conceptosNuevos?: ConceptoCatalogo[]
}

export type AlertaStatus = "pendiente" | "atendida"

export interface OrdenPago {
  id: string
  contratoId: string
  noContrato: string
  estimacionId: string
  estimacionNumero: number
  monto: number
  fechaEmision: string
  status: AlertaStatus
  fechaAtencion: string | null
}

export type AvanceTipo = "avance" | "incidencia" | "atraso" | "relevante"

export const AVANCE_TIPO_LABELS: Record<AvanceTipo, string> = {
  avance: "Avance",
  incidencia: "Incidencia",
  atraso: "Atraso",
  relevante: "Situación Relevante",
}

export interface AvanceDiario {
  id: string
  contratoId: string
  tipo: AvanceTipo
  descripcion: string
  evidencia: string
  autor: string
  fecha: string
}

export type IncumplimientoTipo = "atraso" | "calidad" | "seguridad"

export const INCUMPLIMIENTO_TIPO_LABELS: Record<IncumplimientoTipo, string> = {
  atraso: "Atraso",
  calidad: "Calidad",
  seguridad: "Seguridad",
}

export interface Incumplimiento {
  id: string
  contratoId: string
  tipo: IncumplimientoTipo
  descripcion: string
  evidenciaRef: string
  autor: string
  fecha: string
}

export interface Minuta {
  id: string
  contratoId: string
  titulo: string
  participantes: string
  acuerdos: string
  observaciones: string
  compromisos: string
  autor: string
  fecha: string
}

// ── Programa de Obra ─────────────────────────────────────────────────────────

/**
 * Cantidad programada de un concepto para una semana determinada.
 * El monto se deriva automáticamente: cantidadSemana * precioUnitario del concepto.
 */
export interface SemanaConcepto {
  semana: number    // 1-based index dentro del contrato
  cantidad: number  // cantidad de unidades a ejecutar esa semana
}

export interface ConceptoPrograma {
  conceptoId: string
  semanas: SemanaConcepto[]
}

export interface ProgramaObra {
  contratoId: string
  conceptos: ConceptoPrograma[]
  updatedAt: string
}

// ── Cambio 1: Garantía unificada (ex-fianza) ─────────────────────────────────

export type GarantiaTipo = "cumplimiento" | "anticipo" | "vicios_ocultos"

export const GARANTIA_TIPO_LABELS: Record<GarantiaTipo, string> = {
  cumplimiento: "Cumplimiento",
  anticipo: "Anticipo",
  vicios_ocultos: "Vicios Ocultos",
}

export type GarantiaStatus = "vigente" | "por_vencer" | "vencida" | "liberada"

export interface Garantia {
  id: string
  contratoId: string
  tipo: GarantiaTipo
  institucionAfianzadora: string
  numeroPoliza: string
  monto: number
  fechaEmision: string
  fechaVigencia: string
  status: GarantiaStatus
  documento: ContractDocument | null
  registradoPor: string
  fechaRegistro: string
}

/** Calcula el status de una garantía a partir de su fechaVigencia.
 *  "liberada" solo se asigna manualmente; esta función nunca la retorna. */
export function calcularGarantiaStatus(fechaVigencia: string): Exclude<GarantiaStatus, "liberada"> {
  const hoy = new Date()
  const vencimiento = new Date(fechaVigencia + "T00:00:00")
  const diffMs = vencimiento.getTime() - hoy.getTime()
  const diffDias = diffMs / (1000 * 60 * 60 * 24)
  if (diffDias < 0) return "vencida"
  if (diffDias <= 30) return "por_vencer"
  return "vigente"
}
