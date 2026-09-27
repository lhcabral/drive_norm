import { useEffect, useState } from 'react'
import { api, formatMoney, type RideProposal } from '../api'
import { useAuth } from '../AuthContext'

export function ProposalModal({ proposal }: { proposal: RideProposal }) {
  const { setPendingProposal, refreshUser, showToast } = useAuth()
  const [seconds, setSeconds] = useState(proposal.seconds_remaining)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setSeconds(proposal.seconds_remaining)
    const id = window.setInterval(() => {
      setSeconds((s) => Math.max(0, s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [proposal])

  async function respond(action: 'accept' | 'reject') {
    setBusy(true)
    setError('')
    try {
      await api.post(`/api/rides/proposals/${proposal.id}/${action}/`)
      setPendingProposal(null)
      await refreshUser()
      showToast(action === 'accept' ? 'Corrida aceita' : 'Proposta recusada')
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Não foi possível responder.'
      setError(detail)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <p className="muted" style={{ marginTop: 0 }}>
          Proposta de corrida
        </p>
        <h2 style={{ margin: '0.2rem 0 0.6rem' }}>{formatMoney(proposal.amount)}</h2>
        <p>
          Motorista: <strong>{proposal.driver_name}</strong>
        </p>
        <p className="timer">Expira em {seconds}s</p>
        {error && <div className="error">{error}</div>}
        <div className="row" style={{ marginTop: '1rem' }}>
          <button className="btn danger" disabled={busy || seconds === 0} onClick={() => respond('reject')}>
            Recusar
          </button>
          <button className="btn" disabled={busy || seconds === 0} onClick={() => respond('accept')}>
            Aceitar
          </button>
        </div>
      </div>
    </div>
  )
}
