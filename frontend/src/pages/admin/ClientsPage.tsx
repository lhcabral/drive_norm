import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  api,
  formatMoney,
  type AdminClient,
  type AdminSummary,
  type Paginated,
} from '../../api'

const PIX_MODE_LABEL = {
  mercadopago: 'Automático',
  simulated: 'Simulado',
  disabled: 'Desativado',
}

export function ClientsPage() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paginated<AdminClient> | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<AdminSummary>('/api/admin/summary/').then(({ data }) => setSummary(data))
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(id)
  }, [search])

  useEffect(() => {
    api
      .get<Paginated<AdminClient>>('/api/admin/clients/', { params: { search: query, page } })
      .then(({ data }) => {
        setData(data)
        setError('')
      })
      .catch(() => setError('Não foi possível carregar os clientes.'))
  }, [query, page])

  return (
    <>
      {summary && (
        <div className="stats-grid">
          <div className="stat-card">
            <span>Clientes</span>
            <strong>{summary.clients}</strong>
          </div>
          <div className="stat-card">
            <span>Saldo nas carteiras</span>
            <strong>{formatMoney(summary.total_balance)}</strong>
          </div>
          <div className="stat-card">
            <span>Corridas hoje</span>
            <strong>{summary.rides_today}</strong>
            <small>{formatMoney(summary.rides_today_total)}</small>
          </div>
          <div className="stat-card">
            <span>Motoristas ativos</span>
            <strong>{summary.drivers}</strong>
          </div>
          <Link className={`stat-card ${summary.pix_mode === 'disabled' ? 'alert' : ''}`} to="/painel/pix">
            <span>PIX</span>
            <strong>{PIX_MODE_LABEL[summary.pix_mode]}</strong>
            <small>{summary.pix_pending} pendente(s)</small>
          </Link>
        </div>
      )}

      <div className="card">
        <div className="admin-page-head">
          <h2>Clientes</h2>
          <input
            className="search-input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, código, telefone, usuário ou e-mail"
            aria-label="Buscar clientes"
          />
        </div>

        {error && <div className="error">{error}</div>}
        {!data && !error && <p className="muted">Carregando…</p>}
        {data && data.results.length === 0 && (
          <p className="muted">{query ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}</p>
        )}

        {data && data.results.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Código</th>
                  <th>Telefone</th>
                  <th className="num">Saldo</th>
                  <th className="num">Corridas</th>
                  <th>Cadastro</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => navigate(`/painel/clientes/${c.id}`)}>
                    <td>
                      <Link to={`/painel/clientes/${c.id}`} onClick={(e) => e.stopPropagation()}>
                        {c.display_name}
                      </Link>
                      <div className="muted small">{c.username}</div>
                    </td>
                    <td className="mono">{c.code}</td>
                    <td>{c.phone || '—'}</td>
                    <td className="num">{formatMoney(c.balance)}</td>
                    <td className="num">{c.rides_count}</td>
                    <td>{new Date(c.date_joined).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <span className={`pill ${c.is_active ? 'ok' : 'off'}`}>
                        {c.is_active ? 'Ativo' : 'Bloqueado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && (data.next || data.previous) && (
          <div className="pagination">
            <button className="btn secondary" disabled={!data.previous} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </button>
            <span className="muted small">
              Página {page} · {data.count} clientes
            </span>
            <button className="btn secondary" disabled={!data.next} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </button>
          </div>
        )}
      </div>
    </>
  )
}
