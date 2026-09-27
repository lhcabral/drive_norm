import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  api,
  apiErrorMessage,
  formatDate,
  formatMoney,
  whatsappLink,
  type AdminClientDetail,
} from '../../api'
import { useAuth } from '../../AuthContext'
import { PasswordPanel } from './PasswordPanel'

type HistoryTab = 'ledger' | 'rides' | 'payments'

export function ClientDetailPage() {
  const { id } = useParams()
  const [client, setClient] = useState<AdminClientDetail | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<HistoryTab>('ledger')

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<AdminClientDetail>(`/api/admin/clients/${id}/`)
      setClient(data)
    } catch {
      setError('Cliente não encontrado.')
    }
  }, [id])

  useEffect(() => {
    let active = true
    api
      .get<AdminClientDetail>(`/api/admin/clients/${id}/`)
      .then(({ data }) => active && setClient(data))
      .catch(() => active && setError('Cliente não encontrado.'))
    return () => {
      active = false
    }
  }, [id])

  if (error) {
    return (
      <div className="card">
        <Link to="/painel/clientes">← Voltar para clientes</Link>
        <p className="error">{error}</p>
      </div>
    )
  }
  if (!client) return <div className="card">Carregando…</div>

  const whats = whatsappLink(client.phone)

  return (
    <>
      <Link className="back-link" to="/painel/clientes">
        ← Voltar para clientes
      </Link>

      <div className="card detail-header">
        <div>
          <h2>
            {client.display_name}{' '}
            <span className={`pill ${client.is_active ? 'ok' : 'off'}`}>
              {client.is_active ? 'Ativo' : 'Bloqueado'}
            </span>
          </h2>
          <p className="muted">
            Código <strong className="mono">{client.code}</strong> · usuário {client.username}
          </p>
          <p className="muted small">
            Cadastro em {formatDate(client.date_joined)} · último acesso {formatDate(client.last_login)}
          </p>
          {whats && (
            <a className="btn ghost btn-sm" href={whats} target="_blank" rel="noopener">
              Conversar no WhatsApp
            </a>
          )}
        </div>
        <div className="detail-balance">
          <span className="muted">Saldo atual</span>
          <strong>{formatMoney(client.balance)}</strong>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span>Total creditado</span>
          <strong>{formatMoney(client.stats.total_credits)}</strong>
        </div>
        <div className="stat-card">
          <span>Total gasto</span>
          <strong>{formatMoney(client.stats.total_spent)}</strong>
        </div>
        <div className="stat-card">
          <span>Corridas</span>
          <strong>{client.rides_count}</strong>
          <small>{formatMoney(client.stats.rides_total)}</small>
        </div>
      </div>

      <div className="admin-grid-2">
        <div className="stack">
          <WalletPanel key={`w${client.id}`} clientId={client.id} balance={client.balance} onDone={load} />
          <ClientForm key={`f${client.id}`} client={client} onSaved={load} />
          <PasswordPanel key={`p${client.id}`} user={client} />
        </div>

        <div className="card">
          <div className="tabs tabs-3">
            <button className={tab === 'ledger' ? 'active' : ''} onClick={() => setTab('ledger')}>
              Extrato
            </button>
            <button className={tab === 'rides' ? 'active' : ''} onClick={() => setTab('rides')}>
              Corridas
            </button>
            <button className={tab === 'payments' ? 'active' : ''} onClick={() => setTab('payments')}>
              PIX
            </button>
          </div>

          {tab === 'ledger' && (
            <HistoryList
              empty="Nenhuma movimentação."
              items={client.ledger.map((e) => ({
                key: e.id,
                title: e.description || e.entry_type_display,
                subtitle: `${e.entry_type_display} · ${formatDate(e.created_at)} · saldo ${formatMoney(e.balance_after)}`,
                amount: Number(e.amount),
              }))}
            />
          )}
          {tab === 'rides' && (
            <HistoryList
              empty="Nenhuma corrida."
              items={client.rides.map((r) => ({
                key: r.id,
                title: `Corrida #${r.id} com ${r.driver_name}`,
                subtitle: formatDate(r.created_at),
                amount: -Number(r.amount),
              }))}
            />
          )}
          {tab === 'payments' && (
            <HistoryList
              empty="Nenhuma recarga PIX."
              items={client.payments.map((p) => ({
                key: p.id,
                title: `Recarga PIX #${p.id} · ${p.status_display}`,
                subtitle: `Gerado em ${formatDate(p.created_at)}${p.paid_at ? ` · pago em ${formatDate(p.paid_at)}` : ''}`,
                amount: Number(p.amount),
                muted: !p.credited,
              }))}
            />
          )}
        </div>
      </div>
    </>
  )
}

type HistoryItem = { key: number; title: string; subtitle: string; amount: number; muted?: boolean }

function HistoryList({ items, empty }: { items: HistoryItem[]; empty: string }) {
  if (items.length === 0) return <p className="muted">{empty}</p>
  return (
    <ul className="list">
      {items.map((item) => (
        <li key={item.key}>
          <div>
            <strong>{item.title}</strong>
            <div className="muted small">{item.subtitle}</div>
          </div>
          <span className={item.muted ? 'muted' : item.amount >= 0 ? 'amount-pos' : 'amount-neg'}>
            {item.amount >= 0 ? '+' : '−'}
            {formatMoney(Math.abs(item.amount))}
          </span>
        </li>
      ))}
    </ul>
  )
}

function WalletPanel({
  clientId,
  balance,
  onDone,
}: {
  clientId: number
  balance: string
  onDone: () => Promise<void>
}) {
  const { showToast } = useAuth()
  const [operation, setOperation] = useState<'credit' | 'debit'>('credit')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const verb = operation === 'credit' ? 'Creditar' : 'Debitar'
    if (!window.confirm(`${verb} ${formatMoney(amount)} na carteira deste cliente?`)) return
    setBusy(true)
    setError('')
    try {
      await api.post(`/api/admin/clients/${clientId}/wallet/`, {
        operation,
        amount: Number(amount),
        description,
      })
      showToast(operation === 'credit' ? 'Crédito lançado' : 'Débito lançado')
      setAmount('')
      setDescription('')
      await onDone()
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível lançar o valor.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <div>
        <h3 className="card-title">Lançar na carteira</h3>
        <p className="muted small">Saldo atual: {formatMoney(balance)}</p>
      </div>
      <div className="tabs">
        <button type="button" className={operation === 'credit' ? 'active' : ''} onClick={() => setOperation('credit')}>
          Crédito
        </button>
        <button type="button" className={operation === 'debit' ? 'active' : ''} onClick={() => setOperation('debit')}>
          Débito / ajuste
        </button>
      </div>
      <div className="field">
        <label htmlFor="wallet-amount">Valor (R$)</label>
        <input
          id="wallet-amount"
          type="number"
          min={0.01}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="wallet-description">Descrição (aparece no extrato do cliente)</label>
        <input
          id="wallet-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={operation === 'credit' ? 'Ex.: pagamento em dinheiro, bônus' : 'Ex.: estorno, correção'}
          maxLength={255}
        />
      </div>
      {error && <div className="error">{error}</div>}
      <button className={`btn ${operation === 'debit' ? 'danger' : ''}`} disabled={busy}>
        {operation === 'credit' ? 'Lançar crédito' : 'Lançar débito'}
      </button>
    </form>
  )
}

function ClientForm({ client, onSaved }: { client: AdminClientDetail; onSaved: () => Promise<void> }) {
  const { showToast } = useAuth()
  const [form, setForm] = useState({
    full_name: client.full_name,
    phone: client.phone,
    email: client.email,
    is_active: client.is_active,
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (form.is_active !== client.is_active && !form.is_active) {
      const ok = window.confirm('Bloquear este cliente? Ele não conseguirá mais entrar no app.')
      if (!ok) return
    }
    setBusy(true)
    setError('')
    try {
      await api.patch(`/api/admin/clients/${client.id}/`, form)
      showToast('Dados do cliente salvos')
      await onSaved()
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível salvar.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h3 className="card-title">Dados do cliente</h3>
      <div className="field">
        <label htmlFor="client-name">Nome completo</label>
        <input id="client-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="client-phone">Telefone</label>
        <input id="client-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="client-email">E-mail (usado na recuperação de senha)</label>
        <input
          id="client-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
        />
        <span>Conta ativa (desmarque para bloquear o acesso)</span>
      </label>
      {error && <div className="error">{error}</div>}
      <button className="btn secondary" disabled={busy}>
        Salvar dados
      </button>
    </form>
  )
}
