"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/lib/store"

export default function Home() {
  const router = useRouter()
  const { user } = useApp()

  useEffect(() => {
    router.replace(user ? "/contratos" : "/login")
  }, [user, router])

  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      Cargando...
    </div>
  )
}
