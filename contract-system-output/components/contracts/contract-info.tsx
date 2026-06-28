"use client"

import type { Contract } from "@/lib/types"
import { useApp } from "@/lib/store"
import { formatDate, formatMoneyFull } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

export function ContractInfo({ contract }: { contract: Contract }) {
  const { contratistas, empresasSupervision } = useApp()

  const empresaSup = contract.supervisor.empresaSupervision
    ? empresasSupervision.find((e) => e.id === contract.supervisor.empresaSupervision)
    : null

  const empresaCont = contract.superintendente.empresaContratista
    ? contratistas.find((c) => c.id === contract.superintendente.empresaContratista)
    : null

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del contrato</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Row label="No. de contrato" value={contract.noContrato} />
          <Row label="Objeto" value={contract.objeto} />
          <Row label="Descripción" value={contract.descripcion} />
          <Row label="Monto" value={formatMoneyFull(contract.monto)} />
          <Row label="Plazo de ejecución" value={`${contract.plazoDias} días`} />
          <Row label="Fecha de inicio" value={formatDate(contract.fechaInicio)} />
          <Row label="Fecha de término" value={formatDate(contract.fechaTermino)} />
          <Row label="Ubicación de la obra" value={contract.ubicacion} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contratista</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Row label="Nombre / Razón social" value={contract.contratista.nombre} />
          <Row label="RFC" value={contract.contratista.rfc} />
          <Row label="Representante legal" value={contract.contratista.representante} />
          <Row label="Teléfono" value={contract.contratista.telefono} />
          <Row label="Correo" value={contract.contratista.correo} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Residente de obra</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Row label="Nombre" value={contract.residente.nombre} />
          <Row label="RFC" value={contract.residente.rfc} />
          <Row label="Teléfono" value={contract.residente.telefono} />
          <Row label="Correo" value={contract.residente.correo} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supervisor</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {empresaSup && <Row label="Empresa de supervisión" value={empresaSup.nombre} />}
          <Row label="Nombre" value={contract.supervisor.nombre} />
          <Row label="RFC" value={contract.supervisor.rfc} />
          <Row label="Teléfono" value={contract.supervisor.telefono} />
          <Row label="Correo" value={contract.supervisor.correo} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Superintendente</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {empresaCont && <Row label="Empresa contratista" value={empresaCont.nombre} />}
          <Row label="Nombre" value={contract.superintendente.nombre} />
          <Row label="RFC" value={contract.superintendente.rfc} />
          <Row label="Teléfono" value={contract.superintendente.telefono} />
          <Row label="Correo" value={contract.superintendente.correo} />
        </CardContent>
      </Card>
    </div>
  )
}
