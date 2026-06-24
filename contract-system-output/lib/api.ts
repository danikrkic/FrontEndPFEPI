const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api"

const ACCESS_TOKEN_KEY = "gacm_access_token"
const REFRESH_TOKEN_KEY = "gacm_refresh_token"

export function getAccessToken() {
  return typeof window !== "undefined" ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
}

export function getRefreshToken() {
  return typeof window !== "undefined" ? localStorage.getItem(REFRESH_TOKEN_KEY) : null
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, access)
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken()
  if (!refresh) return null
  const res = await fetch(`${API_BASE_URL}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  })
  if (!res.ok) {
    clearTokens()
    return null
  }
  const data = await res.json()
  localStorage.setItem(ACCESS_TOKEN_KEY, data.access)
  return data.access
}

/** Fetch autenticado contra la API de Django: agrega el access token y reintenta una vez si expiró. */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const access = getAccessToken()
  const headers = new Headers(options.headers)
  headers.set("Content-Type", "application/json")
  if (access) headers.set("Authorization", `Bearer ${access}`)

  let res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401 && getRefreshToken()) {
    const newAccess = await refreshAccessToken()
    if (newAccess) {
      headers.set("Authorization", `Bearer ${newAccess}`)
      res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
    }
  }

  return res
}

export interface ApiUser {
  id: number
  name: string
  email: string
  role: string
  initials: string
  persona_id: string | null
}

export async function loginRequest(email: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return null
  const data: { access: string; refresh: string; user: ApiUser } = await res.json()
  setTokens(data.access, data.refresh)
  return data.user
}

export async function meRequest(): Promise<ApiUser | null> {
  const res = await apiFetch("/auth/me/")
  if (!res.ok) return null
  return res.json()
}
