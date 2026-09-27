import { useState, type FormEvent } from 'react'
import { api, apiErrorMessage, whatsappLink } from '../../api'
import { useAuth } from '../../AuthContext'

type Props = {
  user: { id: number; username: string; display_name: string; email: string; phone: string }
}

export function PasswordPanel({ user }: Props) {
  const { showToast } = useAuth()
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function setNewPassword(e?: FormEvent) {
    e?.preventDefault()
    const generate = !password
    const question = generate
      ? `Gerar uma nova senha para ${user.display_name}? A senha atual deixará de funcionar.`
      : `Trocar a senha de ${user.display_name}? A senha atual deixará de funcionar.`
    if (!window.confirm(question)) return
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post<{ password: string }>(
        `/api/admin/users/${user.id}/password/`,
        { password },
      )
      setResult(data.password)
      setPassword('')
      showToast('Senha alterada')
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível alterar a senha.'))
    } finally {
      setBusy(false)
    }
  }

  async function sendEmail() {
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post<{ detail: string }>(`/api/admin/users/${user.id}/password-email/`)
      showToast(data.detail)
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível enviar o e-mail.'))
    } finally {
      setBusy(false)
    }
  }

  const message = result
    ? `Olá, ${user.display_name}! Sua senha do Drive Norm foi redefinida.\nUsuário: ${user.username}\nNova senha: ${result}`
    : ''
  const whats = result ? whatsappLink(user.phone, message) : null

  return (
    <div className="card stack">
      <div>
        <h3 className="card-title">Senha de acesso</h3>
        <p className="muted small">
          Use quando a pessoa entrar em contato. Deixe o campo vazio para gerar uma senha automática.
        </p>
      </div>
      <form className="stack" onSubmit={setNewPassword}>
        <div className="field">
          <label htmlFor={`pwd-${user.id}`}>Nova senha (opcional)</label>
          <input
            id={`pwd-${user.id}`}
            type="text"
            autoComplete="new-password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo de 6 caracteres"
          />
        </div>
        <button className="btn" disabled={busy}>
          {password ? 'Definir esta senha' : 'Gerar nova senha'}
        </button>
      </form>

      {result && (
        <div className="result-box">
          <span className="muted small">Nova senha de {user.username}</span>
          <strong className="mono">{result}</strong>
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

      <button
        type="button"
        className="btn secondary"
        onClick={sendEmail}
        disabled={busy || !user.email}
        title={user.email ? undefined : 'Conta sem e-mail cadastrado'}
      >
        {user.email ? `Enviar link de recuperação para ${user.email}` : 'Sem e-mail para enviar link'}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  )
}
