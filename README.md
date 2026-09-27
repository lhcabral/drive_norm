# Drive Norm

Sistema de carteira de créditos para corridas: API Django REST + WebSockets e frontend PWA instalável no celular.

## Funcionalidades

- Cadastro público de **cliente**; **motoristas** são cadastrados pelo admin
- Recuperação de senha por e-mail ou redefinição pelo admin
- Painel do admin: clientes, motoristas, crédito manual, PIX e landing page
- Código único do cliente (ex.: `DN-A7K2`)
- Carteira com **extrato imutável** (ledger)
- Motorista lança crédito manual e envia proposta de valor da corrida
- Cliente aceita/recusa em tempo real (WebSocket + timeout)
- Recarga via **PIX** (Mercado Pago) ou **simulação** em desenvolvimento
- PWA: abra no navegador e use “Adicionar à tela inicial”

## Estrutura

```
drive_norm/
  backend/           # Django + DRF + Channels
  frontend/          # React + Vite PWA
  landing/           # Site do motorista (HTML/CSS/JS estático)
  deploy/            # Deploy na Oracle Cloud (veja deploy/DEPLOY.md)
  docker-compose.yml # Postgres + Redis (opcional)
  .env.example
```

## Pré-requisitos

- Python 3.12+
- Node.js 20+
- (Opcional) Docker para Postgres/Redis

## Setup rápido (SQLite + canal in-memory)

### Backend

```bash
cd drive_norm
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env
cd backend
python manage.py migrate
python manage.py seed_demo
daphne -b 0.0.0.0 -p 8000 drive_norm.asgi:application
```

Usuários demo:

| Usuário    | Senha         | Papel      |
|------------|---------------|------------|
| cliente    | cliente123    | Cliente    |
| motorista  | motorista123  | Motorista  |
| admin      | admin123      | Admin web  |

O código do cliente demo é exibido ao rodar `seed_demo` e também na home do app.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Abra http://localhost:5173

O Vite faz proxy de `/api` e, para WebSocket em desenvolvimento, o app conecta em `ws://127.0.0.1:8000`.

### Landing page

Site de divulgação com promoções, contato e explicação do app. Não precisa de build:

```bash
cd landing
python3 -m http.server 8765
```

Abra http://localhost:8765. Fora de `localhost`, `landing/script.js` usa `https://app.drivenorm.com.br`
como API e link do app (veja `CONFIG` no topo do arquivo).

#### Painel de edição da landing (admin)

Na aba **Landing page** do painel do admin (http://localhost:5173/painel/landing), cada seção da página (cabeçalho, destaque, oferta, promoção, como funciona, exemplos, dúvidas,
contato, rodapé e configurações gerais, como link do app e número do WhatsApp) pode ser editada,
ocultada e ter imagens trocadas por upload.

- **Salvar seção** publica na hora; a landing lê o conteúdo de `GET /api/landing/`.
- **Restaurar padrão** volta a seção para o conteúdo original; **Restaurar tudo** volta a página inteira.
- O conteúdo padrão fica em `backend/landing_content/defaults.py` e é o mesmo texto fixo de
  `landing/index.html`, exibido quando a API não responde. Se mudar um, mude o outro.
- Nos textos longos, `**texto**` vira negrito e `*texto*` itálico.
- O botão "Ver página" usa `VITE_LANDING_URL` (padrão `http://localhost:8765`).
- Imagens enviadas vão para `backend/media/` e são servidas pelo Django só com `DJANGO_DEBUG=True`;
  em produção, sirva `/media/` pelo servidor web.

## Painel do admin

Entre no app com `admin` / `admin123`: você cai direto em http://localhost:5173/painel.

- **Clientes**: resumo geral (clientes, saldo nas carteiras, corridas do dia, situação do PIX), busca
  por nome, código, telefone, usuário ou e-mail, e a ficha de cada cliente com saldo, extrato,
  corridas, recargas PIX, edição de dados, bloqueio de acesso, crédito/débito manual e senha.
- **Motoristas**: o cadastro de motorista é feito só aqui (o cadastro público do app cria apenas
  clientes). Dá para editar dados e veículo, bloquear e redefinir a senha.
- **Senhas**: o admin define uma senha, gera uma automática (com botão para enviar pelo WhatsApp) ou
  envia o link de recuperação por e-mail. O próprio cliente pode usar "Esqueci minha senha" no login,
  desde que tenha e-mail cadastrado.
- **PIX e pagamentos**: cadastro do token do Mercado Pago e lista de recargas.
- **Landing page**: editor do site de divulgação (veja acima).

### E-mail (recuperação de senha)

Sem `EMAIL_HOST` no `.env`, os e-mails aparecem no terminal do backend (útil em desenvolvimento).
Para enviar de verdade, preencha `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`
e `DEFAULT_FROM_EMAIL` (ex.: SMTP do Gmail com senha de app, Brevo, SendGrid). O link leva para
`FRONTEND_URL/redefinir-senha` e vale por 2 horas.

## PIX / Mercado Pago

1. Crie uma aplicação no [Mercado Pago Developers](https://www.mercadopago.com.br/developers/panel/app)
   e copie o **Access Token de produção**.
2. Cole o token no painel, aba **PIX e pagamentos**. Ele é validado com o Mercado Pago antes de salvar.
   Alternativa: `MERCADOPAGO_ACCESS_TOKEN` no `.env` (usado só se o painel estiver vazio).
3. Cadastre no Mercado Pago o webhook `BACKEND_URL/api/payments/webhook/mercadopago/` (evento
   Pagamentos). O `BACKEND_URL` precisa ser público.

Com token, o crédito entra sozinho na carteira quando o pagamento é aprovado (pelo webhook ou pela
consulta que o app faz enquanto o cliente está na tela de recarga). Sem token, o PIX é **simulado**
quando `DJANGO_DEBUG=True` (botão **Simular pagamento**) e **desativado** em produção.

## Postgres + Redis (produção/local avançado)

```bash
docker compose up -d
```

No `.env`:

```env
USE_POSTGRES=True
CHANNEL_LAYER_BACKEND=redis
REDIS_URL=redis://127.0.0.1:6379/0
```

Celery (timeout de propostas a cada 30s):

```bash
cd backend
celery -A drive_norm worker -B -l info
```

Mesmo sem Celery, propostas expiradas são limpas ao listar/aceitar.

## API principal

- `POST /api/auth/register/` (só clientes) · `POST /api/auth/login/`
- `POST /api/auth/password/forgot/` · `POST /api/auth/password/reset/`
- `GET /api/me/`
- `GET /api/clients/lookup/?code=DN-XXXX`
- `GET /api/wallet/` · `GET /api/wallet/ledger/` · `POST /api/wallet/credit/`
- `POST /api/rides/proposals/` · `POST .../accept/` · `POST .../reject/`
- `GET /api/rides/`
- `POST /api/payments/pix/` · webhook Mercado Pago
- `GET /api/landing/` (público) · `GET /api/landing/admin/` · `PUT|DELETE /api/landing/admin/sections/<seção>/`
  · `POST /api/landing/admin/reset/` · `POST /api/landing/admin/upload/`
- Painel (admin): `/api/admin/summary/` · `clients/` · `clients/<id>/` · `clients/<id>/wallet/`
  · `drivers/` · `drivers/<id>/` · `users/<id>/password/` · `users/<id>/password-email/`
  · `payments/` · `pix/` · `pix/test/`
- WebSocket `ws://host/ws/notifications/?token=<JWT>`

## Django admin

http://127.0.0.1:8000/admin/ — usuário `admin` / `admin123`
