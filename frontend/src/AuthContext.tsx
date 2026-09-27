import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, type RideProposal, type User } from './api'

type AuthContextValue = {
  user: User | null
  loading: boolean
  pendingProposal: RideProposal | null
  setPendingProposal: (p: RideProposal | null) => void
  refreshUser: () => Promise<void>
  login: (username: string, password: string) => Promise<User>
  register: (payload: Record<string, string>) => Promise<void>
  logout: () => void
  toast: string | null
  showToast: (msg: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function wsUrl() {
  const token = localStorage.getItem('access_token')
  if (!token) return null
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = import.meta.env.VITE_WS_HOST || window.location.host
  // Em dev com proxy Vite, use o mesmo host; senão backend direto
  if (import.meta.env.DEV && !import.meta.env.VITE_WS_HOST) {
    return `ws://127.0.0.1:8000/ws/notifications/?token=${token}`
  }
  return `${proto}://${host}/ws/notifications/?token=${token}`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingProposal, setPendingProposal] = useState<RideProposal | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3500)
  }, [])

  const refreshUser = useCallback(async () => {
    const { data } = await api.get<User>('/api/me/')
    setUser(data)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
    setPendingProposal(null)
  }, [])

  const login = useCallback(
    async (username: string, password: string) => {
      const { data: tokens } = await api.post('/api/auth/login/', { username, password })
      localStorage.setItem('access_token', tokens.access)
      localStorage.setItem('refresh_token', tokens.refresh)
      const { data } = await api.get<User>('/api/me/')
      setUser(data)
      return data
    },
    [],
  )

  const register = useCallback(async (payload: Record<string, string>) => {
    await api.post('/api/auth/register/', payload)
    await login(payload.username, payload.password)
  }, [login])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setLoading(false)
      return
    }
    refreshUser()
      .catch(() => logout())
      .finally(() => setLoading(false))
  }, [logout, refreshUser])

  useEffect(() => {
    if (!user) return
    const url = wsUrl()
    if (!url) return
    let socket: WebSocket | null = null
    let closed = false
    let retry: number | undefined

    const connect = () => {
      socket = new WebSocket(url)
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          if (payload.type === 'ride_proposal' && payload.proposal) {
            setPendingProposal(payload.proposal)
            showToast('Nova proposta de corrida')
          }
          if (payload.type === 'proposal_accepted') {
            showToast('Cliente aceitou a corrida')
            refreshUser()
          }
          if (payload.type === 'proposal_rejected') {
            showToast('Cliente recusou a corrida')
          }
          if (payload.type === 'proposal_expired') {
            setPendingProposal((curr) =>
              curr && curr.id === payload.proposal_id ? null : curr,
            )
            showToast('Proposta expirada')
          }
          if (payload.type === 'wallet_credited' || payload.type === 'pix_approved') {
            showToast(`Crédito de R$ ${payload.amount} confirmado`)
            refreshUser()
          }
          if (payload.type === 'ride_debited') {
            refreshUser()
            setPendingProposal(null)
          }
        } catch {
          /* ignore */
        }
      }
      socket.onclose = () => {
        if (!closed) retry = window.setTimeout(connect, 2500)
      }
    }
    connect()
    return () => {
      closed = true
      if (retry) window.clearTimeout(retry)
      socket?.close()
    }
  }, [user, refreshUser, showToast])

  useEffect(() => {
    if (!user || user.role !== 'client') return
    api
      .get<RideProposal[]>('/api/rides/proposals/', { params: { status: 'pending' } })
      .then(({ data }) => {
        if (data[0]) setPendingProposal(data[0])
      })
      .catch(() => undefined)
  }, [user])

  const value = useMemo(
    () => ({
      user,
      loading,
      pendingProposal,
      setPendingProposal,
      refreshUser,
      login,
      register,
      logout,
      toast,
      showToast,
    }),
    [
      user,
      loading,
      pendingProposal,
      refreshUser,
      login,
      register,
      logout,
      toast,
      showToast,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
