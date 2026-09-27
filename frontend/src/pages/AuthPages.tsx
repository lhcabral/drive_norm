import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, apiErrorMessage } from '../api'
import { useAuth } from '../AuthContext'

function AuthBrand({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="brand">
      <div className="brand-mark">DN</div>
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(username, password)
      navigate({ driver: '/motorista', admin: '/painel', client: '/' }[user.role])
    } catch {
      setError('Usuário ou senha inválidos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <AuthBrand title="Drive Norm" subtitle="Carteira de créditos e corridas" />
      <div className="card">
        <form className="stack" onSubmit={onSubmit}>
          <div className="field">
            <label>Usuário</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="field">
            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="error">{error}</div>}
          <button className="btn" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Link to="/esqueci-senha">Esqueci minha senha</Link>
        </p>
        <p className="muted" style={{ textAlign: 'center' }}>
          Não tem conta? <Link to="/cadastro">Cadastre-se</Link>
        </p>
        <p className="install-hint">
          Motoristas recebem o acesso do administrador. No celular, use “Adicionar à tela inicial”
          do navegador.
        </p>
      </div>
    </div>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    password: '',
    full_name: '',
    phone: '',
    email: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form)
      navigate('/')
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível cadastrar. Verifique os dados.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <AuthBrand title="Criar conta" subtitle="Cadastro de cliente" />
      <div className="card">
        <form className="stack" onSubmit={onSubmit}>
          <div className="field">
            <label>Nome completo</label>
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Usuário</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Telefone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="field">
            <label>E-mail (para recuperar a senha)</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Senha</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={6}
              required
            />
          </div>
          {error && <div className="error">{error}</div>}
          <button className="btn" disabled={loading}>
            {loading ? 'Cadastrando…' : 'Cadastrar'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1rem', textAlign: 'center' }}>
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  )
}

export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post<{ detail: string }>('/api/auth/password/forgot/', {
        identifier: identifier.trim(),
      })
      setMessage(data.detail)
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível enviar agora. Tente novamente mais tarde.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <AuthBrand title="Recuperar senha" subtitle="Enviaremos um link para o seu e-mail" />
      <div className="card">
        {message ? (
          <div className="stack">
            <p>{message}</p>
            <Link className="btn secondary" to="/login">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form className="stack" onSubmit={onSubmit}>
            <div className="field">
              <label>Usuário ou e-mail</label>
              <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
            </div>
            {error && <div className="error">{error}</div>}
            <button className="btn" disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar link'}
            </button>
            <p className="install-hint">
              Não cadastrou e-mail? Fale com o suporte pelo WhatsApp que o administrador redefine sua
              senha.
            </p>
          </form>
        )}
        <p className="muted" style={{ marginTop: '1rem', textAlign: 'center' }}>
          Lembrou a senha? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  )
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const uid = params.get('uid') ?? ''
  const token = params.get('token') ?? ''

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('As senhas não conferem.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post<{ detail: string }>('/api/auth/password/reset/', {
        uid,
        token,
        password,
      })
      setDone(data.detail)
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível alterar a senha.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <AuthBrand title="Nova senha" subtitle="Crie uma nova senha de acesso" />
      <div className="card">
        {!uid || !token ? (
          <div className="stack">
            <p className="error">Link incompleto. Abra o link exatamente como veio no e-mail.</p>
            <Link className="btn secondary" to="/esqueci-senha">
              Pedir novo link
            </Link>
          </div>
        ) : done ? (
          <div className="stack">
            <p>{done}</p>
            <Link className="btn" to="/login">
              Entrar
            </Link>
          </div>
        ) : (
          <form className="stack" onSubmit={onSubmit}>
            <div className="field">
              <label>Nova senha</label>
              <input
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Repita a nova senha</label>
              <input
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            {error && <div className="error">{error}</div>}
            <button className="btn" disabled={loading}>
              {loading ? 'Salvando…' : 'Salvar nova senha'}
            </button>
            {error && (
              <Link className="muted" to="/esqueci-senha" style={{ textAlign: 'center' }}>
                Pedir um novo link
              </Link>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
