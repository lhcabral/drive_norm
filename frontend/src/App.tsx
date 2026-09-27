import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { AdminLayout } from './pages/admin/AdminLayout'
import { ClientDetailPage } from './pages/admin/ClientDetailPage'
import { ClientsPage } from './pages/admin/ClientsPage'
import { DriversPage } from './pages/admin/DriversPage'
import { LandingEditorPage } from './pages/admin/LandingEditorPage'
import { PixPage } from './pages/admin/PixPage'
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages'
import { ClientHome, LedgerPage, RidesHistoryPage } from './pages/ClientPages'
import { DriverHome } from './pages/DriverHome'
import { RechargePage } from './pages/RechargePage'

const HOME_BY_ROLE = { client: '/', driver: '/motorista', admin: '/painel' } as const

function Protected({
  children,
  roles,
}: {
  children: ReactNode
  roles?: Array<'client' | 'driver' | 'admin'>
}) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="app-shell">
        <div className="card">Carregando…</div>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={HOME_BY_ROLE[user.role]} replace />
  }
  return <>{children}</>
}

export default function App() {
  const { toast } = useAuth()

  return (
    <>
      {toast && <div className="toast">{toast}</div>}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<RegisterPage />} />
        <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
        <Route
          path="/"
          element={
            <Protected roles={['client']}>
              <ClientHome />
            </Protected>
          }
        />
        <Route
          path="/extrato"
          element={
            <Protected roles={['client']}>
              <LedgerPage />
            </Protected>
          }
        />
        <Route
          path="/recarregar"
          element={
            <Protected roles={['client']}>
              <RechargePage />
            </Protected>
          }
        />
        <Route
          path="/motorista"
          element={
            <Protected roles={['driver', 'admin']}>
              <DriverHome />
            </Protected>
          }
        />
        <Route
          path="/painel"
          element={
            <Protected roles={['admin']}>
              <AdminLayout />
            </Protected>
          }
        >
          <Route index element={<Navigate to="clientes" replace />} />
          <Route path="clientes" element={<ClientsPage />} />
          <Route path="clientes/:id" element={<ClientDetailPage />} />
          <Route path="motoristas" element={<DriversPage />} />
          <Route path="pix" element={<PixPage />} />
          <Route path="landing" element={<LandingEditorPage />} />
        </Route>
        <Route
          path="/corridas"
          element={
            <Protected>
              <RoleRides />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

function RoleRides() {
  const { user } = useAuth()
  return <RidesHistoryPage role={user?.role === 'driver' ? 'driver' : 'client'} />
}
