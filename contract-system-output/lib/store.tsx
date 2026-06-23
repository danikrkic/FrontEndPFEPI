"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  ANTICIPOS,
  AVANCES,
  BITACORAS,
  CONTRACTS,
  CONTRATISTAS,
  CONVENIOS,
  ESTIMACIONES,
  GARANTIAS,
  INCUMPLIMIENTOS,
  MINUTAS,
  ORDENES_PAGO,
  RESIDENTES,
  SUPERVISORES,
  USERS,
} from "./mock-data"
import type {
  Anticipo,
  AvanceDiario,
  Bitacora,
  BitacoraNote,
  ConceptoCatalogo,
  Contract,
  ContractVersion,
  Contratista,
  Convenio,
  Estimacion,
  Garantia,
  GarantiaTipo,
  Incumplimiento,
  Minuta,
  OrdenPago,
  Persona,
  ProgramaObra,
  Role,
  SolicitudActivacion,
  User,
} from "./types"
import { calcularDesgloseEstimacion, aplicarAjusteCantidades, sumarDias, hoy } from "./calculos"

interface AppState {
  user: User | null
  login: (email: string, password: string) => User | null
  logout: () => void

  contracts: Contract[]
  contratistas: Contratista[]
  residentes: Persona[]
  supervisores: Persona[]
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

  addContract: (c: Omit<Contract, "id" | "version" | "documentos" | "versiones" | "avanceProgramado" | "avanceReal" | "catalogoConceptos">) => void
  addContratista: (c: Omit<Contratista, "id">) => Contratista
  addResidente: (p: Omit<Persona, "id">) => Persona
  addSupervisor: (p: Omit<Persona, "id">) => Persona
  addDocument: (contratoId: string, doc: Contract["documentos"][number]) => void
  setCatalogoConceptos: (contratoId: string, conceptos: ConceptoCatalogo[]) => void
  openBitacora: (contratoId: string, notaApertura: string) => void
  addNote: (contratoId: string, note: Omit<BitacoraNote, "id" | "numero">) => void
  addEstimacion: (e: Omit<Estimacion, "id" | "numero" | "status" | "observaciones" | "amortizacionAnticipo" | "retencionGarantia" | "iva" | "importeNeto">) => void
  reviewEstimacion: (id: string, status: "aceptada" | "rechazada", observaciones: string) => void
  addConvenio: (c: Omit<Convenio, "id" | "status" | "motivoRechazo">) => void
  reviewConvenio: (id: string, status: "aprobado" | "rechazado", motivoRechazo: string) => void
  attendPago: (id: string) => void
  addAvance: (a: Omit<AvanceDiario, "id">) => void
  addIncumplimiento: (i: Omit<Incumplimiento, "id">) => void
  addMinuta: (m: Omit<Minuta, "id">) => void
  setProgramaObra: (contratoId: string, conceptos: ProgramaObra["conceptos"]) => void
  addGarantia: (g: Omit<Garantia, "id">) => void
  addAnticipo: (a: Omit<Anticipo, "id">) => void
  /** Dependencia solicita activar un contrato en estado registrado */
  requestActivation: (contratoId: string, solicitadoPor: string) => void
  /** Residente aprueba o rechaza la solicitud de activación */
  reviewActivation: (contratoId: string, aprobado: boolean, observaciones: string, revisadoPor: string) => void
  /** Returns the set of GarantiaTipo values already registered for a contract (cannot add again) */
  garantiasTiposUsados: (contratoId: string) => Set<GarantiaTipo>
}

const AppContext = createContext<AppState | null>(null)

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [contracts, setContracts] = useState<Contract[]>(CONTRACTS)
  const [contratistas, setContratistas] = useState<Contratista[]>(CONTRATISTAS)
  const [residentes, setResidentes] = useState<Persona[]>(RESIDENTES)
  const [supervisores, setSupervisores] = useState<Persona[]>(SUPERVISORES)
  const [bitacoras, setBitacoras] = useState<Bitacora[]>(BITACORAS)
  const [estimaciones, setEstimaciones] = useState<Estimacion[]>(ESTIMACIONES)
  const [convenios, setConvenios] = useState<Convenio[]>(CONVENIOS)
  const [ordenesPago, setOrdenesPago] = useState<OrdenPago[]>(ORDENES_PAGO)
  const [avances, setAvances] = useState<AvanceDiario[]>(AVANCES)
  const [incumplimientos, setIncumplimientos] = useState<Incumplimiento[]>(INCUMPLIMIENTOS)
  const [minutas, setMinutas] = useState<Minuta[]>(MINUTAS)
  const [programasObra, setProgramasObra] = useState<ProgramaObra[]>([])
  const [garantias, setGarantias] = useState<Garantia[]>(GARANTIAS)
  const [anticipos, setAnticipos] = useState<Anticipo[]>(ANTICIPOS)
  const [solicitudesActivacion, setSolicitudesActivacion] = useState<SolicitudActivacion[]>([])

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("gacm_user") : null
    if (stored) {
      const u = USERS.find((x) => x.id === stored)
      if (u) setUser(u)
    }
  }, [])

  const login = useCallback((email: string, password: string) => {
    const u = USERS.find(
      (x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password,
    )
    if (u) {
      setUser(u)
      localStorage.setItem("gacm_user", u.id)
      return u
    }
    return null
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem("gacm_user")
  }, [])

  const addContract = useCallback<AppState["addContract"]>((c) => {
    setContracts((prev) => [
      {
        ...c,
        id: uid("c"),
        version: 1,
        avanceProgramado: 0,
        avanceReal: 0,
        documentos: [],
        catalogoConceptos: [],
        versiones: [
          {
            version: 1,
            fecha: c.fechaInicio,
            monto: c.monto,
            fechaTermino: c.fechaTermino,
            motivo: "Contrato original",
          },
        ],
      },
      ...prev,
    ])
  }, [])

  const addContratista = useCallback<AppState["addContratista"]>((c) => {
    const nuevo = { ...c, id: uid("ct") }
    setContratistas((prev) => [...prev, nuevo])
    return nuevo
  }, [])

  const addResidente = useCallback<AppState["addResidente"]>((p) => {
    const nuevo = { ...p, id: uid("r") }
    setResidentes((prev) => [...prev, nuevo])
    return nuevo
  }, [])

  const addSupervisor = useCallback<AppState["addSupervisor"]>((p) => {
    const nuevo = { ...p, id: uid("s") }
    setSupervisores((prev) => [...prev, nuevo])
    return nuevo
  }, [])

  const addDocument = useCallback<AppState["addDocument"]>((contratoId, doc) => {
    setContracts((prev) =>
      prev.map((c) =>
        c.id === contratoId ? { ...c, documentos: [...c.documentos, doc] } : c,
      ),
    )
  }, [])

  const setCatalogoConceptos = useCallback<AppState["setCatalogoConceptos"]>(
    (contratoId, conceptos) => {
      setContracts((prev) =>
        prev.map((c) =>
          c.id === contratoId ? { ...c, catalogoConceptos: conceptos } : c,
        ),
      )
    },
    [],
  )

  const openBitacora = useCallback<AppState["openBitacora"]>((contratoId, notaApertura) => {
    setBitacoras((prev) => {
      const existing = prev.find((b) => b.contratoId === contratoId)
      const fecha = new Date().toISOString().slice(0, 10)
      if (existing) {
        return prev.map((b) =>
          b.contratoId === contratoId
            ? { ...b, abierta: true, fechaApertura: fecha, notaApertura }
            : b,
        )
      }
      return [
        ...prev,
        { contratoId, abierta: true, fechaApertura: fecha, notaApertura, notas: [] },
      ]
    })
  }, [])

  const addNote = useCallback<AppState["addNote"]>((contratoId, note) => {
    setBitacoras((prev) =>
      prev.map((b) => {
        if (b.contratoId !== contratoId) return b
        const numero = b.notas.length + 1
        return { ...b, notas: [...b.notas, { ...note, id: uid("bn"), numero }] }
      }),
    )
  }, [])

  const addEstimacion = useCallback<AppState["addEstimacion"]>((e) => {
    setEstimaciones((prev) => {
      const numero = prev.filter((x) => x.contratoId === e.contratoId).length + 1
      // Calcular desglose con el anticipo del contrato (si existe)
      const anticipo = anticipos.find((a) => a.contratoId === e.contratoId) ?? null
      const desglose = calcularDesgloseEstimacion(e.importeBruto, anticipo)
      return [
        ...prev,
        {
          ...e,
          id: uid("e"),
          numero,
          status: "en_revision",
          observaciones: "",
          ...desglose,
        },
      ]
    })
  }, [anticipos])

  // ── Cambio 2: reviewEstimacion actualiza saldo del anticipo al aceptar ──────
  const reviewEstimacion = useCallback<AppState["reviewEstimacion"]>(
    (id, status, observaciones) => {
      setEstimaciones((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status, observaciones } : e)),
      )
      if (status === "aceptada") {
        setEstimaciones((cur) => {
          const est = cur.find((e) => e.id === id)
          if (est) {
            // Actualizar saldo pendiente del anticipo
            setAnticipos((ants) =>
              ants.map((a) =>
                a.contratoId === est.contratoId
                  ? {
                      ...a,
                      saldoPendiente: Math.max(0, a.saldoPendiente - est.amortizacionAnticipo),
                    }
                  : a,
              ),
            )
            setOrdenesPago((ops) => {
              if (ops.some((o) => o.estimacionId === id)) return ops
              const contrato = contracts.find((c) => c.id === est.contratoId)
              return [
                {
                  id: uid("op"),
                  contratoId: est.contratoId,
                  noContrato: contrato?.noContrato ?? "",
                  estimacionId: est.id,
                  estimacionNumero: est.numero,
                  monto: est.importeNeto,
                  fechaEmision: new Date().toISOString().slice(0, 10),
                  status: "pendiente" as const,
                  fechaAtencion: null,
                },
                ...ops,
              ]
            })
          }
          return cur
        })
      }
    },
    [contracts],
  )

  const addConvenio = useCallback<AppState["addConvenio"]>((c) => {
    setConvenios((prev) => [
      { ...c, id: uid("cv"), status: "pendiente", motivoRechazo: "" },
      ...prev,
    ])
  }, [])

  // ── Cambio 5: aprobarConvenio con propagación al catálogo ────────────────────
  const reviewConvenio = useCallback<AppState["reviewConvenio"]>(
    (id, status, motivoRechazo) => {
      setConvenios((prev) => {
        const conv = prev.find((c) => c.id === id)
        if (conv && status === "aprobado") {
          setContracts((cs) =>
            cs.map((c) => {
              if (c.id !== conv.contratoId) return c

              // Snapshot versión anterior
              const versionAnterior: ContractVersion = {
                version: c.version,
                fecha: hoy(),
                monto: c.monto,
                fechaTermino: c.fechaTermino,
                motivo: `Previo a convenio ${conv.id}`,
                catalogoConceptos: [...c.catalogoConceptos],
              }

              // Propagar catálogo
              let catalogoActualizado = c.catalogoConceptos
              if (conv.alcance === "ajuste_cantidades" && conv.conceptosAfectados) {
                catalogoActualizado = aplicarAjusteCantidades(
                  catalogoActualizado,
                  conv.conceptosAfectados,
                )
              }
              if (conv.alcance === "conceptos_nuevos" && conv.conceptosNuevos) {
                catalogoActualizado = [...catalogoActualizado, ...conv.conceptosNuevos]
              }

              const nuevoMonto = c.monto + conv.montoAdicional
              const nuevaFechaTermino =
                conv.tipo !== "monto" && conv.diasAdicionales
                  ? sumarDias(c.fechaTermino, conv.diasAdicionales)
                  : c.fechaTermino

              return {
                ...c,
                monto: nuevoMonto,
                fechaTermino: nuevaFechaTermino,
                plazoDias: c.plazoDias + conv.diasAdicionales,
                version: c.version + 1,
                catalogoConceptos: catalogoActualizado,
                versiones: [
                  ...c.versiones,
                  versionAnterior,
                ],
              }
            }),
          )
        }
        return prev.map((c) =>
          c.id === id ? { ...c, status, motivoRechazo } : c,
        )
      })
    },
    [],
  )

  const attendPago = useCallback<AppState["attendPago"]>((id) => {
    setOrdenesPago((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, status: "atendida", fechaAtencion: new Date().toISOString().slice(0, 10) }
          : o,
      ),
    )
  }, [])

  const addAvance = useCallback<AppState["addAvance"]>((a) => {
    setAvances((prev) => [{ ...a, id: uid("a") }, ...prev])
  }, [])

  const addIncumplimiento = useCallback<AppState["addIncumplimiento"]>((i) => {
    setIncumplimientos((prev) => [{ ...i, id: uid("i") }, ...prev])
  }, [])

  const addMinuta = useCallback<AppState["addMinuta"]>((m) => {
    setMinutas((prev) => [{ ...m, id: uid("m") }, ...prev])
  }, [])

  const setProgramaObra = useCallback(
    (contratoId: string, conceptos: ProgramaObra["conceptos"]) => {
      setProgramasObra((prev) => {
        const exists = prev.find((p) => p.contratoId === contratoId)
        const updated: ProgramaObra = {
          contratoId,
          conceptos,
          updatedAt: new Date().toISOString(),
        }
        return exists
          ? prev.map((p) => (p.contratoId === contratoId ? updated : p))
          : [...prev, updated]
      })
    },
    [],
  )

  const addGarantia = useCallback<AppState["addGarantia"]>((g) => {
    setGarantias((prev) => [...prev, { ...g, id: uid("g") }])
  }, [])

  const addAnticipo = useCallback<AppState["addAnticipo"]>((a) => {
    setAnticipos((prev) => [...prev, { ...a, id: uid("ant") }])
  }, [])

  const requestActivation = useCallback<AppState["requestActivation"]>(
    (contratoId, solicitadoPor) => {
      setSolicitudesActivacion((prev) => {
        // Reemplazar solicitud previa rechazada si existe
        const sinAnterior = prev.filter((s) => s.contratoId !== contratoId)
        return [
          ...sinAnterior,
          {
            contratoId,
            status: "pendiente",
            solicitadoPor,
            fechaSolicitud: hoy(),
            revisadoPor: null,
            fechaRevision: null,
            observaciones: "",
          },
        ]
      })
    },
    [],
  )

  const reviewActivation = useCallback<AppState["reviewActivation"]>(
    (contratoId, aprobado, observaciones, revisadoPor) => {
      const fechaRevision = hoy()
      setSolicitudesActivacion((prev) =>
        prev.map((s) =>
          s.contratoId === contratoId
            ? {
                ...s,
                status: aprobado ? "aprobada" : "rechazada",
                revisadoPor,
                fechaRevision,
                observaciones,
              }
            : s,
        ),
      )
      if (aprobado) {
        // Activar el contrato y abrir la bitácora automáticamente
        setContracts((prev) =>
          prev.map((c) =>
            c.id === contratoId
              ? { ...c, status: "activo" as const, fechaActivacion: fechaRevision }
              : c,
          ),
        )
        setBitacoras((prev) => {
          const existe = prev.find((b) => b.contratoId === contratoId)
          if (existe) return prev
          return [
            ...prev,
            {
              contratoId,
              abierta: true,
              fechaApertura: fechaRevision,
              notaApertura: `Bitácora abierta automáticamente al activar el contrato el ${fechaRevision}. Revisado y aprobado por ${revisadoPor}.`,
              notas: [],
            },
          ]
        })
      }
    },
    [],
  )

  const garantiasTiposUsados = useCallback(
    (contratoId: string): Set<GarantiaTipo> => {
      return new Set(
        garantias.filter((g) => g.contratoId === contratoId).map((g) => g.tipo),
      )
    },
    [garantias],
  )

  const value = useMemo<AppState>(
    () => ({
      user,
      login,
      logout,
      contracts,
      contratistas,
      residentes,
      supervisores,
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
      addResidente,
      addSupervisor,
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
      addAnticipo,
      requestActivation,
      reviewActivation,
      garantiasTiposUsados,
    }),
    [
      user,
      login,
      logout,
      contracts,
      contratistas,
      residentes,
      supervisores,
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
      addResidente,
      addSupervisor,
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
      addAnticipo,
      requestActivation,
      reviewActivation,
      garantiasTiposUsados,
    ],
  )

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
  }
  return matrix[action]?.includes(role) ?? false
}
