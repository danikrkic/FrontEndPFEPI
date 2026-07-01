"use client"

import { use } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Lock } from "lucide-react"
import { useApp } from "@/lib/store"
import { formatMoneyFull, formatDate } from "@/lib/format"
import { StatusBadge } from "@/components/status-badge"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { ContractInfo } from "@/components/contracts/contract-info"
import { BitacoraPanel } from "@/components/contracts/bitacora-panel"
import { DocumentosPanel } from "@/components/contracts/documentos-panel"
import { EstimacionesPanel } from "@/components/contracts/estimaciones-panel"
import { VersionesPanel } from "@/components/contracts/versiones-panel"
import { ProgramaObra } from "@/components/contracts/programa-obra"
import { GarantiasPanel } from "@/components/contracts/garantias-panel"
import { ActivacionPanel } from "@/components/contracts/activacion-panel"
import { CierrePanel } from "@/components/contracts/cierre-panel"
import { ReportesAvancePanel } from "@/components/contracts/reportes-avance-panel"

export default function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { contracts } = useApp()
  const contract = contracts.find((c) => c.id === id)

  if (!contract) return notFound()

  const esRegistrado = contract.status === "registrado"

  return (
    <div>
      <Link
        href="/contratos"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a contratos
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {contract.noContrato}
            </h1>
            <StatusBadge status={contract.status} />
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              v{contract.version}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{contract.objeto}</p>
          {contract.fechaActivacion && (
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
              Activado el {formatDate(contract.fechaActivacion)}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Monto contratado</p>
          <p className="text-xl font-bold text-foreground">{formatMoneyFull(contract.monto)}</p>
          <p className="text-xs text-muted-foreground">
            Término: {formatDate(contract.fechaTermino)}
          </p>
        </div>
      </div>

      {/* Banner de activación — solo en estado registrado */}
      {esRegistrado && (
        <div className="mb-6">
          <ActivacionPanel contract={contract} />
        </div>
      )}

      <Tabs defaultValue="datos">
        <TabsList className="flex-wrap">
          <TabsTrigger value="datos">Datos</TabsTrigger>

          {/* Tabs bloqueadas en estado registrado */}
          <TabsTrigger value="bitacora" disabled={esRegistrado} className="gap-1.5">
            {esRegistrado && <Lock className="h-3 w-3" />}
            Bitácora
          </TabsTrigger>

          <TabsTrigger value="programa">Programa</TabsTrigger>
          <TabsTrigger value="garantias">Garantías</TabsTrigger>
          <TabsTrigger value="documentacion">Documentación</TabsTrigger>

          <TabsTrigger value="reportes-avance" disabled={esRegistrado} className="gap-1.5">
            {esRegistrado && <Lock className="h-3 w-3" />}
            Reportes de Avance
          </TabsTrigger>

          <TabsTrigger value="estimaciones" disabled={esRegistrado} className="gap-1.5">
            {esRegistrado && <Lock className="h-3 w-3" />}
            Estimaciones
          </TabsTrigger>

          <TabsTrigger value="versiones">Versiones</TabsTrigger>

          <TabsTrigger value="cierre" disabled={esRegistrado} className="gap-1.5">
            {esRegistrado && <Lock className="h-3 w-3" />}
            Cierre
          </TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="mt-4">
          <ContractInfo contract={contract} />
        </TabsContent>

        <TabsContent value="bitacora" className="mt-4">
          {esRegistrado ? (
            <TabBloqueada mensaje="La bitácora solo está disponible cuando el contrato está activo." />
          ) : (
            <BitacoraPanel contract={contract} />
          )}
        </TabsContent>

        <TabsContent value="programa" className="mt-4">
          <ProgramaObra contract={contract} />
        </TabsContent>

        <TabsContent value="garantias" className="mt-4">
          <GarantiasPanel contract={contract} />
        </TabsContent>

        <TabsContent value="documentacion" className="mt-4">
          <DocumentosPanel contract={contract} />
        </TabsContent>

        <TabsContent value="reportes-avance" className="mt-4">
          {esRegistrado ? (
            <TabBloqueada mensaje="Los reportes de avance solo están disponibles cuando el contrato está activo." />
          ) : (
            <ReportesAvancePanel contract={contract} />
          )}
        </TabsContent>

        <TabsContent value="estimaciones" className="mt-4">
          {esRegistrado ? (
            <TabBloqueada mensaje="Las estimaciones solo están disponibles cuando el contrato está activo." />
          ) : (
            <EstimacionesPanel contract={contract} />
          )}
        </TabsContent>

        <TabsContent value="versiones" className="mt-4">
          <VersionesPanel contract={contract} />
        </TabsContent>

        <TabsContent value="cierre" className="mt-4">
          {esRegistrado ? (
            <TabBloqueada mensaje="El proceso de cierre solo está disponible cuando el contrato está activo o en cierre." />
          ) : (
            <CierrePanel contract={contract} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TabBloqueada({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground max-w-sm">{mensaje}</p>
      <p className="text-xs text-muted-foreground">
        Completa el proceso de activación en el panel de arriba.
      </p>
    </div>
  )
}
