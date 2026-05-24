#!/usr/bin/env bash
# Idempotent local Postgres bootstrap for dev. Assumes Homebrew postgresql@18
# is installed and running. Creates role and database if they don't exist.
#
# Usage: pnpm setup:db   (or: bash scripts/setup-db.sh)
set -euo pipefail

ROLE="samu_cru"
DB="samu_cru_dev"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found — install Postgres first (brew install postgresql@18)" >&2
  exit 1
fi

if ! pg_isready -q; then
  echo "Postgres is not running. Try: brew services start postgresql@18" >&2
  exit 1
fi

# Create role if missing
if ! psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${ROLE}'" postgres | grep -q 1; then
  echo "[setup-db] creating role ${ROLE}"
  createuser -s "${ROLE}"
else
  echo "[setup-db] role ${ROLE} already exists"
fi

# Create database if missing
if ! psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB}'" postgres | grep -q 1; then
  echo "[setup-db] creating database ${DB} owned by ${ROLE}"
  createdb -O "${ROLE}" "${DB}"
else
  echo "[setup-db] database ${DB} already exists"
fi

# Sanity check
psql -d "${DB}" -U "${ROLE}" -c 'SELECT version();' >/dev/null
echo "[setup-db] ready — DATABASE_URL=postgres://${ROLE}@localhost:5432/${DB}"
