# Deploy do Drive Norm na Oracle Cloud (Ubuntu 24.04 LTS)

## Arquitetura

| Endereço                       | O que serve                                              |
|--------------------------------|----------------------------------------------------------|
| `https://drivenorm.com.br`     | Landing page (`/drive/landing`), também em `www.`        |
| `https://app.drivenorm.com.br` | PWA (`/drive/frontend/dist`) + `/api`, `/ws`, `/admin`, `/static`, `/media` |

No servidor:

- **Nginx** recebe tudo nas portas 80/443 e repassa `/api`, `/admin` e `/ws` para o **Daphne** (`127.0.0.1:8000`).
- **PostgreSQL** é o banco; **Redis** serve os WebSockets (Channels) e o Celery.
- **Celery** expira propostas de corrida a cada 30 s.
- Daphne e Celery rodam como serviços systemd (`drivenorm-daphne`, `drivenorm-celery`).
- Código em `/drive`, configuração em `/drive/.env`.

## 1. Criar a VM na Oracle Cloud

1. **Compute → Instances → Create instance**.
2. Imagem: **Canonical Ubuntu 24.04**.
3. Shape: `VM.Standard.A1.Flex` (ARM, Always Free, recomendo 2 OCPU / 12 GB) ou `VM.Standard.E2.1.Micro`
   (1 GB de RAM; o script cria swap para o build do frontend).
4. Em *Networking*, marque **Assign a public IPv4 address**.
5. Em *Add SSH keys*, envie sua chave pública (ou baixe a chave gerada).
6. Depois de criada, anote o **IP público**. Para ele não mudar, vá em
   *Networking → IP Management → Reserved Public IPs* e reserve o IP da instância.

## 2. Liberar as portas 80 e 443 na Oracle

**Networking → Virtual Cloud Networks → (sua VCN) → Security Lists → Default Security List → Add Ingress Rules**:

| Source CIDR | IP Protocol | Destination Port |
|-------------|-------------|------------------|
| `0.0.0.0/0` | TCP         | `80`             |
| `0.0.0.0/0` | TCP         | `443`            |

O firewall interno do Ubuntu (iptables) é liberado pelo `setup-server.sh`.

## 3. Configurar o DNS do domínio

No painel onde o domínio `drivenorm.com.br` está (Registro.br, Cloudflare etc.), crie registros **A**
apontando para o IP público da VM:

| Tipo | Nome  | Valor          |
|------|-------|----------------|
| A    | `@`   | `IP_PUBLICO`   |
| A    | `www` | `IP_PUBLICO`   |
| A    | `app` | `IP_PUBLICO`   |

> Se usar Cloudflare, deixe a nuvem **cinza** (DNS only) até o certificado ser emitido no passo 7.

Confira com `dig +short app.drivenorm.com.br` (deve responder o IP).

## 4. Preparar o diretório `/drive`

```bash
ssh -i ~/.ssh/SUA_CHAVE ubuntu@IP_PUBLICO
sudo mkdir -p /drive
sudo chown ubuntu:ubuntu /drive
exit
```

## 5. Enviar o código (na sua máquina)

Na pasta do projeto (`drive_norm/`):

```bash
rsync -avz --delete \
  -e "ssh -i ~/.ssh/SUA_CHAVE" \
  --exclude 'venv/' \
  --exclude '.env' \
  --exclude '__pycache__/' \
  --exclude 'frontend/node_modules/' \
  --exclude 'frontend/dist/' \
  --exclude 'backend/db.sqlite3' \
  --exclude 'backend/media/' \
  --exclude 'backend/staticfiles/' \
  --exclude 'backend/celerybeat-schedule*' \
  --exclude 'WhatsApp Image*' \
  ./ ubuntu@IP_PUBLICO:/drive/
```

Os itens excluídos nunca são apagados no servidor, então o `.env`, o `venv` e as imagens enviadas pelo
painel ficam preservados nas próximas atualizações.

## 6. Criar o `/drive/.env`

```bash
ssh -i ~/.ssh/SUA_CHAVE ubuntu@IP_PUBLICO
cd /drive
cp deploy/.env.production .env
sed -i "s|TROCAR_CHAVE_SECRETA|$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')|" .env
sed -i "s|TROCAR_SENHA_DO_BANCO|$(openssl rand -hex 24)|" .env
nano .env   # opcional: preencha e-mail (EMAIL_*) e Mercado Pago
```

O script do próximo passo cria o usuário e o banco do PostgreSQL com a senha que estiver no `.env`.

## 7. Instalar tudo

```bash
bash /drive/deploy/setup-server.sh
```

O script instala Python, Node 22, PostgreSQL, Redis e Nginx, libera o firewall, cria o banco, registra os
serviços, roda as migrações, faz o build do frontend e sobe tudo.

Com o DNS já propagado, gere o HTTPS (o Certbot configura o redirecionamento de HTTP para HTTPS e a
renovação automática):

```bash
sudo certbot --nginx -d drivenorm.com.br -d www.drivenorm.com.br -d app.drivenorm.com.br
```

## 8. Criar o administrador

Não rode `seed_demo` em produção (ele cria usuários com senhas conhecidas). Crie o admin assim:

```bash
cd /drive/backend
../venv/bin/python manage.py shell -c "import getpass; from accounts.models import User; User.objects.create_superuser(input('Usuário: '), input('E-mail: '), getpass.getpass('Senha: '), role=User.Role.ADMIN)"
```

Depois entre em `https://app.drivenorm.com.br` com esse usuário para abrir o painel.

## 9. Mercado Pago (PIX)

1. No painel do admin, aba **PIX e pagamentos**, cole o Access Token de produção.
2. No Mercado Pago Developers, cadastre o webhook (evento *Pagamentos*):
   `https://app.drivenorm.com.br/api/payments/webhook/mercadopago/`

Sem token, o PIX fica **desativado** em produção.

## Atualizar o sistema

Na sua máquina, rode o mesmo `rsync` do passo 5 e depois:

```bash
ssh -i ~/.ssh/SUA_CHAVE ubuntu@IP_PUBLICO "bash /drive/deploy/deploy.sh"
```

Se mudar `deploy/nginx/drivenorm.conf` ou os arquivos de `deploy/systemd/`, copie de novo para
`/etc/nginx/sites-available/` ou `/etc/systemd/system/` (e rode `sudo systemctl daemon-reload`). Atenção:
o Certbot editou o arquivo do Nginx no servidor. Se substituí-lo, rode `sudo certbot --nginx` de novo.

## Logs e diagnóstico

```bash
sudo systemctl status drivenorm-daphne drivenorm-celery nginx postgresql redis-server
journalctl -u drivenorm-daphne -f      # backend (inclui e-mails se EMAIL_HOST estiver vazio)
journalctl -u drivenorm-celery -f
sudo tail -f /var/log/nginx/error.log
```

| Sintoma                              | Causa provável                                                         |
|--------------------------------------|------------------------------------------------------------------------|
| Site não abre de fora                | Portas 80/443 não liberadas na Security List (passo 2) ou no iptables  |
| `502 Bad Gateway`                    | Daphne parado: veja `journalctl -u drivenorm-daphne`                   |
| `400 Bad Request` na API             | Domínio faltando em `DJANGO_ALLOWED_HOSTS`                             |
| Tempo real (propostas) não chega     | WebSocket: confira Redis ativo e `CHANNEL_LAYER_BACKEND=redis`         |
| Landing sem o conteúdo do painel     | `CORS_ALLOWED_ORIGINS` sem `https://drivenorm.com.br`                  |
| App antigo após atualização          | Cache do PWA: feche e abra o app de novo                               |

## Backup do banco

Backup diário às 3h, guardando 14 dias:

```bash
mkdir -p /home/ubuntu/backups
crontab -e
```

Adicione a linha:

```cron
0 3 * * * pg_dump -h 127.0.0.1 -U drive_norm drive_norm | gzip > /home/ubuntu/backups/drive_norm_$(date +\%F).sql.gz && find /home/ubuntu/backups -name '*.sql.gz' -mtime +14 -delete
```

Para o `pg_dump` não pedir senha, crie `~/.pgpass` com `127.0.0.1:5432:drive_norm:drive_norm:SENHA_DO_BANCO`
e rode `chmod 600 ~/.pgpass`. Guarde também uma cópia de `/drive/backend/media/` (imagens da landing).
