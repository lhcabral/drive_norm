import { NavLink } from 'react-router-dom'

export function BottomNav({ role }: { role: 'client' | 'driver' }) {
  if (role === 'driver') {
    return (
      <nav className="nav" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <NavLink to="/motorista" end>
          <span>🚗</span>
          Operar
        </NavLink>
        <NavLink to="/corridas">
          <span>📋</span>
          Corridas
        </NavLink>
      </nav>
    )
  }

  return (
    <nav className="nav">
      <NavLink to="/" end>
        <span>🏠</span>
        Início
      </NavLink>
      <NavLink to="/recarregar">
        <span>💳</span>
        Recarga
      </NavLink>
      <NavLink to="/extrato">
        <span>📄</span>
        Extrato
      </NavLink>
      <NavLink to="/corridas">
        <span>🚕</span>
        Corridas
      </NavLink>
    </nav>
  )
}
