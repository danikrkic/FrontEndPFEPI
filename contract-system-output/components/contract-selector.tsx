"use client"

import type { Contract } from "@/lib/types"
import { useApp } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function ContractSelector({
  contracts: contractsProp,
  value,
  onChange,
  label = "Contrato",
  className,
}: {
  contracts?: Contract[]
  value: string
  onChange: (id: string) => void
  label?: string
  className?: string
}) {
  const { contracts: storeContracts } = useApp()
  const contracts = contractsProp ?? storeContracts

  return (
    <div className="flex items-center gap-2">
      <Label className="shrink-0 text-sm">{label}</Label>
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger className={cn("w-72", className)}>
          <SelectValue placeholder="Selecciona un contrato">
            {(val: string) => {
              const c = contracts.find((x) => x.id === val)
              return c ? `${c.noContrato} — ${c.objeto.slice(0, 24)}${c.objeto.length > 24 ? "..." : ""}` : ""
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {contracts.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.noContrato} — {c.objeto.slice(0, 30)}
              {c.objeto.length > 30 ? "..." : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
