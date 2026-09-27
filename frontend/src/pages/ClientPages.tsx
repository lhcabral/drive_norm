import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, formatDate, formatMoney, type LedgerEntry, type Ride } from '../api'
import { useAuth } from '../AuthContext'
import { ProposalModal } from '../components/ProposalModal'
import { BottomNav } from '../components/BottomNav'

export function ClientHome() {
  const { user, logout, pendingProposal, showToast } = useAuth()

  async function copyCode() {
    if (!user?.client_code) return
    await navigator.clipboard.writeText(user.client_code)
    showToast('Código copiado')
  }

  return (
    <div className="app-shell">
      <div className="brand">
        <div className="brand-mark">DN</div>
        <div style={{ flex: 1 }}>
          <h1>Olá, {user?.display_name}</h1>
          <p>Seu crédito para corridas</p>
        </div>
        <button className="btn secondary" style={{ padding: '0.45rem 0.7rem' }} onClick={logout}>
          Sair
        </button>
      </div>

      {user?.low_balance && (
        <div className="warning-banner">
          Saldo baixo. <Link to="/recarregar">Recarregue via PIX</Link> ou peça ao motorista para
          lançar crédito.
        </div>
      )}

      <div className="card hero-balance">
        <div className="label">Saldo atual</div>
        <div className="value">{formatMoney(user?.balance || '0')}</div>
        <div className="code-box">
          <span className="muted">Informe este código ao motorista</span>
          <strong>{user?.client_code}</strong>
          <button className="btn ghost" onClick={copyCode}>
            Copiar código
          </button>
        </div>
      </div>

      <div className="card stack">
        <Link className="btn" to="/recarregar">
          Recarregar com PIX
        </Link>
        <Link className="btn secondary" to="/extrato">
          Ver extrato
        </Link>
      </div>

      {pendingProposal && <ProposalModal proposal={pendingProposal} />}
      <BottomNav role="client" />
    </div>
  )
}

export function LedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<LedgerEntry[]>('/api/wallet/ledger/')
      .then(({ data }) => setEntries(data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="app-shell">
      <div className="brand">
        <div className="brand-mark">DN</div>
        <div>
          <h1>Extrato</h1>
          <p>Movimentações da carteira</p>
        </div>
      </div>
      <div className="card">
        {loading && <p className="muted">Carregando…</p>}
        {!loading && entries.length === 0 && <p className="muted">Nenhuma movimentação.</p>}
        <ul className="list">
          {entries.map((e) => {
            const positive = Number(e.amount) >= 0
            return (
              <li key={e.id}>
                <div>
                  <div>{e.entry_type_display}</div>
                  <div className="muted" style={{ fontSize: '0.8rem' }}>
                    {e.description || formatDate(e.created_at)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className={positive ? 'amount-pos' : 'amount-neg'}>
                    {positive ? '+' : ''}
                    {formatMoney(e.amount)}
                  </div>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>
                    Saldo {formatMoney(e.balance_after)}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      <BottomNav role="client" />
    </div>
  )
}

export function RidesHistoryPage({ role }: { role: 'client' | 'driver' }) {
  const [rides, setRides] = useState<Ride[]>([])

  useEffect(() => {
    api.get<Ride[]>('/api/rides/').then(({ data }) => setRides(data))
  }, [])

  return (
    <div className="app-shell">
      <div className="brand">
        <div className="brand-mark">DN</div>
        <div>
          <h1>Corridas</h1>
          <p>Histórico recente</p>
        </div>
      </div>
      <div className="card">
        {rides.length === 0 && <p className="muted">Nenhuma corrida ainda.</p>}
        <ul className="list">
          {rides.map((r) => (
            <li key={r.id}>
              <div>
                <div>
                  {role === 'client' ? r.driver_name : `${r.client_name} (${r.client_code})`}
                </div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>
                  {formatDate(r.created_at)}
                </div>
              </div>
              <div className="amount-neg">{formatMoney(r.amount)}</div>
            </li>
          ))}
        </ul>
      </div>
      <BottomNav role={role} />
    </div>
  )
}
