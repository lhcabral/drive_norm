import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  api,
  apiErrorMessage,
  formatDate,
  formatMoney,
  whatsappLink,
  type AdminDriver,
  type Paginated,
} from '../../api'
import { useAuth } from '../../AuthContext'
import { PasswordPanel } from './PasswordPanel'

const EMPTY_FORM = { full_name: '', username: '', password: '', phone: '', email: '', vehicle_info: '' }

function randomPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint32Array(8))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

export function DriversPage() {
  const [search, setSearch] = useState('')
  const [drivers, setDrivers] = useState<AdminDriver[] | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (term: string) => {
    try {
      const { data } = await api.get<Paginated<AdminDriver>>('/api/admin/drivers/', {
        params: { search: term, page_size: 200 },
      })
      setDrivers(data.results)
      setError('')
    } catch {
      setError('Não foi possível carregar os motoristas.')
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => load(search.trim()), 300)
    return () => window.clearTimeout(id)
  }, [search, load])

  const selected = drivers?.find((d) => d.id === selectedId) ?? null

  return (
    <>
      <div className="card">
        <div className="admin-page-head">
          <div>
            <h2>Motoristas</h2>
            <p className="muted small">Somente o admin cadastra motoristas. O cadastro público do app é só para clientes.</p>
          </div>
          <div className="admin-top-actions">
            <input
              className="search-input"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar motorista"
              aria-label="Buscar motoristas"
            />
            <button className="btn" onClick={() => setCreating((c) => !c)}>
              {creating ? 'Fechar' : '+ Novo motorista'}
            </button>
          </div>
        </div>

        {creating && (
          <NewDriverForm
            onCreated={async (driver) => {
              await load(search.trim())
              setSelectedId(driver.id)
            }}
          />
        )}

        {error && <div className="error">{error}</div>}
        {!drivers && !error && <p className="muted">Carregando…</p>}
        {drivers && drivers.length === 0 && <p className="muted">Nenhum motorista encontrado.</p>}

        {drivers && drivers.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Motorista</th>
                  <th>Telefone</th>
                  <th>Veículo</th>
                  <th className="num">Corridas</th>
                  <th className="num">Faturado</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => (
                  <tr
                    key={d.id}
                    className={`clickable ${d.id === selectedId ? 'selected' : ''}`}
                    onClick={() => setSelectedId(d.id === selectedId ? null : d.id)}
                  >
                    <td>
                      <strong>{d.display_name}</strong>
                      <div className="muted small">{d.username}</div>
                    </td>
                    <td>{d.phone || '—'}</td>
                    <td>{d.vehicle_info || '—'}</td>
                    <td className="num">{d.rides_count}</td>
                    <td className="num">{formatMoney(d.rides_total)}</td>
                    <td>
                      <span className={`pill ${d.is_active ? 'ok' : 'off'}`}>
                        {d.is_active ? 'Ativo' : 'Bloqueado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="admin-grid-2" style={{ marginTop: '1rem' }}>
          <DriverForm key={`f${selected.id}`} driver={selected} onSaved={() => load(search.trim())} />
          <PasswordPanel key={`p${selected.id}`} user={selected} />
        </div>
      )}
    </>
  )
}

function NewDriverForm({ onCreated }: { onCreated: (driver: AdminDriver) => Promise<void> }) {
  const { showToast } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)
  const [created, setCreated] = useState<{ driver: AdminDriver; password: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post<AdminDriver>('/api/admin/drivers/', form)
      setCreated({ driver: data, password: form.password })
      setForm(EMPTY_FORM)
      showToast('Motorista cadastrado')
      await onCreated(data)
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível cadastrar o motorista.'))
    } finally {
      setBusy(false)
    }
  }

  const message = created
    ? `Olá, ${created.driver.display_name}! Seu acesso de motorista Drive Norm:\nUsuário: ${created.driver.username}\nSenha: ${created.password}`
    : ''
  const whats = created ? whatsappLink(created.driver.phone, message) : null

  return (
    <form className="sub-card stack" onSubmit={submit}>
      <h3 className="card-title">Novo motorista</h3>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="drv-name">Nome completo *</label>
          <input id="drv-name" value={form.full_name} onChange={set('full_name')} required />
        </div>
        <div className="field">
          <label htmlFor="drv-user">Usuário para login *</label>
          <input
            id="drv-user"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="drv-pass">Senha *</label>
          <div className="input-with-btn">
            <input id="drv-pass" value={form.password} onChange={set('password')} minLength={6} required />
            <button type="button" className="btn secondary" onClick={() => setForm({ ...form, password: randomPassword() })}>
              Gerar
            </button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="drv-phone">Telefone / WhatsApp</label>
          <input id="drv-phone" value={form.phone} onChange={set('phone')} />
        </div>
        <div className="field">
          <label htmlFor="drv-email">E-mail</label>
          <input id="drv-email" type="email" value={form.email} onChange={set('email')} />
        </div>
        <div className="field">
          <label htmlFor="drv-vehicle">Veículo</label>
          <input id="drv-vehicle" value={form.vehicle_info} onChange={set('vehicle_info')} placeholder="Ex.: Onix branco ABC1D23" />
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn" disabled={busy}>
        {busy ? 'Cadastrando…' : 'Cadastrar motorista'}
      </button>

      {created && (
        <div className="result-box">
          <span className="muted small">Envie o acesso para {created.driver.display_name}:</span>
          <strong className="mono">
            {created.driver.username} / {created.password}
          </strong>
          <div className="row">
            <button
              type="button"
              className="btn secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(message)
                showToast('Mensagem copiada')
              }}
            >
              Copiar mensagem
            </button>
            {whats && (
              <a className="btn ghost" href={whats} target="_blank" rel="noopener">
                Enviar no WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </form>
  )
}

function DriverForm({ driver, onSaved }: { driver: AdminDriver; onSaved: () => Promise<void> }) {
  const { showToast } = useAuth()
  const [form, setForm] = useState({
    full_name: driver.full_name,
    phone: driver.phone,
    email: driver.email,
    vehicle_info: driver.vehicle_info,
    is_active: driver.is_active,
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (driver.is_active && !form.is_active) {
      if (!window.confirm('Bloquear este motorista? Ele não conseguirá mais entrar no app.')) return
    }
    setBusy(true)
    setError('')
    try {
      await api.patch(`/api/admin/drivers/${driver.id}/`, form)
      showToast('Motorista atualizado')
      await onSaved()
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível salvar.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <div>
        <h3 className="card-title">{driver.display_name}</h3>
        <p className="muted small">
          Usuário {driver.username} · cadastro em {formatDate(driver.date_joined)} · último acesso{' '}
          {formatDate(driver.last_login)}
        </p>
      </div>
      <div className="field">
        <label htmlFor="edit-name">Nome completo</label>
        <input id="edit-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="edit-phone">Telefone / WhatsApp</label>
        <input id="edit-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="edit-email">E-mail</label>
        <input id="edit-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="edit-vehicle">Veículo</label>
        <input
          id="edit-vehicle"
          value={form.vehicle_info}
          onChange={(e) => setForm({ ...form, vehicle_info: e.target.value })}
        />
      </div>
      <label className="toggle-row">
        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
        <span>Conta ativa (desmarque para bloquear o acesso)</span>
      </label>
      {error && <div className="error">{error}</div>}
      <button className="btn secondary" disabled={busy}>
        Salvar motorista
      </button>
    </form>
  )
}
