"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ScrollText } from "lucide-react"
import { useApp } from "@/lib/store"
import { USERS } from "@/lib/mock-data"
import { ROLE_LABELS } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

// Group users by role for the quick-access panel
const ROLE_ORDER = ["dependencia", "residente", "superintendente", "supervision", "finanzas"] as const

export default function LoginPage() {
  const router = useRouter()
  const { login } = useApp()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const u = login(email, password)
    if (u) {
      toast.success(`Bienvenido, ${u.name}`)
      router.push("/contratos")
    } else {
      toast.error("Credenciales incorrectas")
    }
  }

  function quickLogin(userEmail: string) {
    setEmail(userEmail)
    setPassword("demo123")
    const u = login(userEmail, "demo123")
    if (u) router.push("/contratos")
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

          {/* Credentials table */}
          <div className="mt-8 overflow-hidden rounded-lg border border-sidebar-border/40">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sidebar-border/40 bg-sidebar-accent/30">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">Rol</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">Usuario</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">Email</th>
                </tr>
              </thead>
              <tbody>
                {ROLE_ORDER.flatMap((role) => {
                  const usersOfRole = USERS.filter((u) => u.role === role)
                  return usersOfRole.map((u, idx) => (
                    <tr
                      key={u.id}
                      className="border-b border-sidebar-border/20 last:border-0 hover:bg-sidebar-accent/20 cursor-pointer"
                      onClick={() => quickLogin(u.email)}
                    >
                      {idx === 0 ? (
                        <td
                          className="px-3 py-2 align-top text-xs font-medium text-sidebar-foreground/80"
                          rowSpan={usersOfRole.length}
                        >
                          {ROLE_LABELS[role]}
                        </td>
                      ) : null}
                      <td className="px-3 py-2 text-sidebar-foreground/90">{u.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-sidebar-foreground/60">{u.email}</td>
                    </tr>
                  ))
                })}
              </tbody>
            </table>
            <p className="border-t border-sidebar-border/20 bg-sidebar-accent/20 px-3 py-1.5 text-xs text-sidebar-foreground/50">
              Contraseña: <span className="font-mono font-medium">demo123</span> · Haz clic en una fila para ingresar directamente
            </p>
          </div>
        </div>

        <p className="text-xs text-sidebar-foreground/50">
          Plataforma de demostración · Datos de ejemplo
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

          {/* Mobile quick access */}
          <div className="mt-8 lg:hidden">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Acceso rápido por rol (demo)
            </p>
            <div className="flex flex-col gap-2">
              {USERS.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => quickLogin(u.email)}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <span className="font-medium text-foreground">{u.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {ROLE_LABELS[u.role]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
