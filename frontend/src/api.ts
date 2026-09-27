import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''

export const api = axios.create({
  baseURL: API_URL,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_URL}/api/auth/refresh/`, {
            refresh,
          })
          localStorage.setItem('access_token', data.access)
          original.headers.Authorization = `Bearer ${data.access}`
          return api(original)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  },
)

export type User = {
  id: number
  username: string
  email: string
  full_name: string
  phone: string
  role: 'client' | 'driver' | 'admin'
  client_code: string | null
  balance: string | null
  vehicle_info: string | null
  low_balance: boolean
  display_name: string
}

export type LedgerEntry = {
  id: number
  entry_type: string
  entry_type_display: string
  amount: string
  balance_after: string
  description: string
  created_at: string
}

export type RideProposal = {
  id: number
  client: number
  driver: number
  client_name: string
  driver_name: string
  client_code: string | null
  amount: string
  status: string
  created_at: string
  expires_at: string
  responded_at: string | null
  seconds_remaining: number
}

export type Ride = {
  id: number
  client_name: string
  driver_name: string
  client_code: string | null
  amount: string
  created_at: string
}

export type Payment = {
  id: number
  simulated: boolean
  amount: string
  status: string
  qr_code: string
  qr_code_base64: string
  ticket_url: string
  credited: boolean
  created_at: string
  paid_at: string | null
}

export type LandingSection = Record<string, unknown>
export type LandingContent = Record<string, LandingSection>

export type LandingAdminData = {
  content: LandingContent
  defaults: LandingContent
  customized: string[]
  updated_at: string
  updated_by: string | null
}

export type Paginated<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type AdminSummary = {
  clients: number
  drivers: number
  total_balance: string
  rides_today: number
  rides_today_total: string
  pix_pending: number
  pix_mode: PixMode
}

export type AdminClient = {
  id: number
  username: string
  full_name: string
  display_name: string
  email: string
  phone: string
  code: string | null
  balance: string
  is_active: boolean
  date_joined: string
  last_login: string | null
  rides_count: number
}

export type AdminPayment = {
  id: number
  client_id: number
  client_name: string
  client_code: string | null
  amount: string
  status: string
  status_display: string
  credited: boolean
  external_id: string | null
  created_at: string
  paid_at: string | null
}

export type AdminClientDetail = AdminClient & {
  stats: { total_credits: string; total_spent: string; rides_total: string }
  ledger: LedgerEntry[]
  rides: Ride[]
  payments: AdminPayment[]
}

export type AdminDriver = {
  id: number
  username: string
  full_name: string
  display_name: string
  email: string
  phone: string
  vehicle_info: string
  is_active: boolean
  date_joined: string
  last_login: string | null
  rides_count: number
  rides_total: string
}

export type PixMode = 'mercadopago' | 'simulated' | 'disabled'

export type PixSettings = {
  mode: PixMode
  source: 'panel' | 'env' | null
  token_preview: string
  is_test_token: boolean
  webhook_url: string
  updated_at: string
  updated_by: string | null
  check: { ok: boolean; message: string } | null
}

export function apiErrorMessage(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: unknown } })?.response?.data
  if (!data || typeof data !== 'object') return fallback
  const messages = Object.entries(data as Record<string, unknown>).map(([key, value]) => {
    const text = Array.isArray(value) ? value.join(' ') : String(value)
    return key === 'detail' || key === 'non_field_errors' ? text : `${key}: ${text}`
  })
  return messages.join(' · ') || fallback
}

export function whatsappLink(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  const number = digits.length <= 11 ? `55${digits}` : digits
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export function formatMoney(value: string | number) {
  const n = typeof value === 'string' ? Number(value) : value
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('pt-BR') : '—'
}
