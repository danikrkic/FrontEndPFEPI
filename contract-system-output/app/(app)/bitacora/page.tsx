"use client"

import { useState } from "react"
import { useApp } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { ContractSelector } from "@/components/contract-selector"
import { BitacoraPanel } from "@/components/contracts/bitacora-panel"
import { Card, CardContent } from "@/components/ui/card"

export default function BitacoraPage() {
  const { contracts } = useApp()
  const [selected, setSelected] = useState(contracts[0]?.id ?? "")
  const contract = contracts.find((c) => c.id === selected)

  return (
    <div>
      <PageHeader
        title="Bitácora de obra"
        subtitle="Apertura y registro de notas de bitácora por contrato conforme a la LOPySRM"
      />
      <div className="mb-6">
        <ContractSelector contracts={contracts} value={selected} onChange={setSelected} />
      </div>
      {contract ? (
        <BitacoraPanel contract={contract} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Selecciona un contrato para ver su bitácora.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
