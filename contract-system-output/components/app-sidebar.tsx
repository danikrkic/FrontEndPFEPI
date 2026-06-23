"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  BookOpen,
  CreditCard,
  FileText,
  FolderOpen,
  GitBranch,
  LayoutDashboard,
  LineChart,
  LogOut,
  ScrollText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useApp } from "@/lib/store"
import { ROLE_LABELS } from "@/lib/types"

const NAV = [
  { href: "/contratos", label: "Contratos", icon: FileText },
  { href: "/bitacora", label: "Bitácora", icon: BookOpen },
  { href: "/documentacion", label: "Documentación", icon: FolderOpen },
  { href: "/estimaciones", label: "Estimaciones", icon: BarChart3 },
  { href: "/seguimiento", label: "Seguimiento", icon: LineChart },
  { href: "/convenios", label: "Convenios", icon: GitBranch },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pagos", label: "Pagos", icon: CreditCard },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useApp()

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary">
          <ScrollText className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div className="leading-tight">
          <p className="text-lg font-bold tracking-tight">GACM</p>
          <p className="text-xs text-sidebar-foreground/70">Gestión de Contratos</p>
        </div>
      </div>

      <div className="mx-3 mb-4 rounded-md bg-sidebar-accent px-4 py-2.5">
        <p className="text-sm font-semibold capitalize">
          {user ? ROLE_LABELS[user.role] : "Invitado"}
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/")
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={() => {
          logout()
          router.push("/login")
        }}
        className="m-3 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        <LogOut className="h-[18px] w-[18px]" />
        Cerrar sesión
      </button>
    </aside>
  )
}
