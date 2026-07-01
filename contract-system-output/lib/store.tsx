"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react"
import { toast } from "sonner"
import type {
  Anticipo,
  AvanceDiario,
  AvanceTipo,
  Bitacora,
  ConceptoCatalogo,
  Contract,
  Contratista,
  Convenio,
  ConvenioAlcance,
  ConvenioConceptoAfectado,
  ConvenioTipo,
  DocBlock,
  EmpresaSupervision,
  Estimacion,
  Finiquito,
  Garantia,
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
  TerminacionContrato,
  User,
} from "./types"
import {
  abrirBitacoraRequest,
  addBitacoraNotaRequest,
  adaptContractBundle,
  cargarActaRequest,
  cerrarFiniquitoRequest,
  clearTokens,
  createAnticipoRequest,
  createAvanceRequest,
  createContratistaRequest,
  createContratoRequest,
  createConvenioRequest,
  createEmpresaSupervisionRequest,
  createEstimacionRequest,
  createGarantiaRequest,
  createIncumplimientoRequest,
  createMinutaRequest,
  createPersonaRequest,
  dispersarPagoRequest,
  emitirFiniquitoRequest,
  fetchContrato,
  fetchContratistas,
  fetchContratos,
  fetchEmpresasSupervision,
  fetchPersonas,
  liberarGarantiaRequest,
  loginRequest,
  meRequest,
  notificarFiniquitoRequest,
  crearReporteAvanceRequest,
  putCatalogoRequest,
  putProgramaObraRequest,
  responderFiniquitoRequest,
  resolverIncumplimientoRequest,
  revisarActivacionRequest,
  revisarConvenioRequest,
  revisarEstimacionRequest,
  revisarReporteAvanceRequest,
  solicitarActivacionRequest,
  terminarContratoRequest,
  toContratista,
  toEmpresaSupervision,
  toOrdenPago,
  toPersona,
  uploadDocumentoRequest,
  type ApiUser,
  type ContractBundle,
  type EmitirFiniquitoPayload,
  type ResponderFiniquitoPayload,
  type TerminarContratoPayload,
} from "./api"

function toUser(apiUser: ApiUser): User {
  return {
    id: String(apiUser.id),
    name: apiUser.name,
    email: apiUser.email,
    password: "",
    role: apiUser.role as Role,
    initials: apiUser.initials,
    personaId: apiUser.persona_id ?? undefined,
  }
}

interface AppState {
  user: User | null
  /** true mientras se hidrata la sesión (meRequest) o se cargan los contratos al iniciar sesión */
  loading: boolean
  login: (email: string, password: string) => Promise<User | null>
  logout: () => void

  contracts: Contract[]
  contratistas: Contratista[]
  empresasSupervision: EmpresaSupervision[]
  residentes: Persona[]
  supervisores: Persona[]
  superintendentes: Persona[]
  bitacoras: Bitacora[]
  estimaciones: Estimacion[]
  convenios: Convenio[]
  ordenesPago: OrdenPago[]
  avances: AvanceDiario[]
  incumplimientos: Incumplimiento[]
  minutas: Minuta[]
  programasObra: ProgramaObra[]
  garantias: Garantia[]
  anticipos: Anticipo[]
  solicitudesActivacion: SolicitudActivacion[]

  addContract: (
    c: Omit<
      Contract,
      | "id"
      | "version"
      | "documentos"
      | "versiones"
      | "avanceProgramado"
      | "avanceReal"
      | "catalogoConceptos"
      | "reportesAvance"
    >,
  ) => Promise<void>
  addContratista: (c: Omit<Contratista, "id" | "superintendentes">) => Promise<Contratista>
  addEmpresaSupervision: (e: Omit<EmpresaSupervision, "id" | "supervisores">) => Promise<EmpresaSupervision>
  addResidente: (p: Pick<Persona, "nombre" | "rfc" | "telefono" | "correo">) => Promise<Persona>
  addSupervisor: (p: Pick<Persona, "nombre" | "rfc" | "telefono" | "correo">, empresaSupervisionId: string) => Promise<Persona>
  addSuperintendente: (p: Pick<Persona, "nombre" | "rfc" | "telefono" | "correo">, empresaContratistaId: string) => Promise<Persona>
  addDocument: (contratoId: string, bloque: DocBlock, archivo: File) => Promise<void>
  setCatalogoConceptos: (contratoId: string, conceptos: ConceptoCatalogo[]) => Promise<void>
  openBitacora: (contratoId: string, notaApertura: string) => Promise<void>
  addNote: (
    contratoId: string,
    note: { tipo: NoteType; contenido: string; conceptos?: string[]; notaPadreId?: string | null },
  ) => Promise<void>
  addEstimacion: (e: {
    contratoId: string
    periodoInicio: string
    periodoFin: string
    caratula: string
    numerosGeneradores: string
    registroFotografico: number
    notasSoporte: number
    importeBruto: number
    lineas?: Array<{ conceptoId: string; reporteIds: string[]; generadorDetalle?: string }>
  }) => Promise<void>
  reviewEstimacion: (id: string, status: "aceptada" | "rechazada", observaciones: string) => Promise<{ advertenciaAvance?: string }>
  addConvenio: (
    c: {
      contratoId: string
      tipo: ConvenioTipo
      justificacion: string
      montoAdicional: number
      diasAdicionales: number
      alcance: ConvenioAlcance
      conceptosAfectados?: ConvenioConceptoAfectado[]
      conceptosNuevos?: ConceptoCatalogo[]
    },
    archivos?: File[],
  ) => Promise<void>
  reviewConvenio: (id: string, status: "aprobado" | "rechazado", motivoRechazo: string) => Promise<void>
  attendPago: (id: string) => Promise<void>
  addAvance: (a: { contratoId: string; tipo: AvanceTipo; descripcion: string; evidencia?: string }) => Promise<void>
  addIncumplimiento: (i: {
    contratoId: string
    tipo: IncumplimientoTipo
    descripcion: string
    evidenciaRef?: string
  }) => Promise<void>
  addMinuta: (m: {
    contratoId: string
    titulo: string
    participantes?: string
    acuerdos?: string
    observaciones?: string
    compromisos?: string
  }) => Promise<void>
  setProgramaObra: (contratoId: string, conceptos: ProgramaObra["conceptos"]) => Promise<void>
  addGarantia: (
    g: {
      contratoId: string
      tipo: GarantiaTipo
      institucionAfianzadora: string
      numeroPoliza: string
      monto: number
      fechaEmision: string
      fechaVigencia: string
    },
    archivo?: File,
  ) => Promise<void>
  liberarGarantia: (id: string) => Promise<void>
  addAnticipo: (a: {
    contratoId: string
    montoOtorgado: number
    porcentajeContrato: number
    porcentajeAmortizacion: number
    fechaEntrega: string
    garantiaId?: string
  }) => Promise<void>
  /** Dependencia solicita activar un contrato en estado registrado */
  requestActivation: (contratoId: string) => Promise<void>
  /** Residente aprueba o rechaza la solicitud de activación */
  reviewActivation: (contratoId: string, aprobado: boolean, observaciones: string) => Promise<void>
  /** Returns the set of GarantiaTipo values already registered for a contract (cannot add again) */
  garantiasTiposUsados: (contratoId: string) => Set<GarantiaTipo>

  terminaciones: TerminacionContrato[]
  finiquitos: Finiquito[]

  terminarContrato: (contratoId: string, payload: TerminarContratoPayload) => Promise<void>
  cargarActa: (contratoId: string, archivo: File, fechaFirma: string) => Promise<void>
  emitirFiniquito: (contratoId: string, payload: EmitirFiniquitoPayload) => Promise<void>
  notificarFiniquito: (contratoId: string) => Promise<void>
  responderFiniquito: (contratoId: string, payload: ResponderFiniquitoPayload) => Promise<void>
  cerrarFiniquito: (contratoId: string) => Promise<void>
  resolverIncumplimiento: (incumplimientoId: string, contratoId: string) => Promise<void>

  registrarReporteAvance: (
    contratoId: string,
    r: { conceptoId: string; fecha: string; cantidad: number; frenteUbicacion: string; reporteAnteriorId?: string },
    fotografia: File,
  ) => Promise<void>
  revisarReporteAvance: (
    contratoId: string,
    reporteId: string,
    status: "validado" | "rechazado",
    observaciones: string,
  ) => Promise<{ conceptoTerminado?: boolean }>
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [contratistas, setContratistas] = useState<Contratista[]>([])
  const [empresasSupervision, setEmpresasSupervision] = useState<EmpresaSupervision[]>([])
  const [residentes, setResidentes] = useState<Persona[]>([])
  const [supervisores, setSupervisores] = useState<Persona[]>([])
  const [superintendentes, setSuperintendentes] = useState<Persona[]>([])
  const [bitacoras, setBitacoras] = useState<Bitacora[]>([])
  const [estimaciones, setEstimaciones] = useState<Estimacion[]>([])
  const [convenios, setConvenios] = useState<Convenio[]>([])
  const [ordenesPago, setOrdenesPago] = useState<OrdenPago[]>([])
  const [avances, setAvances] = useState<AvanceDiario[]>([])
  const [incumplimientos, setIncumplimientos] = useState<Incumplimiento[]>([])
  const [minutas, setMinutas] = useState<Minuta[]>([])
  const [programasObra, setProgramasObra] = useState<ProgramaObra[]>([])
  const [garantias, setGarantias] = useState<Garantia[]>([])
  const [anticipos, setAnticipos] = useState<Anticipo[]>([])
  const [solicitudesActivacion, setSolicitudesActivacion] = useState<SolicitudActivacion[]>([])
  const [terminaciones, setTerminaciones] = useState<TerminacionContrato[]>([])
  const [finiquitos, setFiniquitos] = useState<Finiquito[]>([])

  async function loadPersonasYContratistas() {
    const [resContratistas, resEmpresasSup, resResidentes] = await Promise.allSettled([
      fetchContratistas(),
      fetchEmpresasSupervision(),
      fetchPersonas({ sin_empresa: true }),
    ])
    const apiContratistas = resContratistas.status === "fulfilled" ? resContratistas.value : []
    const apiEmpresasSup = resEmpresasSup.status === "fulfilled" ? resEmpresasSup.value : []
    const apiResidentes = resResidentes.status === "fulfilled" ? resResidentes.value : []

    const mappedContratistas = apiContratistas.map(toContratista)
    const mappedEmpresasSup = apiEmpresasSup.map(toEmpresaSupervision)
    setContratistas(mappedContratistas)
    setEmpresasSupervision(mappedEmpresasSup)
    setResidentes(apiResidentes.map(toPersona))
    setSupervisores(mappedEmpresasSup.flatMap((e) => e.supervisores))
    setSuperintendentes(mappedContratistas.flatMap((c) => c.superintendentes))
  }

  function applyBundle(bundle: ContractBundle) {
    const cId = bundle.contract.id
    setContracts((prev) => {
      const exists = prev.some((c) => c.id === cId)
      return exists ? prev.map((c) => (c.id === cId ? bundle.contract : c)) : [bundle.contract, ...prev]
    })
    setBitacoras((prev) => [...prev.filter((b) => b.contratoId !== cId), bundle.bitacora])
    setEstimaciones((prev) => [...prev.filter((e) => e.contratoId !== cId), ...bundle.estimaciones])
    setOrdenesPago((prev) => [...prev.filter((o) => o.contratoId !== cId), ...bundle.ordenesPago])
    setConvenios((prev) => [...prev.filter((c) => c.contratoId !== cId), ...bundle.convenios])
    setGarantias((prev) => [...prev.filter((g) => g.contratoId !== cId), ...bundle.garantias])
    setAnticipos((prev) => {
      const rest = prev.filter((a) => a.contratoId !== cId)
      return bundle.anticipo ? [...rest, bundle.anticipo] : rest
    })
    setAvances((prev) => [...prev.filter((a) => a.contratoId !== cId), ...bundle.avances])
    setIncumplimientos((prev) => [...prev.filter((i) => i.contratoId !== cId), ...bundle.incumplimientos])
    setMinutas((prev) => [...prev.filter((m) => m.contratoId !== cId), ...bundle.minutas])
    setProgramasObra((prev) => [...prev.filter((p) => p.contratoId !== cId), bundle.programaObra])
    setSolicitudesActivacion((prev) => {
      const rest = prev.filter((s) => s.contratoId !== cId)
      return bundle.solicitudActivacion ? [...rest, bundle.solicitudActivacion] : rest
    })
    setTerminaciones((prev) => {
      const rest = prev.filter((t) => t.contratoId !== cId)
      return bundle.terminacion ? [...rest, bundle.terminacion] : rest
    })
    setFiniquitos((prev) => {
      const rest = prev.filter((f) => f.contratoId !== cId)
      return bundle.finiquito ? [...rest, bundle.finiquito] : rest
    })
  }

  async function refreshContrato(contratoId: string) {
    const api = await fetchContrato(contratoId)
    applyBundle(adaptContractBundle(api))
  }

  async function loadAll() {
    const apiContratos = await fetchContratos()
    const bundles = apiContratos.map(adaptContractBundle)
    setContracts(bundles.map((b) => b.contract))
    setBitacoras(bundles.map((b) => b.bitacora))
    setEstimaciones(bundles.flatMap((b) => b.estimaciones))
    setOrdenesPago(bundles.flatMap((b) => b.ordenesPago))
    setConvenios(bundles.flatMap((b) => b.convenios))
    setGarantias(bundles.flatMap((b) => b.garantias))
    setAnticipos(bundles.flatMap((b) => (b.anticipo ? [b.anticipo] : [])))
    setAvances(bundles.flatMap((b) => b.avances))
    setIncumplimientos(bundles.flatMap((b) => b.incumplimientos))
    setMinutas(bundles.flatMap((b) => b.minutas))
    setProgramasObra(bundles.map((b) => b.programaObra))
    setSolicitudesActivacion(bundles.flatMap((b) => (b.solicitudActivacion ? [b.solicitudActivacion] : [])))
    setTerminaciones(bundles.flatMap((b) => (b.terminacion ? [b.terminacion] : [])))
    setFiniquitos(bundles.flatMap((b) => (b.finiquito ? [b.finiquito] : [])))
    await loadPersonasYContratistas()
  }

  useEffect(() => {
    meRequest()
      .then(async (apiUser) => {
        if (apiUser) {
          setUser(toUser(apiUser))
          await loadAll()
        }
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function login(email: string, password: string) {
    const apiUser = await loginRequest(email, password)
    if (!apiUser) return null
    const u = toUser(apiUser)
    setUser(u)
    setLoading(true)
    try {
      await loadAll()
    } finally {
      setLoading(false)
    }
    return u
  }

  function logout() {
    setUser(null)
    clearTokens()
    setContracts([])
    setContratistas([])
    setEmpresasSupervision([])
    setResidentes([])
    setSupervisores([])
    setSuperintendentes([])
    setBitacoras([])
    setEstimaciones([])
    setConvenios([])
    setOrdenesPago([])
    setAvances([])
    setIncumplimientos([])
    setMinutas([])
    setProgramasObra([])
    setGarantias([])
    setAnticipos([])
    setSolicitudesActivacion([])
    setTerminaciones([])
    setFiniquitos([])
  }

  const addContract: AppState["addContract"] = async (c) => {
    const api = await createContratoRequest({
      no_contrato: c.noContrato,
      objeto: c.objeto,
      descripcion: c.descripcion,
      monto: c.monto,
      plazo_dias: c.plazoDias,
      fecha_inicio: c.fechaInicio,
      ubicacion: c.ubicacion,
      contratista_id: c.contratista.id,
      residente_id: c.residente.id,
      supervisor_id: c.supervisor.id,
      superintendente_id: c.superintendente.id,
      empresa_supervision_id: c.supervisor.empresaSupervision ?? null,
    })
    applyBundle(adaptContractBundle(api))
  }

  const addContratista: AppState["addContratista"] = async (c) => {
    const api = await createContratistaRequest(c)
    const nuevo = toContratista(api)
    setContratistas((prev) => [...prev, nuevo])
    return nuevo
  }

  const addEmpresaSupervision: AppState["addEmpresaSupervision"] = async (e) => {
    const api = await createEmpresaSupervisionRequest(e)
    const nueva = toEmpresaSupervision(api)
    setEmpresasSupervision((prev) => [...prev, nueva])
    return nueva
  }

  function notificarCuentaCreada(correo: string) {
    toast.success(`Cuenta de acceso creada`, {
      description: `Usuario: ${correo} · Contraseña temporal: demo123`,
      duration: 8000,
    })
  }

  const addResidente: AppState["addResidente"] = async (p) => {
    const api = await createPersonaRequest(p)
    const nueva = toPersona(api)
    setResidentes((prev) => [...prev, nueva])
    if (api.usuario_creado) notificarCuentaCreada(nueva.correo)
    return nueva
  }

  const addSupervisor: AppState["addSupervisor"] = async (p, empresaSupervisionId) => {
    const api = await createPersonaRequest({ ...p, empresa_supervision: Number(empresaSupervisionId) })
    const nueva = toPersona(api)
    setEmpresasSupervision((prev) =>
      prev.map((e) =>
        e.id === empresaSupervisionId ? { ...e, supervisores: [...e.supervisores, nueva] } : e,
      ),
    )
    setSupervisores((prev) => [...prev, nueva])
    if (api.usuario_creado) notificarCuentaCreada(nueva.correo)
    return nueva
  }

  const addSuperintendente: AppState["addSuperintendente"] = async (p, empresaContratistaId) => {
    const api = await createPersonaRequest({ ...p, empresa_contratista: Number(empresaContratistaId) })
    const nueva = toPersona(api)
    setContratistas((prev) =>
      prev.map((c) =>
        c.id === empresaContratistaId ? { ...c, superintendentes: [...c.superintendentes, nueva] } : c,
      ),
    )
    setSuperintendentes((prev) => [...prev, nueva])
    if (api.usuario_creado) notificarCuentaCreada(nueva.correo)
    return nueva
  }

  const addDocument: AppState["addDocument"] = async (contratoId, bloque, archivo) => {
    const formData = new FormData()
    formData.append("bloque", bloque)
    formData.append("nombre", archivo.name)
    formData.append("archivo", archivo)
    await uploadDocumentoRequest(contratoId, formData)
    await refreshContrato(contratoId)
  }

  const setCatalogoConceptos: AppState["setCatalogoConceptos"] = async (contratoId, conceptos) => {
    await putCatalogoRequest(
      contratoId,
      conceptos.map((c) => ({
        clave: c.clave,
        descripcion: c.descripcion,
        unidad: c.unidad,
        cantidad: c.cantidad,
        precio_unitario: c.precioUnitario,
        capitulo: c.capitulo,
      })),
    )
    await refreshContrato(contratoId)
  }

  const openBitacora: AppState["openBitacora"] = async (contratoId, notaApertura) => {
    await abrirBitacoraRequest(contratoId, notaApertura)
    await refreshContrato(contratoId)
  }

  const addNote: AppState["addNote"] = async (contratoId, note) => {
    const formData = new FormData()
    formData.append("tipo", note.tipo)
    formData.append("contenido", note.contenido)
    for (const conceptoId of note.conceptos ?? []) {
      formData.append("conceptos", conceptoId)
    }
    if (note.notaPadreId != null) {
      formData.append("nota_padre", note.notaPadreId)
    }
    await addBitacoraNotaRequest(contratoId, formData)
    await refreshContrato(contratoId)
  }

  const addEstimacion: AppState["addEstimacion"] = async (e) => {
    await createEstimacionRequest({
      contrato_id: e.contratoId,
      periodo_inicio: e.periodoInicio,
      periodo_fin: e.periodoFin,
      caratula: e.caratula,
      numeros_generadores: e.numerosGeneradores,
      registro_fotografico: e.registroFotografico,
      notas_soporte: e.notasSoporte,
      importe_bruto: e.importeBruto,
      lineas: e.lineas?.map((l) => ({
        concepto_id: parseInt(l.conceptoId),
        reporte_ids: l.reporteIds.map((id) => parseInt(id)),
        generador_detalle: l.generadorDetalle,
      })),
    })
    await refreshContrato(e.contratoId)
  }

  const reviewEstimacion: AppState["reviewEstimacion"] = async (id, status, observaciones) => {
    const estimacion = estimaciones.find((e) => e.id === id)
    const resp = await revisarEstimacionRequest(id, status, observaciones)
    if (estimacion) await refreshContrato(estimacion.contratoId)
    return { advertenciaAvance: (resp as Record<string, unknown>).advertencia_avance as string | undefined }
  }

  const addConvenio: AppState["addConvenio"] = async (c, archivos) => {
    const formData = new FormData()
    formData.append("contrato_id", c.contratoId)
    formData.append("tipo", c.tipo)
    formData.append("justificacion", c.justificacion)
    formData.append("monto_adicional", String(c.montoAdicional))
    formData.append("dias_adicionales", String(c.diasAdicionales))
    formData.append("alcance", c.alcance)
    if (c.conceptosAfectados) {
      formData.append(
        "conceptos_afectados",
        JSON.stringify(
          c.conceptosAfectados.map((a) => ({
            concepto_id: a.conceptoId,
            cantidad_anterior: a.cantidadAnterior,
            cantidad_nueva: a.cantidadNueva,
          })),
        ),
      )
    }
    if (c.conceptosNuevos) {
      formData.append(
        "conceptos_nuevos",
        JSON.stringify(
          c.conceptosNuevos.map((n) => ({
            clave: n.clave,
            descripcion: n.descripcion,
            unidad: n.unidad,
            cantidad: n.cantidad,
            precio_unitario: n.precioUnitario,
            capitulo: n.capitulo ?? "",
          })),
        ),
      )
    }
    for (const archivo of archivos ?? []) {
      formData.append("documentos", archivo)
    }
    await createConvenioRequest(formData)
    await refreshContrato(c.contratoId)
  }

  const reviewConvenio: AppState["reviewConvenio"] = async (id, status, motivoRechazo) => {
    const convenio = convenios.find((c) => c.id === id)
    await revisarConvenioRequest(id, status, motivoRechazo)
    if (convenio) await refreshContrato(convenio.contratoId)
  }

  const attendPago: AppState["attendPago"] = async (id) => {
    const api = await dispersarPagoRequest(id)
    const mapped = toOrdenPago(api)
    setOrdenesPago((prev) => prev.map((o) => (o.id === mapped.id ? mapped : o)))
  }

  const addAvance: AppState["addAvance"] = async (a) => {
    await createAvanceRequest({
      contrato_id: a.contratoId,
      tipo: a.tipo,
      descripcion: a.descripcion,
      evidencia: a.evidencia,
    })
    await refreshContrato(a.contratoId)
  }

  const addIncumplimiento: AppState["addIncumplimiento"] = async (i) => {
    await createIncumplimientoRequest({
      contrato_id: i.contratoId,
      tipo: i.tipo,
      descripcion: i.descripcion,
      evidencia_ref: i.evidenciaRef,
    })
    await refreshContrato(i.contratoId)
  }

  const addMinuta: AppState["addMinuta"] = async (m) => {
    await createMinutaRequest({
      contrato_id: m.contratoId,
      titulo: m.titulo,
      participantes: m.participantes,
      acuerdos: m.acuerdos,
      observaciones: m.observaciones,
      compromisos: m.compromisos,
    })
    await refreshContrato(m.contratoId)
  }

  const setProgramaObra: AppState["setProgramaObra"] = async (contratoId, conceptos) => {
    await putProgramaObraRequest(
      contratoId,
      conceptos.map((c) => ({
        concepto_id: Number(c.conceptoId),
        meses: c.meses.map((m) => ({ mes: m.mes, cantidad: m.cantidad })),
      })),
    )
    await refreshContrato(contratoId)
  }

  const addGarantia: AppState["addGarantia"] = async (g, archivo) => {
    const formData = new FormData()
    formData.append("contrato_id", g.contratoId)
    formData.append("tipo", g.tipo)
    formData.append("institucion_afianzadora", g.institucionAfianzadora)
    formData.append("numero_poliza", g.numeroPoliza)
    formData.append("monto", String(g.monto))
    formData.append("fecha_emision", g.fechaEmision)
    formData.append("fecha_vigencia", g.fechaVigencia)
    if (archivo) formData.append("archivo", archivo)
    await createGarantiaRequest(formData)
    await refreshContrato(g.contratoId)
  }

  const liberarGarantia: AppState["liberarGarantia"] = async (id) => {
    const garantia = garantias.find((g) => g.id === id)
    await liberarGarantiaRequest(id)
    if (garantia) await refreshContrato(garantia.contratoId)
  }

  const addAnticipo: AppState["addAnticipo"] = async (a) => {
    await createAnticipoRequest({
      contrato_id: a.contratoId,
      monto_otorgado: a.montoOtorgado,
      porcentaje_contrato: a.porcentajeContrato,
      porcentaje_amortizacion: a.porcentajeAmortizacion,
      fecha_entrega: a.fechaEntrega,
      garantia: a.garantiaId || null,
    })
    await refreshContrato(a.contratoId)
  }

  const terminarContrato: AppState["terminarContrato"] = async (contratoId, payload) => {
    const api = await terminarContratoRequest(contratoId, payload)
    applyBundle(adaptContractBundle(api))
  }

  const cargarActa: AppState["cargarActa"] = async (contratoId, archivo, fechaFirma) => {
    const formData = new FormData()
    formData.append("archivo", archivo)
    formData.append("fecha_firma", fechaFirma)
    const api = await cargarActaRequest(contratoId, formData)
    applyBundle(adaptContractBundle(api))
  }

  const emitirFiniquito: AppState["emitirFiniquito"] = async (contratoId, payload) => {
    const api = await emitirFiniquitoRequest(contratoId, payload)
    applyBundle(adaptContractBundle(api))
  }

  const notificarFiniquito: AppState["notificarFiniquito"] = async (contratoId) => {
    const api = await notificarFiniquitoRequest(contratoId)
    applyBundle(adaptContractBundle(api))
  }

  const responderFiniquito: AppState["responderFiniquito"] = async (contratoId, payload) => {
    const api = await responderFiniquitoRequest(contratoId, payload)
    applyBundle(adaptContractBundle(api))
  }

  const cerrarFiniquito: AppState["cerrarFiniquito"] = async (contratoId) => {
    const api = await cerrarFiniquitoRequest(contratoId)
    applyBundle(adaptContractBundle(api))
  }

  const resolverIncumplimiento: AppState["resolverIncumplimiento"] = async (incumplimientoId, contratoId) => {
    const api = await resolverIncumplimientoRequest(incumplimientoId)
    setIncumplimientos((prev) =>
      prev.map((i) => (i.id === String(api.id) ? { ...i, resuelto: true } : i))
    )
  }

  const registrarReporteAvance: AppState["registrarReporteAvance"] = async (contratoId, r, fotografia) => {
    const formData = new FormData()
    formData.append("concepto_id", r.conceptoId)
    formData.append("fecha", r.fecha)
    formData.append("cantidad", String(r.cantidad))
    formData.append("frente_ubicacion", r.frenteUbicacion)
    formData.append("fotografia", fotografia)
    if (r.reporteAnteriorId) {
      formData.append("reporte_anterior", r.reporteAnteriorId)
    }
    await crearReporteAvanceRequest(formData)
    await refreshContrato(contratoId)
  }

  const revisarReporteAvance: AppState["revisarReporteAvance"] = async (
    contratoId,
    reporteId,
    status,
    observaciones,
  ) => {
    const resp = await revisarReporteAvanceRequest(reporteId, status, observaciones)
    await refreshContrato(contratoId)
    return { conceptoTerminado: resp.concepto_terminado }
  }

  const requestActivation: AppState["requestActivation"] = async (contratoId) => {
    await solicitarActivacionRequest(contratoId)
    await refreshContrato(contratoId)
  }

  const reviewActivation: AppState["reviewActivation"] = async (contratoId, aprobado, observaciones) => {
    await revisarActivacionRequest(contratoId, aprobado, observaciones)
    await refreshContrato(contratoId)
  }

  function garantiasTiposUsados(contratoId: string): Set<GarantiaTipo> {
    return new Set(garantias.filter((g) => g.contratoId === contratoId).map((g) => g.tipo))
  }

  const value: AppState = {
    user,
    loading,
    login,
    logout,
    contracts,
    contratistas,
    empresasSupervision,
    residentes,
    supervisores,
    superintendentes,
    bitacoras,
    estimaciones,
    convenios,
    ordenesPago,
    avances,
    incumplimientos,
    minutas,
    programasObra,
    garantias,
    anticipos,
    solicitudesActivacion,
    addContract,
    addContratista,
    addEmpresaSupervision,
    addResidente,
    addSupervisor,
    addSuperintendente,
    addDocument,
    setCatalogoConceptos,
    openBitacora,
    addNote,
    addEstimacion,
    reviewEstimacion,
    addConvenio,
    reviewConvenio,
    attendPago,
    addAvance,
    addIncumplimiento,
    addMinuta,
    setProgramaObra,
    addGarantia,
    liberarGarantia,
    addAnticipo,
    requestActivation,
    reviewActivation,
    garantiasTiposUsados,
    terminaciones,
    finiquitos,
    terminarContrato,
    cargarActa,
    emitirFiniquito,
    notificarFiniquito,
    responderFiniquito,
    cerrarFiniquito,
    resolverIncumplimiento,
    registrarReporteAvance,
    revisarReporteAvance,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}

// Permission helpers
export function can(role: Role | undefined, action: string): boolean {
  if (!role) return false
  const matrix: Record<string, Role[]> = {
    "contrato.crear": ["dependencia"],
    "contrato.activar": ["dependencia"],
    "contrato.revisar-activacion": ["residente"],
    "bitacora.abrir": ["residente"],
    "bitacora.notear": ["residente", "superintendente", "supervision"],
    "detalle.registrar": ["residente"],
    "estimacion.crear": ["superintendente"],
    "estimacion.revisar": ["supervision", "residente"],
    "convenio.crear": ["superintendente", "residente"],
    "convenio.revisar": ["dependencia"],
    "pago.dispersar": ["finanzas"],
    "avance.registrar": ["supervision"],
    "incumplimiento.registrar": ["residente"],
    "minuta.registrar": ["residente", "superintendente", "supervision"],
    "garantia.registrar": ["superintendente"],
    "incumplimiento.resolver": ["residente"],
    "cierre.terminar": ["residente"],
    "cierre.cargar-acta": ["residente"],
    "finiquito.emitir": ["residente"],
    "finiquito.notificar": ["residente"],
    "finiquito.responder": ["residente", "superintendente"],
    "finiquito.cerrar": ["residente"],
    "avance_concepto.registrar": ["superintendente"],
    "avance_concepto.validar": ["supervision"],
  }
  return matrix[action]?.includes(role) ?? false
}
