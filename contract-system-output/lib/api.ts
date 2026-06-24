import type {
  Anticipo,
  AvanceDiario,
  AvanceTipo,
  Bitacora,
  BitacoraNote,
  ConceptoCatalogo,
  ConceptoPrograma,
  Contract,
  ContractDocument,
  ContractStatus,
  ContractVersion,
  Contratista,
  Convenio,
  ConvenioAlcance,
  ConvenioStatus,
  ConvenioTipo,
  DocBlock,
  EstimacionStatus,
  Estimacion,
  AlertaStatus,
  Garantia,
  GarantiaStatus,
  GarantiaTipo,
  Incumplimiento,
  IncumplimientoTipo,
  Minuta,
  NoteType,
  OrdenPago,
  Persona,
  ProgramaObra,
  Role,
  SolicitudActivacion,
  SolicitudActivacionStatus,
} from "./types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api"

const ACCESS_TOKEN_KEY = "gacm_access_token"
const REFRESH_TOKEN_KEY = "gacm_refresh_token"

export function getAccessToken() {
  return typeof window !== "undefined" ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
}

export function getRefreshToken() {
  return typeof window !== "undefined" ? localStorage.getItem(REFRESH_TOKEN_KEY) : null
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, access)
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken()
  if (!refresh) return null
  const res = await fetch(`${API_BASE_URL}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  })
  if (!res.ok) {
    clearTokens()
    return null
  }
  const data = await res.json()
  localStorage.setItem(ACCESS_TOKEN_KEY, data.access)
  return data.access
}

/** Fetch autenticado contra la API de Django: agrega el access token y reintenta una vez si expiró. */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const access = getAccessToken()
  const headers = new Headers(options.headers)
  // No fijar Content-Type cuando el body es FormData: el browser debe
  // generar el boundary del multipart, fijarlo a mano rompe el upload.
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData
  if (!isFormData) headers.set("Content-Type", "application/json")
  if (access) headers.set("Authorization", `Bearer ${access}`)

  let res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401 && getRefreshToken()) {
    const newAccess = await refreshAccessToken()
    if (newAccess) {
      headers.set("Authorization", `Bearer ${newAccess}`)
      res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
    }
  }

  return res
}

export interface ApiUser {
  id: number
  name: string
  email: string
  role: string
  initials: string
  persona_id: string | null
}

export async function loginRequest(email: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return null
  const data: { access: string; refresh: string; user: ApiUser } = await res.json()
  setTokens(data.access, data.refresh)
  return data.user
}

export async function meRequest(): Promise<ApiUser | null> {
  const res = await apiFetch("/auth/me/")
  if (!res.ok) return null
  return res.json()
}

// ── Errores de API ────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number
  payload: unknown

  constructor(status: number, payload: unknown) {
    super(extractErrorMessage(payload))
    this.status = status
    this.payload = payload
  }
}

function extractErrorMessage(payload: unknown): string {
  if (!payload) return "Ocurrió un error inesperado."
  if (typeof payload === "string") return payload
  if (typeof payload === "object") {
    const obj = payload as Record<string, unknown>
    if (typeof obj.detail === "string") return obj.detail
    const firstKey = Object.keys(obj)[0]
    if (firstKey) {
      const value = obj[firstKey]
      const msg = Array.isArray(value) ? value[0] : value
      if (typeof msg === "string") return msg
    }
  }
  return "Ocurrió un error inesperado."
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options)
  if (!res.ok) {
    let payload: unknown = null
    try {
      payload = await res.json()
    } catch {
      // sin cuerpo JSON en la respuesta de error
    }
    throw new ApiError(res.status, payload)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

function apiGet<T>(path: string): Promise<T> {
  return request<T>(path)
}

function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
  })
}

function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
  })
}

// ── Tipos crudos de la API (snake_case, tal cual los serializa Django) ───────

export interface ApiContratista {
  id: number
  nombre: string
  rfc: string
  representante: string
  telefono: string
  correo: string
}

export interface ApiPersona {
  id: number
  nombre: string
  rfc: string
  telefono: string
  correo: string
}

export interface ApiConceptoCatalogo {
  id: number
  clave: string
  descripcion: string
  unidad: string
  cantidad: string
  precio_unitario: string
  total: string
  capitulo: string
}

export interface ApiContractDocument {
  id: number
  bloque: string
  nombre: string
  archivo: string
  formato: string
  tamano: string
  fecha: string
  subido_por: string | null
}

export interface ApiContractVersion {
  version: number
  fecha: string
  monto: string
  fecha_termino: string
  motivo: string
  catalogo_snapshot: ApiConceptoCatalogo[] | null
}

export interface ApiSolicitudActivacion {
  status: string
  solicitado_por: string | null
  fecha_solicitud: string
  revisado_por: string | null
  fecha_revision: string | null
  observaciones: string
}

export interface ApiNotaFirma {
  responsable: string
  nombre: string
  firma: string
}

export interface ApiBitacoraNoteFoto {
  id: number
  imagen: string
  fecha: string
}

export interface ApiBitacoraNote {
  id: number
  numero: number
  tipo: string
  contenido: string
  autor: string | null
  rol: string
  fecha: string
  firmas: ApiNotaFirma[]
  fotos: ApiBitacoraNoteFoto[]
}

export interface ApiBitacora {
  abierta: boolean
  fecha_apertura: string | null
  nota_apertura: string
  notas: ApiBitacoraNote[]
}

export interface ApiContractCompact {
  id: number
  no_contrato: string
  objeto: string
}

export interface ApiOrdenPago {
  id: number
  contrato: ApiContractCompact
  estimacion: number
  estimacion_numero: number
  monto: string
  fecha_emision: string
  status: string
  fecha_atencion: string | null
}

export interface ApiEstimacion {
  id: number
  contrato: ApiContractCompact
  numero: number
  periodo_inicio: string
  periodo_fin: string
  caratula: string
  numeros_generadores: string
  registro_fotografico: number
  notas_soporte: number
  status: string
  observaciones: string
  creada_por: string | null
  fecha_creacion: string
  importe_bruto: string
  amortizacion_anticipo: string
  retencion_garantia: string
  iva: string
  importe_neto: string
  orden_pago: ApiOrdenPago | null
}

export interface ApiGarantia {
  id: number
  contrato: ApiContractCompact
  tipo: string
  institucion_afianzadora: string
  numero_poliza: string
  monto: string
  fecha_emision: string
  fecha_vigencia: string
  documento: ApiContractDocument | null
  status: string
  registrado_por: string | null
  fecha_registro: string
  liberada_por: string | null
  fecha_liberacion: string | null
}

export interface ApiAnticipo {
  id: number
  contrato: ApiContractCompact
  monto_otorgado: string
  porcentaje_contrato: string
  porcentaje_amortizacion: string
  fecha_entrega: string
  saldo_pendiente: string
  garantia: number | null
}

export interface ApiConvenioDocumento {
  id: number
  nombre: string
  archivo: string
  fecha: string
}

export interface ApiConvenioConceptoAfectado {
  concepto_id: number
  cantidad_anterior: string | number
  cantidad_nueva: string | number
}

export interface ApiConvenioConceptoNuevo {
  clave: string
  descripcion: string
  unidad: string
  cantidad: string | number
  precio_unitario: string | number
  capitulo?: string
}

export interface ApiConvenio {
  id: number
  contrato: ApiContractCompact
  tipo: string
  justificacion: string
  monto_adicional: string
  dias_adicionales: number
  alcance: string
  conceptos_afectados: ApiConvenioConceptoAfectado[] | null
  conceptos_nuevos: ApiConvenioConceptoNuevo[] | null
  status: string
  motivo_rechazo: string
  solicitado_por: string | null
  fecha_solicitud: string
  documentos: ApiConvenioDocumento[]
}

export interface ApiAvanceDiario {
  id: number
  contrato: ApiContractCompact
  tipo: string
  descripcion: string
  evidencia: string
  autor: string | null
  fecha: string
}

export interface ApiIncumplimiento {
  id: number
  contrato: ApiContractCompact
  tipo: string
  descripcion: string
  evidencia_ref: string
  autor: string | null
  fecha: string
}

export interface ApiMinuta {
  id: number
  contrato: ApiContractCompact
  titulo: string
  participantes: string
  acuerdos: string
  observaciones: string
  compromisos: string
  autor: string | null
  fecha: string
}

export interface ApiSemanaConcepto {
  semana: number
  cantidad: string | number
}

export interface ApiConceptoPrograma {
  concepto_id: number
  semanas: ApiSemanaConcepto[]
}

export interface ApiProgramaObra {
  conceptos: ApiConceptoPrograma[]
  updated_at: string | null
}

export interface ApiContract {
  id: number
  no_contrato: string
  objeto: string
  descripcion: string
  monto: string
  plazo_dias: number
  fecha_inicio: string
  fecha_termino: string
  ubicacion: string
  contratista: ApiContratista
  residente: ApiPersona
  supervisor: ApiPersona
  superintendente: ApiPersona
  status: string
  version: number
  avance_programado: number
  avance_real: number
  fecha_activacion: string | null
  documentos: ApiContractDocument[]
  catalogo_conceptos: ApiConceptoCatalogo[]
  versiones: ApiContractVersion[]
  solicitud_activacion: ApiSolicitudActivacion | null
  bitacora: ApiBitacora | null
  estimaciones: ApiEstimacion[]
  garantias: ApiGarantia[]
  anticipo: ApiAnticipo | null
  convenios: ApiConvenio[]
  avances: ApiAvanceDiario[]
  incumplimientos: ApiIncumplimiento[]
  minutas: ApiMinuta[]
  programa_obra: ApiProgramaObra | null
}

// ── Adaptadores snake_case (Django) → camelCase (frontend) ──────────────────

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0
  return typeof v === "number" ? v : parseFloat(v)
}

function strId(v: number | string): string {
  return String(v)
}

export function toContratista(a: ApiContratista): Contratista {
  return { id: strId(a.id), nombre: a.nombre, rfc: a.rfc, representante: a.representante, telefono: a.telefono, correo: a.correo }
}

export function toPersona(a: ApiPersona): Persona {
  return { id: strId(a.id), nombre: a.nombre, rfc: a.rfc, telefono: a.telefono, correo: a.correo }
}

export function toContractDocument(a: ApiContractDocument): ContractDocument {
  return {
    id: strId(a.id),
    bloque: a.bloque as DocBlock,
    nombre: a.nombre,
    archivo: a.archivo,
    formato: a.formato,
    tamano: a.tamano,
    fecha: a.fecha,
    subidoPor: a.subido_por ?? "",
  }
}

export function toConceptoCatalogo(a: ApiConceptoCatalogo): ConceptoCatalogo {
  return {
    id: strId(a.id),
    clave: a.clave,
    descripcion: a.descripcion,
    unidad: a.unidad,
    cantidad: num(a.cantidad),
    precioUnitario: num(a.precio_unitario),
    total: num(a.total),
    capitulo: a.capitulo || undefined,
  }
}

export function toContractVersion(a: ApiContractVersion): ContractVersion {
  return {
    version: a.version,
    fecha: a.fecha,
    monto: num(a.monto),
    fechaTermino: a.fecha_termino,
    motivo: a.motivo,
    catalogoConceptos: a.catalogo_snapshot ? a.catalogo_snapshot.map(toConceptoCatalogo) : undefined,
  }
}

export function toSolicitudActivacion(a: ApiSolicitudActivacion, contratoId: string): SolicitudActivacion {
  return {
    contratoId,
    status: a.status as SolicitudActivacionStatus,
    solicitadoPor: a.solicitado_por ?? "",
    fechaSolicitud: a.fecha_solicitud,
    revisadoPor: a.revisado_por,
    fechaRevision: a.fecha_revision,
    observaciones: a.observaciones,
  }
}

export function toBitacoraNote(a: ApiBitacoraNote): BitacoraNote {
  return {
    id: strId(a.id),
    numero: a.numero,
    tipo: a.tipo as NoteType,
    contenido: a.contenido,
    autor: a.autor ?? "",
    rol: a.rol as Role,
    fecha: a.fecha,
    firmas: a.firmas,
    fotos: a.fotos.map((f) => f.imagen),
  }
}

export function toBitacora(a: ApiBitacora | null, contratoId: string): Bitacora {
  if (!a) return { contratoId, abierta: false, fechaApertura: null, notaApertura: "", notas: [] }
  return {
    contratoId,
    abierta: a.abierta,
    fechaApertura: a.fecha_apertura,
    notaApertura: a.nota_apertura,
    notas: a.notas.map(toBitacoraNote),
  }
}

export function toOrdenPago(a: ApiOrdenPago): OrdenPago {
  return {
    id: strId(a.id),
    contratoId: strId(a.contrato.id),
    noContrato: a.contrato.no_contrato,
    estimacionId: strId(a.estimacion),
    estimacionNumero: a.estimacion_numero,
    monto: num(a.monto),
    fechaEmision: a.fecha_emision,
    status: a.status as AlertaStatus,
    fechaAtencion: a.fecha_atencion,
  }
}

export function toEstimacion(a: ApiEstimacion): Estimacion {
  return {
    id: strId(a.id),
    contratoId: strId(a.contrato.id),
    numero: a.numero,
    periodoInicio: a.periodo_inicio,
    periodoFin: a.periodo_fin,
    caratula: a.caratula,
    numerosGeneradores: a.numeros_generadores,
    registroFotografico: a.registro_fotografico,
    notasSoporte: a.notas_soporte,
    status: a.status as EstimacionStatus,
    observaciones: a.observaciones,
    creadaPor: a.creada_por ?? "",
    fechaCreacion: a.fecha_creacion,
    importeBruto: num(a.importe_bruto),
    amortizacionAnticipo: num(a.amortizacion_anticipo),
    retencionGarantia: num(a.retencion_garantia),
    iva: num(a.iva),
    importeNeto: num(a.importe_neto),
  }
}

export function toGarantia(a: ApiGarantia): Garantia {
  return {
    id: strId(a.id),
    contratoId: strId(a.contrato.id),
    tipo: a.tipo as GarantiaTipo,
    institucionAfianzadora: a.institucion_afianzadora,
    numeroPoliza: a.numero_poliza,
    monto: num(a.monto),
    fechaEmision: a.fecha_emision,
    fechaVigencia: a.fecha_vigencia,
    status: a.status as GarantiaStatus,
    documento: a.documento ? toContractDocument(a.documento) : null,
    registradoPor: a.registrado_por ?? "",
    fechaRegistro: a.fecha_registro,
    liberadaPor: a.liberada_por,
    fechaLiberacion: a.fecha_liberacion,
  }
}

export function toAnticipo(a: ApiAnticipo): Anticipo {
  return {
    id: strId(a.id),
    contratoId: strId(a.contrato.id),
    montoOtorgado: num(a.monto_otorgado),
    porcentajeContrato: num(a.porcentaje_contrato),
    porcentajeAmortizacion: num(a.porcentaje_amortizacion),
    fechaEntrega: a.fecha_entrega,
    saldoPendiente: num(a.saldo_pendiente),
    garantiaId: a.garantia != null ? strId(a.garantia) : "",
  }
}

export function toConvenio(a: ApiConvenio): Convenio {
  return {
    id: strId(a.id),
    contratoId: strId(a.contrato.id),
    tipo: a.tipo as ConvenioTipo,
    justificacion: a.justificacion,
    montoAdicional: num(a.monto_adicional),
    diasAdicionales: a.dias_adicionales,
    documentos: a.documentos.length,
    status: a.status as ConvenioStatus,
    motivoRechazo: a.motivo_rechazo,
    solicitadoPor: a.solicitado_por ?? "",
    fechaSolicitud: a.fecha_solicitud,
    alcance: a.alcance as ConvenioAlcance,
    conceptosAfectados: a.conceptos_afectados
      ? a.conceptos_afectados.map((x) => ({
          conceptoId: strId(x.concepto_id),
          cantidadAnterior: num(x.cantidad_anterior),
          cantidadNueva: num(x.cantidad_nueva),
        }))
      : undefined,
    conceptosNuevos: a.conceptos_nuevos
      ? a.conceptos_nuevos.map((x, idx) => ({
          id: `cn-${idx}`,
          clave: x.clave,
          descripcion: x.descripcion,
          unidad: x.unidad,
          cantidad: num(x.cantidad),
          precioUnitario: num(x.precio_unitario),
          total: num(x.cantidad) * num(x.precio_unitario),
          capitulo: x.capitulo,
        }))
      : undefined,
  }
}

export function toAvanceDiario(a: ApiAvanceDiario): AvanceDiario {
  return {
    id: strId(a.id),
    contratoId: strId(a.contrato.id),
    tipo: a.tipo as AvanceTipo,
    descripcion: a.descripcion,
    evidencia: a.evidencia,
    autor: a.autor ?? "",
    fecha: a.fecha,
  }
}

export function toIncumplimiento(a: ApiIncumplimiento): Incumplimiento {
  return {
    id: strId(a.id),
    contratoId: strId(a.contrato.id),
    tipo: a.tipo as IncumplimientoTipo,
    descripcion: a.descripcion,
    evidenciaRef: a.evidencia_ref,
    autor: a.autor ?? "",
    fecha: a.fecha,
  }
}

export function toMinuta(a: ApiMinuta): Minuta {
  return {
    id: strId(a.id),
    contratoId: strId(a.contrato.id),
    titulo: a.titulo,
    participantes: a.participantes,
    acuerdos: a.acuerdos,
    observaciones: a.observaciones,
    compromisos: a.compromisos,
    autor: a.autor ?? "",
    fecha: a.fecha,
  }
}

export function toProgramaObra(a: ApiProgramaObra | null, contratoId: string): ProgramaObra {
  return {
    contratoId,
    conceptos: a
      ? a.conceptos.map((c): ConceptoPrograma => ({
          conceptoId: strId(c.concepto_id),
          semanas: c.semanas.map((s) => ({ semana: s.semana, cantidad: num(s.cantidad) })),
        }))
      : [],
    updatedAt: a?.updated_at ?? "",
  }
}

export function toContract(a: ApiContract): Contract {
  return {
    id: strId(a.id),
    noContrato: a.no_contrato,
    objeto: a.objeto,
    descripcion: a.descripcion,
    monto: num(a.monto),
    plazoDias: a.plazo_dias,
    fechaInicio: a.fecha_inicio,
    fechaTermino: a.fecha_termino,
    ubicacion: a.ubicacion,
    contratista: toContratista(a.contratista),
    residente: toPersona(a.residente),
    supervisor: toPersona(a.supervisor),
    superintendente: toPersona(a.superintendente),
    status: a.status as ContractStatus,
    version: a.version,
    avanceProgramado: a.avance_programado,
    avanceReal: a.avance_real,
    documentos: a.documentos.map(toContractDocument),
    catalogoConceptos: a.catalogo_conceptos.map(toConceptoCatalogo),
    versiones: a.versiones.map(toContractVersion),
    fechaActivacion: a.fecha_activacion ?? undefined,
  }
}

/** Todo lo que cuelga de un contrato, aplanado para los arrays planos del store. */
export interface ContractBundle {
  contract: Contract
  bitacora: Bitacora
  estimaciones: Estimacion[]
  ordenesPago: OrdenPago[]
  garantias: Garantia[]
  anticipo: Anticipo | null
  convenios: Convenio[]
  avances: AvanceDiario[]
  incumplimientos: Incumplimiento[]
  minutas: Minuta[]
  programaObra: ProgramaObra
  solicitudActivacion: SolicitudActivacion | null
}

export function adaptContractBundle(a: ApiContract): ContractBundle {
  const contratoId = strId(a.id)
  return {
    contract: toContract(a),
    bitacora: toBitacora(a.bitacora, contratoId),
    estimaciones: a.estimaciones.map(toEstimacion),
    ordenesPago: a.estimaciones.filter((e) => e.orden_pago).map((e) => toOrdenPago(e.orden_pago as ApiOrdenPago)),
    garantias: a.garantias.map(toGarantia),
    anticipo: a.anticipo ? toAnticipo(a.anticipo) : null,
    convenios: a.convenios.map(toConvenio),
    avances: a.avances.map(toAvanceDiario),
    incumplimientos: a.incumplimientos.map(toIncumplimiento),
    minutas: a.minutas.map(toMinuta),
    programaObra: toProgramaObra(a.programa_obra, contratoId),
    solicitudActivacion: a.solicitud_activacion ? toSolicitudActivacion(a.solicitud_activacion, contratoId) : null,
  }
}

// ── Endpoints: contratistas y personas ───────────────────────────────────────

export function fetchContratistas() {
  return apiGet<ApiContratista[]>("/contracts/contratistas/")
}

export function createContratistaRequest(payload: Omit<Contratista, "id">) {
  return apiPost<ApiContratista>("/contracts/contratistas/", payload)
}

export function fetchPersonas() {
  return apiGet<ApiPersona[]>("/contracts/personas/")
}

export function createPersonaRequest(payload: Omit<Persona, "id">) {
  return apiPost<ApiPersona>("/contracts/personas/", payload)
}

// ── Endpoints: contratos ──────────────────────────────────────────────────────

export function fetchContratos() {
  return apiGet<ApiContract[]>("/contracts/contratos/")
}

export function fetchContrato(contratoId: string) {
  return apiGet<ApiContract>(`/contracts/contratos/${contratoId}/`)
}

export interface CreateContratoPayload {
  no_contrato: string
  objeto: string
  descripcion: string
  monto: number
  plazo_dias: number
  fecha_inicio: string
  fecha_termino: string
  ubicacion: string
  contratista_id: string
  residente_id: string
  supervisor_id: string
  superintendente_id: string
}

export function createContratoRequest(payload: CreateContratoPayload) {
  return apiPost<ApiContract>("/contracts/contratos/", payload)
}

export function uploadDocumentoRequest(contratoId: string, formData: FormData) {
  return apiPost<ApiContractDocument>(`/contracts/contratos/${contratoId}/documentos/`, formData)
}

export interface ConceptoCatalogoPayload {
  clave: string
  descripcion: string
  unidad: string
  cantidad: number
  precio_unitario: number
  capitulo?: string
}

export function putCatalogoRequest(contratoId: string, conceptos: ConceptoCatalogoPayload[]) {
  return apiPut<ApiConceptoCatalogo[]>(`/contracts/contratos/${contratoId}/catalogo/`, conceptos)
}

export interface ConceptoProgramaPayload {
  concepto_id: number
  semanas: { semana: number; cantidad: number }[]
}

export function putProgramaObraRequest(contratoId: string, conceptos: ConceptoProgramaPayload[]) {
  return apiPut<ApiProgramaObra>(`/contracts/contratos/${contratoId}/programa-obra/`, conceptos)
}

export function solicitarActivacionRequest(contratoId: string) {
  return apiPost<ApiContract>(`/contracts/contratos/${contratoId}/solicitar-activacion/`)
}

export function revisarActivacionRequest(contratoId: string, aprobado: boolean, observaciones: string) {
  return apiPost<ApiContract>(`/contracts/contratos/${contratoId}/revisar-activacion/`, { aprobado, observaciones })
}

export function abrirBitacoraRequest(contratoId: string, notaApertura: string) {
  return apiPost<ApiBitacora>(`/contracts/contratos/${contratoId}/bitacora/abrir/`, { nota_apertura: notaApertura })
}

export function addBitacoraNotaRequest(contratoId: string, formData: FormData) {
  return apiPost<ApiBitacoraNote>(`/contracts/contratos/${contratoId}/bitacora/notas/`, formData)
}

// ── Endpoints: estimaciones y órdenes de pago ────────────────────────────────

export interface CreateEstimacionPayload {
  contrato_id: string
  periodo_inicio: string
  periodo_fin: string
  caratula: string
  numeros_generadores: string
  registro_fotografico: number
  notas_soporte: number
  importe_bruto: number
}

export function createEstimacionRequest(payload: CreateEstimacionPayload) {
  return apiPost<ApiEstimacion>("/contracts/estimaciones/", payload)
}

export function revisarEstimacionRequest(estimacionId: string, status: "aceptada" | "rechazada", observaciones: string) {
  return apiPost<ApiEstimacion>(`/contracts/estimaciones/${estimacionId}/revisar/`, { status, observaciones })
}

export function dispersarPagoRequest(ordenId: string) {
  return apiPost<ApiOrdenPago>(`/contracts/ordenes-pago/${ordenId}/dispersar/`)
}

// ── Endpoints: garantías y anticipos ─────────────────────────────────────────

export function createGarantiaRequest(body: FormData) {
  return apiPost<ApiGarantia>("/contracts/garantias/", body)
}

export function liberarGarantiaRequest(garantiaId: string) {
  return apiPost<ApiGarantia>(`/contracts/garantias/${garantiaId}/liberar/`)
}

export interface CreateAnticipoPayload {
  contrato_id: string
  monto_otorgado: number
  porcentaje_contrato: number
  porcentaje_amortizacion: number
  fecha_entrega: string
  garantia?: string | null
}

export function createAnticipoRequest(payload: CreateAnticipoPayload) {
  return apiPost<ApiAnticipo>("/contracts/anticipos/", payload)
}

// ── Endpoints: convenios ──────────────────────────────────────────────────────

export function createConvenioRequest(body: FormData) {
  return apiPost<ApiConvenio>("/contracts/convenios/", body)
}

export function revisarConvenioRequest(convenioId: string, status: "aprobado" | "rechazado", motivoRechazo: string) {
  return apiPost<ApiConvenio>(`/contracts/convenios/${convenioId}/revisar/`, { status, motivo_rechazo: motivoRechazo })
}

// ── Endpoints: avances, incumplimientos, minutas ─────────────────────────────

export interface CreateAvancePayload {
  contrato_id: string
  tipo: string
  descripcion: string
  evidencia?: string
}

export function createAvanceRequest(payload: CreateAvancePayload) {
  return apiPost<ApiAvanceDiario>("/contracts/avances/", payload)
}

export interface CreateIncumplimientoPayload {
  contrato_id: string
  tipo: string
  descripcion: string
  evidencia_ref?: string
}

export function createIncumplimientoRequest(payload: CreateIncumplimientoPayload) {
  return apiPost<ApiIncumplimiento>("/contracts/incumplimientos/", payload)
}

export interface CreateMinutaPayload {
  contrato_id: string
  titulo: string
  participantes?: string
  acuerdos?: string
  observaciones?: string
  compromisos?: string
}

export function createMinutaRequest(payload: CreateMinutaPayload) {
  return apiPost<ApiMinuta>("/contracts/minutas/", payload)
}
