const IS_LOCAL = ['localhost', '127.0.0.1', ''].includes(window.location.hostname)

const CONFIG = {
  // Endereço da API (pasta backend/), sem barra no final. O conteúdo editado no painel do admin
  // vem de `${apiUrl}/api/landing/`. Deixe vazio para usar só o texto fixo deste HTML.
  apiUrl: IS_LOCAL ? 'http://127.0.0.1:8000' : 'https://app.drivenorm.com.br',
  // Valores usados quando a API não responde.
  appUrl: IS_LOCAL ? 'http://localhost:5173' : 'https://app.drivenorm.com.br',
  whatsapp: '5584921601952',
  exampleStartBalance: 120,
  exampleRides: [20, 15, 25, 10, 30],
}

const money = (value) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

// **negrito**, *itálico* e quebras de linha; todo o resto é exibido como texto.
const rich = (value) =>
  escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />')

const pick = (content, path) => path.split('.').reduce((obj, key) => obj?.[key], content)

const icon = (name) => `<svg><use href="#i-${escapeHtml(name)}" /></svg>`

const templates = {
  check: (item) => `<li>${rich(item)}</li>`,
  step: (step, i) => `
    <li class="step">
      <span class="step-num">${i + 1}</span>
      <div class="step-icon">${icon(step.icon)}</div>
      <h3>${escapeHtml(step.title)}</h3>
      <p>${rich(step.text)}</p>
    </li>`,
  appLink: (link) => `
    <a class="app-link" data-app-path="${escapeHtml(link.path)}">
      ${icon(link.icon)}
      <span><b>${escapeHtml(link.title)}</b>${escapeHtml(link.subtitle)}</span>
    </a>`,
  perk: (perk) => `<li>${icon(perk.icon)}<span>${escapeHtml(perk.text)}</span></li>`,
  faq: (item) => `
    <details>
      <summary>${escapeHtml(item.question)}</summary>
      <p>${rich(item.answer)}</p>
    </details>`,
}

async function fetchContent() {
  if (!CONFIG.apiUrl) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)
  try {
    const response = await fetch(`${CONFIG.apiUrl}/api/landing/`, { signal: controller.signal })
    return response.ok ? await response.json() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function applyContent(content) {
  document.title = content.general.page_title
  document.querySelector('meta[name="description"]')?.setAttribute('content', content.general.meta_description)
  CONFIG.appUrl = content.general.app_url
  CONFIG.whatsapp = content.general.whatsapp_number
  CONFIG.exampleStartBalance = content.examples.start_balance
  CONFIG.exampleRides = content.examples.rides

  document.querySelectorAll('[data-text]').forEach((el) => {
    el.textContent = pick(content, el.dataset.text) ?? el.textContent
  })
  document.querySelectorAll('[data-rich]').forEach((el) => {
    const value = pick(content, el.dataset.rich)
    if (value != null) el.innerHTML = rich(value)
  })
  document.querySelectorAll('[data-src]').forEach((el) => {
    el.src = pick(content, el.dataset.src) || el.src
  })
  document.querySelectorAll('[data-alt]').forEach((el) => {
    el.alt = pick(content, el.dataset.alt) ?? el.alt
  })
  document.querySelectorAll('[data-whatsapp-field]').forEach((el) => {
    el.dataset.whatsapp = pick(content, el.dataset.whatsappField) ?? el.dataset.whatsapp
  })
  document.querySelectorAll('[data-list]').forEach((el) => {
    const items = pick(content, el.dataset.list) || []
    el.innerHTML = items.map(templates[el.dataset.template]).join('')
  })
  // data-show="a.enabled b.enabled": visível se qualquer uma das chaves for verdadeira.
  document.querySelectorAll('[data-show]').forEach((el) => {
    el.hidden = !el.dataset.show.split(' ').some((path) => pick(content, path))
  })
}

function wireLinks() {
  document.querySelectorAll('[data-app-path]').forEach((el) => {
    el.href = CONFIG.appUrl + el.dataset.appPath
  })
  document.querySelectorAll('[data-whatsapp]').forEach((el) => {
    const text = encodeURIComponent(el.dataset.whatsapp)
    el.href = `https://wa.me/${CONFIG.whatsapp}?text=${text}`
    el.target = '_blank'
    el.rel = 'noopener'
  })
}

function renderExamples() {
  let balance = CONFIG.exampleStartBalance
  document.getElementById('examples-grid').innerHTML = CONFIG.exampleRides
    .map((ride) => {
      balance -= ride
      return `
      <div class="example">
        <svg><use href="#i-car" /></svg>
        <strong>${money(ride)}</strong>
        <span>Saldo restante</span>
        <b>${money(balance)}</b>
      </div>`
    })
    .join('')
}

function setupReveal() {
  const targets = document.querySelectorAll(
    '.offer-card, .use-anywhere, .promo-main, .promo-flyer, .step, .app-panel, .examples-box, .perks li, .faq details, .installments, .whats-card',
  )
  if (!('IntersectionObserver' in window)) return
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
          io.unobserve(entry.target)
        }
      }),
    { threshold: 0.15 },
  )
  targets.forEach((el) => {
    el.classList.add('reveal')
    io.observe(el)
  })
}

document.getElementById('year').textContent = new Date().getFullYear()

const toggle = document.getElementById('menu-toggle')
const menu = document.getElementById('menu')
toggle.addEventListener('click', () => {
  const open = menu.classList.toggle('open')
  toggle.setAttribute('aria-expanded', String(open))
})
menu.querySelectorAll('a').forEach((a) =>
  a.addEventListener('click', () => {
    menu.classList.remove('open')
    toggle.setAttribute('aria-expanded', 'false')
  }),
)

const topbar = document.querySelector('.topbar')
const onScroll = () => topbar.classList.toggle('scrolled', window.scrollY > 10)
window.addEventListener('scroll', onScroll, { passive: true })
onScroll()

fetchContent().then((content) => {
  if (content) applyContent(content)
  wireLinks()
  renderExamples()
  setupReveal()
  document.documentElement.classList.remove('cms-loading')
})
