import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  api,
  apiErrorMessage,
  formatDate,
  formatMoney,
  type AdminPayment,
  type Paginated,
  type PixSettings,
} from '../../api'
import { useAuth } from '../../AuthContext'

const MODE_INFO = {
  mercadopago: {
    label: 'Automático (Mercado Pago)',
    text: 'O cliente paga o PIX e o crédito entra sozinho na carteira assim que o Mercado Pago confirma.',
    className: 'ok',
  },
  simulated: {
    label: 'Simulado (desenvolvimento)',
    text: 'Sem token configurado. O app gera PIX de teste e mostra o botão "Simular pagamento". Em produção o PIX fica desativado até você cadastrar o token.',
    className: 'warn',
  },
  disabled: {
    label: 'Desativado',
    text: 'Os clientes não conseguem recarregar pelo app. Cadastre o token do Mercado Pago abaixo ou lance créditos manualmente na ficha do cliente.',
    className: 'off',
  },
}

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'approved', label: 'Aprovados' },
  { value: 'rejected', label: 'Rejeitados' },
  { value: 'cancelled', label: 'Cancelados' },
]

export function PixPage() {
  const { showToast } = useAuth()
  const [settings, setSettings] = useState<PixSettings | null>(null)
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [payments, setPayments] = useState<AdminPayment[] | null>(null)

  useEffect(() => {
    api.get<PixSettings>('/api/admin/pix/').then(({ data }) => setSettings(data))
  }, [])

  useEffect(() => {
    api
      .get<Paginated<AdminPayment>>('/api/admin/payments/', { params: { status: filter || undefined } })
      .then(({ data }) => setPayments(data.results))
  }, [filter])

  async function request(call: () => Promise<{ data: PixSettings }>, success: string) {
    setBusy(true)
    setError('')
    try {
      const { data } = await call()
      setSettings(data)
      setToken('')
      if (data.check && !data.check.ok) setError(data.check.message)
      else showToast(success)
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível salvar a configuração.'))
    } finally {
      setBusy(false)
    }
  }

  function save(e: FormEvent) {
    e.preventDefault()
    request(() => api.put('/api/admin/pix/', { access_token: token.trim() }), 'Token salvo e validado')
  }

  function removeToken() {
    const ok = window.confirm(
      'Remover o token do painel? Sem token, os clientes não conseguirão recarregar pelo PIX (exceto em desenvolvimento).',
    )
    if (ok) request(() => api.put('/api/admin/pix/', { access_token: '' }), 'Token removido')
  }

  function test() {
    request(() => api.post('/api/admin/pix/test/'), 'Conexão com o Mercado Pago OK')
  }

  const mode = settings ? MODE_INFO[settings.mode] : null

  return (
    <>
      <div className="admin-grid-2">
        <div className="card stack">
          <div className="admin-page-head">
            <h2>PIX automático</h2>
            {mode && <span className={`pill ${mode.className}`}>{mode.label}</span>}
          </div>
          {mode && <p className="muted">{mode.text}</p>}

          {settings?.token_preview && (
            <div className="result-box">
              <span className="muted small">
                Token em uso ({settings.source === 'panel' ? 'cadastrado no painel' : 'definido no arquivo .env do servidor'})
              </span>
              <strong className="mono">{settings.token_preview}</strong>
              {settings.is_test_token && (
                <span className="warning-text">
                  Este é um token de TESTE: os pagamentos não são reais. Use o token de produção para receber de verdade.
                </span>
              )}
              {settings.updated_by && settings.source === 'panel' && (
                <span className="muted small">
                  Alterado por {settings.updated_by} em {formatDate(settings.updated_at)}
                </span>
              )}
            </div>
          )}

          <form className="stack" onSubmit={save}>
            <div className="field">
              <label htmlFor="mp-token">
                {settings?.source === 'panel' ? 'Trocar Access Token' : 'Access Token do Mercado Pago'}
              </label>
              <div className="input-with-btn">
                <input
                  id="mp-token"
                  type={showToken ? 'text' : 'password'}
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="APP_USR-..."
                  required
                />
                <button type="button" className="btn secondary" onClick={() => setShowToken((s) => !s)}>
                  {showToken ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="admin-actions-row">
              <button className="btn" disabled={busy || !token.trim()}>
                {busy ? 'Validando…' : 'Salvar token'}
              </button>
              <button type="button" className="btn secondary" onClick={test} disabled={busy || !settings?.token_preview}>
                Testar conexão
              </button>
              {settings?.source === 'panel' && (
                <button type="button" className="btn ghost" onClick={removeToken} disabled={busy}>
                  Remover token
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="card stack">
          <h3 className="card-title">Como configurar</h3>
          <ol className="howto">
            <li>
              Acesse{' '}
              <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noopener">
                Mercado Pago Developers → Suas integrações
              </a>{' '}
              e crie (ou abra) uma aplicação.
            </li>
            <li>
              Em <strong>Credenciais de produção</strong>, copie o <strong>Access Token</strong> (começa com
              APP_USR-) e cole ao lado.
            </li>
            <li>
              Em <strong>Webhooks</strong>, cadastre a URL abaixo e marque o evento <strong>Pagamentos</strong>:
              <div className="input-with-btn" style={{ marginTop: '0.4rem' }}>
                <input readOnly value={settings?.webhook_url ?? ''} onFocus={(e) => e.target.select()} />
                <button
                  type="button"
                  className="btn secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(settings?.webhook_url ?? '')
                    showToast('URL copiada')
                  }}
                >
                  Copiar
                </button>
              </div>
            </li>
          </ol>
          <p className="muted small">
            O endereço do webhook precisa ser público (BACKEND_URL no .env). Mesmo sem webhook, o app confirma o
            pagamento enquanto o cliente está na tela de recarga. Para lançar crédito manualmente, abra a ficha do
            cliente em <Link to="/painel/clientes">Clientes</Link>.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="admin-page-head">
          <h2>Recargas PIX</h2>
          <div className="chip-group">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                className={`chip ${filter === f.value ? 'active' : ''}`}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {!payments && <p className="muted">Carregando…</p>}
        {payments && payments.length === 0 && <p className="muted">Nenhuma recarga encontrada.</p>}
        {payments && payments.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cliente</th>
                  <th className="num">Valor</th>
                  <th>Status</th>
                  <th>Gerado em</th>
                  <th>Pago em</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>
                      <Link to={`/painel/clientes/${p.client_id}`}>{p.client_name}</Link>
                      <div className="muted small mono">{p.client_code}</div>
                    </td>
                    <td className="num">{formatMoney(p.amount)}</td>
                    <td>
                      <span className={`pill ${p.credited ? 'ok' : p.status === 'pending' ? 'warn' : 'off'}`}>
                        {p.credited ? 'Creditado' : p.status_display}
                      </span>
                    </td>
                    <td>{formatDate(p.created_at)}</td>
                    <td>{formatDate(p.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
