import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../AuthContext'

const TABS = [
  { to: '/painel/clientes', label: 'Clientes' },
  { to: '/painel/motoristas', label: 'Motoristas' },
  { to: '/painel/pix', label: 'PIX e pagamentos' },
  { to: '/painel/landing', label: 'Landing page' },
  { to: '/painel/administradores', label: 'Administradores' },
]

export function AdminLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="admin-shell">
      <header className="admin-top">
        <div className="brand" style={{ marginBottom: 0 }}>
          <div className="brand-mark">DN</div>
          <div>
            <h1>Painel do admin</h1>
            <p>Olá, {user?.display_name}</p>
          </div>
        </div>
        <button className="btn secondary admin-logout" onClick={logout}>
          Sair
        </button>
      </header>
      <nav className="admin-nav" aria-label="Seções do painel">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to}>
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
