"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/lib/store"
import { ROLE_LABELS } from "@/lib/types"
import { AppSidebar } from "./app-sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace("/login")
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Cargando...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Redirigiendo al inicio de sesión...
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-end border-b border-border bg-card px-6">
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
            </div>
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                {user.initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-background px-8 py-8">{children}</main>
      </div>
    </div>
  )
}
