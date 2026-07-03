#!/usr/bin/env bash
# Deploy de produção. Pré-condições:
#   - rodando em /home/ubuntu/transportes-samu como user ubuntu
#   - .env.production existe e contém DATABASE_URL, WA_ALLOWED_CHATS, etc
#   - pm2, pnpm e Node 22+ instalados no host
#   - GH Actions runner já checou out a versão a deployar
#   - DEPLOY_BUILD_ARTIFACT (opcional, caminho absoluto): tgz com os
#     outputs de build gerados no runner do GitHub (apps/web/.next).
#     Definido → nada de pnpm build na EC2. Ausente → fallback de
#     emergência com build local (pesado pro host).
#
# Idempotente: roda mesmo se um deploy anterior travou pela metade.
# Em falha de health check, abort sem reload (versão antiga continua de pé).
set -euo pipefail

APP_DIR="/home/ubuntu/transportes-samu"
WEB_NAME="transportes-web"
INGEST_NAME="transportes-ingest"
HEALTH_URL="http://127.0.0.1:3008/api/health"
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

# ─── Install (condicional ao lockfile) ────────────────────────────────────
# pnpm install é um dos passos mais pesados pro host compartilhado (já
# contribuiu pra OOM/swap esgotado). Sem build local, o runtime só precisa
# de node_modules em dia com o lockfile do commit deployado — instala
# apenas quando pnpm-lock.yaml muda (hash persistido em
# node_modules/.deployed-lock-hash), mantendo o deploy típico leve.
LOCK_MARKER="node_modules/.deployed-lock-hash"
LOCK_WANT="$(sha256sum pnpm-lock.yaml | awk '{print $1}')"
LOCK_HAVE="$(cat "$LOCK_MARKER" 2>/dev/null || true)"
if [[ -d node_modules && "$LOCK_WANT" == "$LOCK_HAVE" ]]; then
  info "node_modules em dia com pnpm-lock.yaml — install pulado"
else
  info "lockfile mudou (ou primeiro deploy neste modo) — installing dependencies (frozen lockfile)"
  pnpm install --frozen-lockfile
  printf '%s\n' "$LOCK_WANT" > "$LOCK_MARKER"
  info "dependencies instaladas e marker atualizado"
fi

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

# ─── Build (artefato pré-buildado do CI) ──────────────────────────────────
# O job `gate` do workflow roda `pnpm build` em ubuntu-latest e publica o
# resultado como artefato — a EC2 NÃO builda mais (era o maior pico de
# RAM/CPU do host, causa dos OOM). O único output de build que o runtime
# usa é apps/web/.next (PM2 roda `next start`): packages/* exportam .ts
# direto (transpilePackages/tsx) e apps/ingest compila com noEmit.
# Output de next build é JS puro — buildar em x64 e rodar em arm64 é ok.
BUILD_OUTPUT_DIRS=("apps/web/.next")
BUILD_STAGING=".build-incoming"

if [[ -n "${DEPLOY_BUILD_ARTIFACT:-}" ]]; then
  info "applying prebuilt artifact: $DEPLOY_BUILD_ARTIFACT"
  [[ -f "$DEPLOY_BUILD_ARTIFACT" ]] || fatal "artefato de build não encontrado: $DEPLOY_BUILD_ARTIFACT"

  # Extrai em staging e valida ANTES de tocar em qualquer dir de produção.
  rm -rf "$BUILD_STAGING"
  mkdir -p "$BUILD_STAGING"
  if ! tar -xzf "$DEPLOY_BUILD_ARTIFACT" -C "$BUILD_STAGING"; then
    rm -rf "$BUILD_STAGING"
    fatal "falha ao extrair $DEPLOY_BUILD_ARTIFACT — produção intocada"
  fi
  if [[ ! -f "$BUILD_STAGING/apps/web/.next/BUILD_ID" ]]; then
    rm -rf "$BUILD_STAGING"
    fatal "artefato sem apps/web/.next/BUILD_ID — build inválido, produção intocada"
  fi
  for dir in "${BUILD_OUTPUT_DIRS[@]}"; do
    if [[ ! -d "$BUILD_STAGING/$dir" ]]; then
      rm -rf "$BUILD_STAGING"
      fatal "artefato não contém $dir — produção intocada"
    fi
  done

  # Troca atômica por diretório de output: o build anterior fica em
  # <dir>.prev até TODOS os novos estarem no lugar; só então descarta.
  for dir in "${BUILD_OUTPUT_DIRS[@]}"; do
    rm -rf "$dir.prev"
    [[ ! -d "$dir" ]] || mv "$dir" "$dir.prev"
    mv "$BUILD_STAGING/$dir" "$dir"
  done
  for dir in "${BUILD_OUTPUT_DIRS[@]}"; do
    rm -rf "$dir.prev"
  done
  rm -rf "$BUILD_STAGING"
  info "artefato aplicado (BUILD_ID=$(cat apps/web/.next/BUILD_ID))"
else
  # Fallback de emergência: build local na EC2. É exatamente o que já
  # esgotou RAM+swap do host compartilhado — só use se o CI estiver fora.
  warn "DEPLOY_BUILD_ARTIFACT não definido — FALLBACK para pnpm build LOCAL"
  warn "build local é PESADO pra esta EC2 compartilhada (risco de OOM); use apenas em emergência"
  info "building all workspaces"
  pnpm build
fi

# ─── Remove dormant ingest process (Baileys desligado) ────────────────────
# Worker Baileys foi tirado do ecosystem por estar em loop de reconexão
# competindo sessão WhatsApp com outra app no mesmo EC2. Pode estar
# carregado no daemon PM2 desde deploys anteriores — tira do ar e do dump.
if pm2 describe "$INGEST_NAME" >/dev/null 2>&1; then
  info "deleting dormant $INGEST_NAME"
  pm2 delete "$INGEST_NAME" || true
  pm2 save || true
fi

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
