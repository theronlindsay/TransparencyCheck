#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

if [ ! -f .env ]; then
  command -v openssl >/dev/null 2>&1 || { echo 'Install openssl to generate deployment secrets.' >&2; exit 1; }
  umask 077
  cp .env.example .env
  for key in MONGO_ROOT_PASSWORD MONGO_APP_PASSWORD BETTER_AUTH_SECRET ADMIN_PANEL_PASSWORD CRON_SECRET; do
    value=$(openssl rand -hex 32)
    sed -i "s/^${key}=$/${key}=${value}/" .env
  done
  echo 'Created .env with unique secrets. Set your three domains, ACME_EMAIL and API keys, then run ./init.sh again.'
  exit 0
fi

command -v docker >/dev/null 2>&1 || { echo 'Install Docker Engine and the Docker Compose plugin first.' >&2; exit 1; }
docker compose config --quiet
# Serialize image builds to reduce peak build RAM. No duplicate host-side build.
docker compose --parallel 1 build
docker compose up -d --wait
echo 'Services are running. Open https://<APP_DOMAIN> or https://<ADMIN_DOMAIN>/admin using the domains in .env.'
echo 'Check certificate issuance with: docker compose logs traefik'
