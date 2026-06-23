"use client"

import { useState } from "react"
import { useApp } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { ContractSelector } from "@/components/contract-selector"
import { DocumentosPanel } from "@/components/contracts/documentos-panel"
import { Card, CardContent } from "@/components/ui/card"

export default function DocumentacionPage() {
  const { contracts } = useApp()
  const [selected, setSelected] = useState(contracts[0]?.id ?? "")
  const contract = contracts.find((c) => c.id === selected)

  return (
    <div>
      <PageHeader
        title="Documentación"
        subtitle="Consulta y descarga la documentación contractual por contrato"
      />
      <div className="mb-6">
        <ContractSelector contracts={contracts} value={selected} onChange={setSelected} />
      </div>
      {contract ? (
        <DocumentosPanel contract={contract} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Selecciona un contrato para ver su documentación.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
