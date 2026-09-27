#!/usr/bin/env bash
# Instalação inicial do Drive Norm num Ubuntu 24.04 LTS (Oracle Cloud).
# Rode uma única vez, como usuário ubuntu, depois de copiar o código para /drive e criar /drive/.env:
#   bash /drive/deploy/setup-server.sh
set -euo pipefail

APP_DIR=/drive
ENV_FILE="$APP_DIR/.env"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$SCRIPT_DIR" != "$APP_DIR/deploy" ]]; then
  echo "ERRO: o projeto precisa estar direto em $APP_DIR, mas este script está em $SCRIPT_DIR." >&2
  echo "Clone com: git clone https://github.com/lhcabral/drive_norm.git $APP_DIR" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERRO: $ENV_FILE não existe. Copie deploy/.env.production para $ENV_FILE e preencha." >&2
  exit 1
fi
if grep -q "TROCAR_" "$ENV_FILE"; then
  echo "ERRO: ainda há valores TROCAR_* em $ENV_FILE." >&2
  exit 1
fi

missing=0
for f in \
  deploy/deploy.sh \
  deploy/nginx/drivenorm.conf \
  deploy/systemd/drivenorm-daphne.service \
  deploy/systemd/drivenorm-celery.service \
  backend/manage.py \
  backend/requirements.txt \
  frontend/package.json \
  frontend/package-lock.json \
  frontend/.env.production \
  landing/index.html; do
  if [[ ! -f "$APP_DIR/$f" ]]; then
    echo "ERRO: arquivo ausente: $APP_DIR/$f" >&2
    missing=1
  fi
done
if [[ "$missing" -ne 0 ]]; then
  echo "Envie o projeto completo para $APP_DIR (veja o passo 5 do deploy/DEPLOY.md) e rode de novo." >&2
  exit 1
fi

env_get() { grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2-; }
DB_NAME=$(env_get POSTGRES_DB)
DB_USER=$(env_get POSTGRES_USER)
DB_PASS=$(env_get POSTGRES_PASSWORD)

echo "==> Pacotes do sistema"
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  python3 python3-venv python3-dev build-essential libpq-dev \
  postgresql postgresql-contrib redis-server nginx \
  certbot python3-certbot-nginx rsync curl ca-certificates \
  iptables-persistent netfilter-persistent

sudo timedatectl set-timezone America/Sao_Paulo

echo "==> Node.js 22"
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> Swap (máquinas com pouca RAM precisam para o build do frontend)"
if [[ "$(free -m | awk '/^Mem:/{print $2}')" -lt 2048 ]] && ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
fi

echo "==> Firewall do sistema (as imagens Ubuntu da Oracle bloqueiam tudo além da 22 via iptables)"
for port in 80 443; do
  if ! sudo iptables -C INPUT -p tcp -m state --state NEW --dport "$port" -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT 1 -p tcp -m state --state NEW --dport "$port" -j ACCEPT
  fi
done
sudo netfilter-persistent save

echo "==> PostgreSQL"
sudo systemctl enable --now postgresql
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SQL
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "$DB_USER" -E UTF8 "$DB_NAME"
fi

echo "==> Redis"
sudo systemctl enable --now redis-server

echo "==> Permissões"
sudo chown -R ubuntu:ubuntu "$APP_DIR"
chmod 600 "$ENV_FILE"
mkdir -p "$APP_DIR/backend/media" "$APP_DIR/backend/staticfiles"

echo "==> Serviços systemd"
sudo cp "$APP_DIR/deploy/systemd/drivenorm-daphne.service" /etc/systemd/system/
sudo cp "$APP_DIR/deploy/systemd/drivenorm-celery.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable drivenorm-daphne drivenorm-celery

echo "==> Nginx"
sudo cp "$APP_DIR/deploy/nginx/drivenorm.conf" /etc/nginx/sites-available/drivenorm.conf
sudo ln -sf /etc/nginx/sites-available/drivenorm.conf /etc/nginx/sites-enabled/drivenorm.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo "==> Build e migrações"
bash "$APP_DIR/deploy/deploy.sh"

echo
echo "Instalação concluída. Próximos passos:"
echo "  1) Com o DNS já apontando para este servidor, gere o HTTPS:"
echo "     sudo certbot --nginx -d drivenorm.com.br -d www.drivenorm.com.br -d app.drivenorm.com.br"
echo "  2) Crie o administrador (veja deploy/DEPLOY.md, seção 'Criar o administrador')."
