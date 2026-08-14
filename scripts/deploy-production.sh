#!/usr/bin/env bash
# Deploy de produção. Pré-condições:
#   - rodando em /home/ubuntu/Transportes-samu como user ubuntu
#   - .env.production existe e contém DATABASE_URL, WA_ALLOWED_CHATS, etc
#   - pm2, pnpm e Node 22+ instalados no host
#   - GH Actions runner já checou out a versão a deployar
#
# Idempotente: roda mesmo se um deploy anterior travou pela metade.
# Em falha de health check, abort sem reload (versão antiga continua de pé).
set -euo pipefail

APP_DIR="/home/ubuntu/Transportes-samu"
WEB_NAME="transportes-web"
INGEST_NAME="transportes-ingest"
HEALTH_URL="http://127.0.0.1:3020/api/health"
PUBLIC_URL="https://transportes.mnrs.com.br/api/health"

info()  { echo "[deploy][INFO]  $*"; }
warn()  { echo "[deploy][WARN]  $*" >&2; }
fatal() { echo "[deploy][ERROR] $*" >&2; exit 1; }

cd "$APP_DIR" || fatal "checkout dir $APP_DIR not found"

# ─── Sanity ───────────────────────────────────────────────────────────────
[[ -f .env.production ]] || fatal ".env.production is missing"
command -v pnpm >/dev/null || fatal "pnpm not installed"
command -v pm2  >/dev/null || fatal "pm2 not installed"
[[ -d .git ]] || fatal "$APP_DIR não é um repo git — clone primeiro (vide deploy/README.md)"

# ─── Pull do código mais recente ──────────────────────────────────────────
# actions/checkout@v4 do workflow vai para $GITHUB_WORKSPACE
# (~/actions-runner-transportes/_work/...), NÃO para $APP_DIR. Esse script
# roda em $APP_DIR, então é aqui que o pull tem que acontecer.
info "pulling main"
git fetch --quiet origin main
git checkout --quiet main
git reset --hard --quiet origin/main
info "checked out $(git rev-parse --short HEAD): $(git log -1 --pretty=%s)"

# ─── Install ──────────────────────────────────────────────────────────────
info "installing dependencies (frozen lockfile)"
pnpm install --frozen-lockfile

# ─── DB migrate ───────────────────────────────────────────────────────────
info "applying migrations"
set -a
# shellcheck disable=SC1091
source .env.production
set +a
pnpm db:migrate

# ─── DB seed (units canónicas) ────────────────────────────────────────────
# Idempotente: ON CONFLICT (code) DO UPDATE preserva id+createdAt, atualiza
# nome/aliases/displayOrder. Limpa órfãos quando seguro (sem FK refs).
# Garante que mudanças em packages/shared/src/units.ts atinjam prod no
# próximo deploy.
info "seeding units"
pnpm db:seed

# ─── Build ────────────────────────────────────────────────────────────────
info "building all workspaces"
pnpm build

# ─── Remove dormant ingest process (Baileys desligado) ────────────────────
# $INGEST_NAME voltou ao ecosystem: não é mais worker Baileys (que
# competia sessão WhatsApp), e sim receptor de webhook do gateway
# whatsmeow em 127.0.0.1:3082. O reload abaixo cuida dele junto com a web.

# ─── PM2 reload (or start on first deploy) ────────────────────────────────
if pm2 describe "$WEB_NAME" >/dev/null 2>&1; then
  info "reloading existing PM2 processes"
  GIT_COMMIT_SHA="${GIT_COMMIT_SHA:-unknown}" \
    pm2 reload ecosystem.config.cjs --update-env
  pm2 save
else
  info "first deploy — starting PM2 processes"
  GIT_COMMIT_SHA="${GIT_COMMIT_SHA:-unknown}" \
    pm2 start ecosystem.config.cjs
  pm2 save
fi

# ─── Validate local ───────────────────────────────────────────────────────
info "validating local health: $HEALTH_URL"
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  sleep 2
  RESPONSE="$(curl -fsS "$HEALTH_URL" 2>/dev/null || true)"
  if [[ -n "$RESPONSE" ]]; then
    OK=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('ok'))" 2>/dev/null || echo "false")
    if [[ "$OK" == "True" ]]; then
      info "local health OK: $RESPONSE"
      break
    fi
  fi
  if [[ $attempt -eq 10 ]]; then
    fatal "local health never reported ok after 20s — abort"
  fi
done

# ─── Validate public ──────────────────────────────────────────────────────
info "validating public health: $PUBLIC_URL"
CODE=$(curl -sk -o /dev/null -w "%{http_code}" "$PUBLIC_URL" || echo "000")
if [[ "$CODE" != "200" ]]; then
  warn "public health returned $CODE (nginx pode estar em transição)"
  fatal "public health check failed"
fi

info "deploy OK"
