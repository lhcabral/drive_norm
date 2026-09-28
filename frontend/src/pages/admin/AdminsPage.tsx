import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, apiErrorMessage, formatDate, whatsappLink, type AdminUser, type Paginated } from '../../api'
import { useAuth } from '../../AuthContext'
import { PasswordPanel } from './PasswordPanel'

const EMPTY_FORM = { full_name: '', username: '', password: '', phone: '', email: '', is_superuser: false }

function randomPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint32Array(10))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

export function AdminsPage() {
  const [search, setSearch] = useState('')
  const [admins, setAdmins] = useState<AdminUser[] | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (term: string) => {
    try {
      const { data } = await api.get<Paginated<AdminUser>>('/api/admin/admins/', {
        params: { search: term, page_size: 200 },
      })
      setAdmins(data.results)
      setError('')
    } catch {
      setError('Não foi possível carregar os administradores.')
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => load(search.trim()), 300)
    return () => window.clearTimeout(id)
  }, [search, load])

  const selected = admins?.find((a) => a.id === selectedId) ?? null
  const iAmSuperuser = admins?.some((a) => a.is_self && a.is_superuser) ?? false

  return (
    <>
      <div className="card">
        <div className="admin-page-head">
          <div>
            <h2>Administradores</h2>
            <p className="muted small">
              Pessoas com acesso a este painel. Contas com acesso total só podem ser alteradas por outro admin com
              acesso total.
            </p>
          </div>
          <div className="admin-top-actions">
            <input
              className="search-input"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar administrador"
              aria-label="Buscar administradores"
            />
            <button className="btn" onClick={() => setCreating((c) => !c)}>
              {creating ? 'Fechar' : '+ Novo administrador'}
            </button>
          </div>
        </div>

        {creating && (
          <NewAdminForm
            canGrantFullAccess={iAmSuperuser}
            onCreated={async (admin) => {
              await load(search.trim())
              setSelectedId(admin.id)
            }}
          />
        )}

        {error && <div className="error">{error}</div>}
        {!admins && !error && <p className="muted">Carregando…</p>}
        {admins && admins.length === 0 && <p className="muted">Nenhum administrador encontrado.</p>}

        {admins && admins.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Administrador</th>
                  <th>E-mail</th>
                  <th>Acesso</th>
                  <th>Último acesso</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr
                    key={a.id}
                    className={`clickable ${a.id === selectedId ? 'selected' : ''}`}
                    onClick={() => setSelectedId(a.id === selectedId ? null : a.id)}
                  >
                    <td>
                      <strong>{a.display_name}</strong>
                      {a.is_self && <span className="muted small"> (você)</span>}
                      <div className="muted small">{a.username}</div>
                    </td>
                    <td>{a.email || '—'}</td>
                    <td>{a.is_superuser ? 'Total' : 'Painel'}</td>
                    <td>{formatDate(a.last_login)}</td>
                    <td>
                      <span className={`pill ${a.is_active ? 'ok' : 'off'}`}>
                        {a.is_active ? 'Ativo' : 'Bloqueado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected &&
        (selected.can_edit ? (
          <div className="admin-grid-2" style={{ marginTop: '1rem' }}>
            <AdminForm
              key={`f${selected.id}`}
              admin={selected}
              canGrantFullAccess={iAmSuperuser}
              onSaved={() => load(search.trim())}
            />
            <PasswordPanel key={`p${selected.id}`} user={selected} />
          </div>
        ) : (
          <div className="card" style={{ marginTop: '1rem' }}>
            <h3 className="card-title">{selected.display_name}</h3>
            <p className="muted small">
              Esta conta tem acesso total. Apenas outro administrador com acesso total pode alterá-la.
            </p>
          </div>
        ))}
    </>
  )
}

function NewAdminForm({
  canGrantFullAccess,
  onCreated,
}: {
  canGrantFullAccess: boolean
  onCreated: (admin: AdminUser) => Promise<void>
}) {
  const { showToast } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)
  const [created, setCreated] = useState<{ admin: AdminUser; password: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key: 'full_name' | 'password' | 'phone' | 'email') => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post<AdminUser>('/api/admin/admins/', form)
      setCreated({ admin: data, password: form.password })
      setForm(EMPTY_FORM)
      showToast('Administrador cadastrado')
      await onCreated(data)
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível cadastrar o administrador.'))
    } finally {
      setBusy(false)
    }
  }

  const message = created
    ? `Olá, ${created.admin.display_name}! Seu acesso ao painel Drive Norm:\nEndereço: ${window.location.origin}\nUsuário: ${created.admin.username}\nSenha: ${created.password}`
    : ''
  const whats = created ? whatsappLink(created.admin.phone, message) : null

  return (
    <form className="sub-card stack" onSubmit={submit}>
      <h3 className="card-title">Novo administrador</h3>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="adm-name">Nome completo *</label>
          <input id="adm-name" value={form.full_name} onChange={set('full_name')} required />
        </div>
        <div className="field">
          <label htmlFor="adm-user">Usuário para login *</label>
          <input
            id="adm-user"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="adm-pass">Senha *</label>
          <div className="input-with-btn">
            <input id="adm-pass" value={form.password} onChange={set('password')} minLength={6} required />
            <button type="button" className="btn secondary" onClick={() => setForm({ ...form, password: randomPassword() })}>
              Gerar
            </button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="adm-phone">Telefone / WhatsApp</label>
          <input id="adm-phone" value={form.phone} onChange={set('phone')} />
        </div>
        <div className="field">
          <label htmlFor="adm-email">E-mail</label>
          <input id="adm-email" type="email" value={form.email} onChange={set('email')} />
        </div>
      </div>
      {canGrantFullAccess && (
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={form.is_superuser}
            onChange={(e) => setForm({ ...form, is_superuser: e.target.checked })}
          />
          <span>Acesso total (também entra no /admin/ técnico e pode alterar outros admins com acesso total)</span>
        </label>
      )}
      {error && <div className="error">{error}</div>}
      <button className="btn" disabled={busy}>
        {busy ? 'Cadastrando…' : 'Cadastrar administrador'}
      </button>

      {created && (
        <div className="result-box">
          <span className="muted small">Envie o acesso para {created.admin.display_name}:</span>
          <strong className="mono">
            {created.admin.username} / {created.password}
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

function AdminForm({
  admin,
  canGrantFullAccess,
  onSaved,
}: {
  admin: AdminUser
  canGrantFullAccess: boolean
  onSaved: () => Promise<void>
}) {
  const { showToast } = useAuth()
  const [form, setForm] = useState({
    full_name: admin.full_name,
    phone: admin.phone,
    email: admin.email,
    is_active: admin.is_active,
    is_superuser: admin.is_superuser,
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (admin.is_active && !form.is_active) {
      if (!window.confirm('Bloquear este administrador? Ele não conseguirá mais entrar no painel.')) return
    }
    setBusy(true)
    setError('')
    try {
      await api.patch(`/api/admin/admins/${admin.id}/`, form)
      showToast('Administrador atualizado')
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
        <h3 className="card-title">{admin.display_name}</h3>
        <p className="muted small">
          Usuário {admin.username} · cadastro em {formatDate(admin.date_joined)} · último acesso{' '}
          {formatDate(admin.last_login)}
        </p>
      </div>
      <div className="field">
        <label htmlFor="adm-edit-name">Nome completo</label>
        <input id="adm-edit-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="adm-edit-phone">Telefone / WhatsApp</label>
        <input id="adm-edit-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="adm-edit-email">E-mail</label>
        <input
          id="adm-edit-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      {!admin.is_self && (
        <label className="toggle-row">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          <span>Conta ativa (desmarque para bloquear o acesso)</span>
        </label>
      )}
      {canGrantFullAccess && !admin.is_self && (
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={form.is_superuser}
            onChange={(e) => setForm({ ...form, is_superuser: e.target.checked })}
          />
          <span>Acesso total (também entra no /admin/ técnico e pode alterar outros admins com acesso total)</span>
        </label>
      )}
      {error && <div className="error">{error}</div>}
      <button className="btn secondary" disabled={busy}>
        Salvar administrador
      </button>
    </form>
  )
}
