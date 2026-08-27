#!/bin/bash
# SessionStart hook for Claude Code on the web (the Anthropic-managed cloud
# sandbox). It brings up a local PostgreSQL instance and installs/prepares
# the app so tests, lint, and `npm run dev` work without manual steps.
#
# This sandbox has no Docker daemon, so the repo's normal docker-compose
# based `db:setup` flow (see apps/api/package.json) can't bring up Postgres.
# We start a local `postgres` cluster instead, with the same
# postgres/postgres/app credentials the app already expects.
#
# Must NOT run in GitHub Codespaces or a plain local checkout: there,
# Docker is available and the repo's own db:setup flow (docker compose up,
# see CLAUDE.md) already handles everything correctly.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

if [ -n "${CODESPACES:-}" ] || [ -n "${CODESPACE_NAME:-}" ]; then
  exit 0
fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  # A real Docker daemon is available after all -- let the repo's own
  # db:setup (docker compose) flow handle Postgres, as it does elsewhere.
  exit 0
fi

PG_VERSION=16
PG_USER=postgres
PG_PASSWORD=postgres
PG_DB=app

if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq "postgresql-${PG_VERSION}"
fi

if ! pg_lsclusters | awk '$1=="'"${PG_VERSION}"'" && $2=="main"' | grep -q main; then
  pg_createcluster "${PG_VERSION}" main
fi

if ! pg_lsclusters | awk '$1=="'"${PG_VERSION}"'" && $2=="main" {print $4}' | grep -q online; then
  pg_ctlcluster "${PG_VERSION}" main start
fi

for _ in $(seq 1 30); do
  pg_isready -h localhost -p 5432 -U "${PG_USER}" >/dev/null 2>&1 && break
  sleep 1
done

sudo -u postgres psql -v ON_ERROR_STOP=1 -tAc \
  "ALTER USER ${PG_USER} WITH PASSWORD '${PG_PASSWORD}';" >/dev/null

sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" \
  | grep -q 1 || sudo -u postgres psql -v ON_ERROR_STOP=1 -tAc "CREATE DATABASE ${PG_DB};" >/dev/null

cd "$CLAUDE_PROJECT_DIR"

npm install

if [ ! -f apps/api/.env ]; then
  cp apps/api/.env.example apps/api/.env
fi

npm run prisma:generate --workspace api

cd apps/api
npx prisma migrate deploy
npx prisma db seed
