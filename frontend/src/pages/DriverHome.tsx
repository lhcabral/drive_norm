import { useEffect, useState, type FormEvent } from 'react'
import { api, formatMoney, type RideProposal } from '../api'
import { useAuth } from '../AuthContext'
import { BottomNav } from '../components/BottomNav'

type ClientInfo = {
  code: string
  full_name: string
  balance: string
  user_id: number
}

export function DriverHome() {
  const { user, logout, showToast, refreshUser } = useAuth()
  const [code, setCode] = useState('')
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [amount, setAmount] = useState('')
  const [creditAmount, setCreditAmount] = useState('')
  const [creditNote, setCreditNote] = useState('')
  const [error, setError] = useState('')
  const [waiting, setWaiting] = useState<RideProposal | null>(null)
  const [tab, setTab] = useState<'ride' | 'credit'>('ride')

  async function lookup(e?: FormEvent) {
    e?.preventDefault()
    setError('')
    try {
      const { data } = await api.get<ClientInfo>('/api/clients/lookup/', {
        params: { code: code.trim().toUpperCase() },
      })
      setClient(data)
      setCode(data.code)
    } catch {
      setClient(null)
      setError('Cliente não encontrado.')
    }
  }

  async function proposeRide(e: FormEvent) {
    e.preventDefault()
    if (!client) return
    setError('')
    try {
      const { data } = await api.post<RideProposal>('/api/rides/proposals/', {
        client_code: client.code,
        amount: Number(amount),
      })
      setWaiting(data)
      showToast('Proposta enviada ao cliente')
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Falha ao enviar proposta.'
      setError(detail)
    }
  }

  async function addCredit(e: FormEvent) {
    e.preventDefault()
    if (!client) return
    setError('')
    try {
      await api.post('/api/wallet/credit/', {
        client_code: client.code,
        amount: Number(creditAmount),
        description: creditNote || 'Crédito lançado pelo motorista',
      })
      showToast('Crédito lançado')
      setCreditAmount('')
      setCreditNote('')
      await lookup()
      await refreshUser()
    } catch {
      setError('Não foi possível lançar o crédito.')
    }
  }

  useEffect(() => {
    if (!waiting || waiting.status !== 'pending') return
    const id = window.setInterval(async () => {
      const { data } = await api.get<RideProposal[]>('/api/rides/proposals/')
      const current = data.find((p) => p.id === waiting.id)
      if (!current) return
      setWaiting(current)
      if (current.status !== 'pending') {
        if (current.status === 'accepted') showToast('Corrida aceita!')
        if (current.status === 'rejected') showToast('Corrida recusada')
        if (current.status === 'expired') showToast('Proposta expirou')
      }
    }, 2000)
    return () => window.clearInterval(id)
  }, [waiting, showToast])

  return (
    <div className="app-shell">
      <div className="brand">
        <div className="brand-mark">DN</div>
        <div style={{ flex: 1 }}>
          <h1>{user?.display_name}</h1>
          <p>Painel do motorista</p>
        </div>
        <button className="btn secondary" style={{ padding: '0.45rem 0.7rem' }} onClick={logout}>
          Sair
        </button>
      </div>

      <div className="card">
        <form className="stack" onSubmit={lookup}>
          <div className="field">
            <label>Código do cliente</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="DN-XXXX"
              required
            />
          </div>
          <button className="btn secondary">Buscar cliente</button>
        </form>
        {client && (
          <div style={{ marginTop: '1rem' }}>
            <strong>{client.full_name}</strong>
            <div className="muted">
              {client.code} · Saldo {formatMoney(client.balance)}
            </div>
          </div>
        )}
      </div>

      {client && (
        <div className="card">
          <div className="tabs">
            <button
              type="button"
              className={tab === 'ride' ? 'active' : ''}
              onClick={() => setTab('ride')}
            >
              Corrida
            </button>
            <button
              type="button"
              className={tab === 'credit' ? 'active' : ''}
              onClick={() => setTab('credit')}
            >
              Crédito
            </button>
          </div>

          {tab === 'ride' && (
            <form className="stack" onSubmit={proposeRide}>
              <div className="field">
                <label>Valor da corrida (R$)</label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <button className="btn" disabled={!!waiting && waiting.status === 'pending'}>
                Enviar para aceite
              </button>
            </form>
          )}

          {tab === 'credit' && (
            <form className="stack" onSubmit={addCredit}>
              <div className="field">
                <label>Valor pago pelo cliente (R$)</label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Observação</label>
                <input
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  placeholder="Ex.: pagamento em dinheiro"
                />
              </div>
              <button className="btn">Lançar crédito</button>
            </form>
          )}
        </div>
      )}

      {waiting && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Proposta #{waiting.id}</h3>
          <p>
            {formatMoney(waiting.amount)} · Status: <strong>{waiting.status}</strong>
          </p>
          {waiting.status === 'pending' && (
            <p className="timer">Aguardando aceite… {waiting.seconds_remaining}s</p>
          )}
          {waiting.status !== 'pending' && (
            <button className="btn secondary" onClick={() => setWaiting(null)}>
              Nova proposta
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="card">
          <div className="error">{error}</div>
        </div>
      )}

      <BottomNav role="driver" />
    </div>
  )
}
