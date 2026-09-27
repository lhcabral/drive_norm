import { useEffect, useId, useState, type ChangeEvent } from 'react'
import {
  api,
  apiErrorMessage as errorMessage,
  formatDate,
  type LandingAdminData,
  type LandingSection,
} from '../../api'
import { useAuth } from '../../AuthContext'
import {
  ICON_OPTIONS,
  LANDING_SECTIONS,
  type Field,
  type ListField,
  type ScalarField,
} from '../../landingSchema'

const LANDING_URL = (import.meta.env.VITE_LANDING_URL || 'http://localhost:8765').replace(/\/$/, '')
const RICH_HELP = 'Use **texto** para negrito, *texto* para itálico. Enter quebra a linha.'
const MAX_LIST_ITEMS = 30

function resolveImage(url: string) {
  try {
    return new URL(url, `${LANDING_URL}/`).href
  } catch {
    return url
  }
}

export function LandingEditorPage() {
  const { showToast } = useAuth()
  const [data, setData] = useState<LandingAdminData | null>(null)
  const [drafts, setDrafts] = useState<Record<string, LandingSection>>({})
  const [active, setActive] = useState(LANDING_SECTIONS[0].key)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    api
      .get<LandingAdminData>('/api/landing/admin/')
      .then(({ data }) => setData(data))
      .catch(() => setLoadError('Não foi possível carregar o conteúdo da landing page.'))
  }, [])

  const isDirty = (key: string) =>
    key in drafts && JSON.stringify(drafts[key]) !== JSON.stringify(data?.content[key])
  const anyDirty = LANDING_SECTIONS.some((s) => isDirty(s.key))

  useEffect(() => {
    if (!anyDirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [anyDirty])

  const section = LANDING_SECTIONS.find((s) => s.key === active) ?? LANDING_SECTIONS[0]
  const value = drafts[active] ?? data?.content[active] ?? {}
  const customized = data?.customized.includes(active) ?? false
  const dirty = isDirty(active)

  function updateField(key: string, fieldValue: unknown) {
    setDrafts((d) => ({ ...d, [active]: { ...value, [key]: fieldValue } }))
  }

  function clearDrafts(keys: string[]) {
    setDrafts((d) => {
      const next = { ...d }
      keys.forEach((k) => delete next[k])
      return next
    })
  }

  async function run(
    request: () => Promise<{ data: LandingAdminData }>,
    success: string,
    sections: string[],
  ) {
    setBusy(true)
    setError('')
    try {
      const { data: next } = await request()
      setData(next)
      clearDrafts(sections)
      showToast(success)
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível concluir a operação.'))
    } finally {
      setBusy(false)
    }
  }

  function save() {
    run(
      () => api.put(`/api/landing/admin/sections/${active}/`, value),
      `"${section.title}" salvo`,
      [active],
    )
  }

  function restoreSection() {
    const ok = window.confirm(
      `Voltar "${section.title}" para a configuração padrão?\n\nOs textos e imagens desta seção serão substituídos pelo conteúdo original.`,
    )
    if (!ok) return
    run(
      () => api.delete(`/api/landing/admin/sections/${active}/`),
      `"${section.title}" voltou ao padrão`,
      [active],
    )
  }

  function restoreAll() {
    const ok = window.confirm(
      'Voltar TODA a landing page para a configuração padrão?\n\nTodas as seções editadas serão substituídas pelo conteúdo original.',
    )
    if (!ok) return
    run(
      () => api.post('/api/landing/admin/reset/'),
      'Landing page voltou à configuração padrão',
      LANDING_SECTIONS.map((s) => s.key),
    )
  }

  function selectSection(key: string) {
    setActive(key)
    setError('')
  }

  return (
    <>
      <div className="admin-page-head">
        <div>
          <h2>Landing page</h2>
          <p className="muted">Edite os textos, imagens e seções do site de divulgação.</p>
        </div>
        <div className="admin-top-actions">
          <a className="btn secondary" href={LANDING_URL} target="_blank" rel="noopener">
            Ver página
          </a>
          <button
            className="btn danger"
            onClick={restoreAll}
            disabled={busy || !data || data.customized.length === 0}
            title="Volta todas as seções para a configuração padrão"
          >
            Restaurar tudo
          </button>
        </div>
      </div>

      {loadError && (
        <div className="card">
          <div className="error">{loadError}</div>
        </div>
      )}
      {!data && !loadError && <div className="card">Carregando…</div>}

      {data && (
        <div className="admin-layout">
          <nav className="admin-sidebar" aria-label="Seções da landing page">
            {LANDING_SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`admin-section-btn ${s.key === active ? 'active' : ''}`}
                onClick={() => selectSection(s.key)}
              >
                <span>{s.title}</span>
                {isDirty(s.key) && <i className="dot" title="Alterações não salvas" />}
                {data.customized.includes(s.key) && <small className="tag">editado</small>}
              </button>
            ))}
            {data.updated_by && (
              <p className="muted admin-updated">
                Última alteração em {formatDate(data.updated_at)} por {data.updated_by}
              </p>
            )}
          </nav>

          <section className="card admin-editor">
            <div className="admin-editor-head">
              <div>
                <h2>{section.title}</h2>
                <p className="muted">{section.description}</p>
              </div>
              <span className={`status-pill ${customized ? 'custom' : ''}`}>
                {customized ? 'Personalizado' : 'Padrão'}
              </span>
            </div>

            <div className="stack">
              {section.fields.map((field) => (
                <FieldEditor
                  key={`${active}.${field.key}`}
                  field={field}
                  value={value[field.key]}
                  onChange={(v) => updateField(field.key, v)}
                />
              ))}
            </div>

            <div className="admin-actions">
              {error && <div className="error">{error}</div>}
              <div className="admin-actions-row">
                <button className="btn" onClick={save} disabled={busy || !dirty}>
                  {busy ? 'Salvando…' : 'Salvar seção'}
                </button>
                <button
                  className="btn secondary"
                  onClick={() => clearDrafts([active])}
                  disabled={busy || !dirty}
                >
                  Descartar alterações
                </button>
                <button
                  className="btn ghost"
                  onClick={restoreSection}
                  disabled={busy || (!customized && !dirty)}
                  title="Volta esta seção para a configuração padrão"
                >
                  Restaurar padrão
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

type EditorProps<F> = { field: F; value: unknown; onChange: (value: unknown) => void }

function FieldEditor({ field, value, onChange }: EditorProps<Field>) {
  if (field.type === 'list') {
    return (
      <ListEditor field={field} value={Array.isArray(value) ? value : []} onChange={onChange} />
    )
  }
  return <ScalarEditor field={field} value={value} onChange={onChange} />
}

function ScalarEditor({ field, value, onChange }: EditorProps<ScalarField>) {
  const id = useId()
  const text = typeof value === 'string' ? value : ''

  if (field.type === 'toggle') {
    return (
      <label className="toggle-row">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        <span>{field.label}</span>
      </label>
    )
  }

  let input
  switch (field.type) {
    case 'rich':
      input = <textarea id={id} rows={3} value={text} onChange={(e) => onChange(e.target.value)} />
      break
    case 'number':
      input = (
        <input
          id={id}
          type="number"
          min={0}
          step="0.01"
          value={typeof value === 'number' ? value : 0}
          onChange={(e) => onChange(Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber)}
        />
      )
      break
    case 'icon':
      input = (
        <select id={id} value={text} onChange={(e) => onChange(e.target.value)}>
          {ICON_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
      break
    case 'image':
      input = <ImageInput id={id} value={text} onChange={onChange} />
      break
    default:
      input = (
        <input
          id={id}
          type={field.type === 'url' ? 'url' : 'text'}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }

  const help = field.help ?? (field.type === 'rich' ? RICH_HELP : undefined)
  return (
    <div className="field">
      {field.label && <label htmlFor={id}>{field.label}</label>}
      {input}
      {help && <small className="field-help">{help}</small>}
    </div>
  )
}

function ImageInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    setUploading(true)
    setError('')
    try {
      const { data } = await api.post<{ url: string }>('/api/landing/admin/upload/', form)
      onChange(data.url)
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível enviar a imagem.'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="image-input">
      {value && <img className="image-preview" src={resolveImage(value)} alt="Pré-visualização" />}
      <div className="image-input-row">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… ou assets/foto.jpg"
        />
        <label className={`btn secondary upload-btn ${uploading ? 'disabled' : ''}`}>
          {uploading ? 'Enviando…' : 'Enviar imagem'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            disabled={uploading}
            onChange={upload}
          />
        </label>
      </div>
      <small className="field-help">JPG, PNG, WEBP ou GIF de até 5 MB.</small>
      {error && <div className="error">{error}</div>}
    </div>
  )
}

function emptyItem(field: ListField): unknown {
  if (field.of === 'number') return 0
  if (typeof field.of === 'string') return ''
  return Object.fromEntries(
    field.of.map((f) => [f.key, f.initial ?? (f.type === 'icon' ? ICON_OPTIONS[0].value : '')]),
  )
}

function ListEditor({ field, value, onChange }: EditorProps<ListField> & { value: unknown[] }) {
  const setItem = (index: number, item: unknown) =>
    onChange(value.map((current, i) => (i === index ? item : current)))

  const move = (index: number, delta: number) => {
    const next = [...value]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    onChange(next)
  }

  const remove = (index: number) => onChange(value.filter((_, i) => i !== index))

  return (
    <fieldset className="list-editor">
      <legend>{field.label}</legend>
      {value.map((item, index) => (
        <div className="list-item" key={index}>
          <div className="list-item-head">
            <strong>
              {field.itemLabel} {index + 1}
            </strong>
            <div className="list-item-tools">
              <button
                type="button"
                className="icon-btn"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Mover para cima"
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => move(index, 1)}
                disabled={index === value.length - 1}
                aria-label="Mover para baixo"
              >
                ↓
              </button>
              <button
                type="button"
                className="icon-btn danger"
                onClick={() => remove(index)}
                aria-label={`Remover ${field.itemLabel.toLowerCase()}`}
              >
                ✕
              </button>
            </div>
          </div>
          {typeof field.of === 'string' ? (
            <ScalarEditor
              field={{ key: String(index), label: '', type: field.of }}
              value={item}
              onChange={(v) => setItem(index, v)}
            />
          ) : (
            field.of.map((sub) => (
              <ScalarEditor
                key={sub.key}
                field={sub}
                value={(item as LandingSection)[sub.key]}
                onChange={(v) => setItem(index, { ...(item as LandingSection), [sub.key]: v })}
              />
            ))
          )}
        </div>
      ))}
      {value.length === 0 && <p className="muted">Nenhum item.</p>}
      <button
        type="button"
        className="btn ghost"
        onClick={() => onChange([...value, emptyItem(field)])}
        disabled={value.length >= MAX_LIST_ITEMS}
      >
        + Adicionar {field.itemLabel.toLowerCase()}
      </button>
    </fieldset>
  )
}
