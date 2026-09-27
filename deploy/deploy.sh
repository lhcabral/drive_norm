#!/usr/bin/env bash
# Atualiza dependências, banco, arquivos estáticos e frontend, e reinicia os serviços.
# Rode no servidor sempre que enviar uma nova versão do código:
#   bash /drive/deploy/deploy.sh
set -euo pipefail

APP_DIR=/drive
cd "$APP_DIR"

echo "==> Backend"
[[ -d venv ]] || python3 -m venv venv
venv/bin/pip install --upgrade pip
venv/bin/pip install -r backend/requirements.txt

cd "$APP_DIR/backend"
../venv/bin/python manage.py migrate --noinput
../venv/bin/python manage.py collectstatic --noinput

echo "==> Frontend"
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "==> Reiniciando serviços"
sudo systemctl restart drivenorm-daphne drivenorm-celery
sudo systemctl reload nginx

sleep 2
systemctl --no-pager --lines=0 status drivenorm-daphne drivenorm-celery nginx
echo "Deploy concluído."
