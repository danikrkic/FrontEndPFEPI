"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ScrollText } from "lucide-react"
import { useApp } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const { login } = useApp()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const u = await login(email, password)
    if (u) {
      toast.success(`Bienvenido, ${u.name}`)
      router.push("/contratos")
    } else {
      toast.error("Credenciales incorrectas")
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Side panel ──────────────────────────────────────────────── */}
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-sidebar-primary">
            <ScrollText className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          <div>
            <p className="text-xl font-bold">GACM</p>
            <p className="text-sm text-sidebar-foreground/70">Gestión de Contratos</p>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-balance text-3xl font-bold leading-tight">
            Administración integral de contratos de obra pública
          </h1>
          <p className="mt-4 text-pretty text-sidebar-foreground/70">
            Contratos, bitácora de obra, estimaciones, convenios modificatorios,
            programa de obra (Gantt + Curva S), garantías, pagos y seguimiento
            conforme a la LOPySRM.
          </p>
        </div>

        <p className="text-xs text-sidebar-foreground/50">
          Gestión de Contratos de Obra Pública
        </p>
      </div>

      {/* ── Login form ──────────────────────────────────────────────── */}
      <div className="flex flex-1 items-start justify-center bg-background px-6 py-12 lg:items-center">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ingresa con tu cuenta institucional
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@gacm.mx"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" className="mt-2 w-full">
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
