import { useEffect, useState, type FormEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api, apiErrorMessage, formatMoney, type Payment } from '../api'
import { useAuth } from '../AuthContext'
import { BottomNav } from '../components/BottomNav'

export function RechargePage() {
  const { refreshUser, showToast } = useAuth()
  const [amount, setAmount] = useState('50')
  const [payment, setPayment] = useState<Payment | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function createPix(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post<Payment>('/api/payments/pix/', {
        amount: Number(amount),
      })
      setPayment(data)
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível gerar o PIX.'))
    } finally {
      setLoading(false)
    }
  }

  async function simulateApprove() {
    if (!payment) return
    setLoading(true)
    try {
      const { data } = await api.post<Payment>(
        `/api/payments/${payment.id}/simulate-approve/`,
      )
      setPayment(data)
      await refreshUser()
      showToast('PIX simulado aprovado')
    } catch {
      setError('Falha ao simular aprovação.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!payment || payment.status === 'approved') return
    const id = window.setInterval(async () => {
      const { data } = await api.get<Payment>(`/api/payments/${payment.id}/`)
      setPayment(data)
      if (data.status === 'approved') {
        await refreshUser()
        showToast('Pagamento confirmado')
      }
    }, 4000)
    return () => window.clearInterval(id)
  }, [payment, refreshUser, showToast])

  return (
    <div className="app-shell">
      <div className="brand">
        <div className="brand-mark">DN</div>
        <div>
          <h1>Recarregar</h1>
          <p>PIX com crédito automático</p>
        </div>
      </div>

      {!payment && (
        <div className="card">
          <form className="stack" onSubmit={createPix}>
            <div className="field">
              <label>Valor (R$)</label>
              <input
                type="number"
                min={1}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            {error && <div className="error">{error}</div>}
            <button className="btn" disabled={loading}>
              {loading ? 'Gerando…' : 'Gerar PIX'}
            </button>
          </form>
        </div>
      )}

      {payment && (
        <div className="card">
          <p className="muted">Valor</p>
          <h2 style={{ marginTop: 0 }}>{formatMoney(payment.amount)}</h2>
          <p>
            Status:{' '}
            <strong>{payment.status === 'approved' ? 'Aprovado' : 'Aguardando pagamento'}</strong>
          </p>

          {payment.status !== 'approved' && (
            <>
              <div className="qr-wrap">
                {payment.qr_code_base64 ? (
                  <img
                    src={`data:image/png;base64,${payment.qr_code_base64}`}
                    alt="QR Code PIX"
                    width={220}
                    height={220}
                  />
                ) : (
                  <QRCodeSVG value={payment.qr_code || 'DriveNorm'} size={220} />
                )}
              </div>
              <div className="field">
                <label>Copia e cola</label>
                <input readOnly value={payment.qr_code} onFocus={(e) => e.target.select()} />
              </div>
              <div className="row" style={{ marginTop: '0.75rem' }}>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(payment.qr_code)
                    showToast('PIX copiado')
                  }}
                >
                  Copiar
                </button>
                {payment.simulated && (
                  <button className="btn" type="button" onClick={simulateApprove} disabled={loading}>
                    Simular pagamento
                  </button>
                )}
              </div>
              <p className="install-hint">
                {payment.simulated
                  ? 'PIX de teste (ambiente de desenvolvimento). Use “Simular pagamento” para creditar.'
                  : 'Pague pelo app do seu banco. O crédito entra automaticamente assim que o pagamento for confirmado.'}
              </p>
            </>
          )}

          {payment.status === 'approved' && (
            <button className="btn" onClick={() => setPayment(null)}>
              Nova recarga
            </button>
          )}
          {error && <div className="error">{error}</div>}
        </div>
      )}

      <BottomNav role="client" />
    </div>
  )
}
