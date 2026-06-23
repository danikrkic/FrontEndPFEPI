"use client"

import { useState } from "react"
import { useApp } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { ContractSelector } from "@/components/contract-selector"
import { EstimacionesPanel } from "@/components/contracts/estimaciones-panel"
import { Card, CardContent } from "@/components/ui/card"

export default function EstimacionesPage() {
  const { contracts } = useApp()
  const [selected, setSelected] = useState(contracts[0]?.id ?? "")
  const contract = contracts.find((c) => c.id === selected)

  return (
    <div>
      <PageHeader
        title="Estimaciones"
        subtitle="Seguimiento financiero de las estimaciones de obra por contrato"
      />
      <div className="mb-6">
        <ContractSelector contracts={contracts} value={selected} onChange={setSelected} />
      </div>
      {contract ? (
        <EstimacionesPanel contract={contract} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Selecciona un contrato para ver sus estimaciones.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
