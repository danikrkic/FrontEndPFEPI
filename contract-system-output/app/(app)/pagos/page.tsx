"use client"

import { useMemo, useState } from "react"
import { useApp, can } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatMoneyFull, formatDate } from "@/lib/format"
import { toast } from "sonner"
import { BellRing, CheckCircle2, Banknote } from "lucide-react"

export default function PagosPage() {
  const { ordenesPago, attendPago, user } = useApp()
  const [tab, setTab] = useState<"pendiente" | "atendida">("pendiente")
  const puedeDispersar = can(user?.role, "pago.dispersar")

  const filtered = useMemo(
    () => ordenesPago.filter((o) => o.status === tab),
    [ordenesPago, tab],
  )

  const totalPendiente = useMemo(
    () =>
      ordenesPago
        .filter((o) => o.status === "pendiente")
        .reduce((s, o) => s + o.monto, 0),
    [ordenesPago],
  )

  async function handleAttend(id: string) {
    try {
      await attendPago(id)
      toast.success("Orden de pago marcada como dispersada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo dispersar la orden de pago")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pagos"
        subtitle="Alertas de órdenes de pago generadas al aceptar estimaciones y control de dispersión"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <BellRing className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendientes de pago</p>
              <p className="text-lg font-semibold">
                {ordenesPago.filter((o) => o.status === "pendiente").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Banknote className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monto por dispersar</p>
              <p className="text-lg font-semibold">{formatMoneyFull(totalPendiente)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dispersadas</p>
              <p className="text-lg font-semibold">
                {ordenesPago.filter((o) => o.status === "atendida").length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pendiente">Pendientes</TabsTrigger>
          <TabsTrigger value="atendida">Dispersadas</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato</TableHead>
                <TableHead>Estimación</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Emisión</TableHead>
                <TableHead>Estado</TableHead>
                {puedeDispersar && tab === "pendiente" && (
                  <TableHead className="text-right">Acción</TableHead>
                )}
                {tab === "atendida" && <TableHead>Dispersada</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No hay órdenes {tab === "pendiente" ? "pendientes" : "dispersadas"}.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.noContrato}</TableCell>
                    <TableCell>Estimación #{o.estimacionNumero}</TableCell>
                    <TableCell>{formatMoneyFull(o.monto)}</TableCell>
                    <TableCell>{formatDate(o.fechaEmision)}</TableCell>
                    <TableCell>
                      {o.status === "pendiente" ? (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                          Pendiente
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          Dispersada
                        </Badge>
                      )}
                    </TableCell>
                    {puedeDispersar && tab === "pendiente" && (
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => handleAttend(o.id)}>
                          Marcar dispersada
                        </Button>
                      </TableCell>
                    )}
                    {tab === "atendida" && (
                      <TableCell>{formatDate(o.fechaAtencion ?? "")}</TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!puedeDispersar && tab === "pendiente" && (
        <p className="text-sm text-muted-foreground">
          Solo el rol de Finanzas puede marcar órdenes como dispersadas.
        </p>
      )}
    </div>
  )
}
