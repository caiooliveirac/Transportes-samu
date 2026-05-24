# Transportes SAMU/CRU

Dashboard operacional para o **médico regulador do SAMU/CRU** acompanhar
requisições de transporte inter-unidades em tempo quase real. Ingere
mensagens semi-estruturadas do WhatsApp vindas de ~17 unidades (UPAs, PAs,
hospital municipal), parseia automaticamente, e exibe num painel denso
agrupado por unidade de origem.

**Status atual:** Fase 0 concluída (monorepo + tokens visuais + esqueletos
de pacotes). Próxima fase: schema Drizzle, seed das unidades, parser
determinístico com fixtures reais. Consulte [`WORKLOG.md`](./WORKLOG.md)
para estado de execução; [`PLANNING.md`](./PLANNING.md) é o contrato
arquitetural.

## Stack

| Camada | Tecnologia | Versão | Onde mora |
|---|---|---|---|
| Runtime | Node | 25 (`.nvmrc`) — `engines: >=22` para EC2 | root |
| Pacotes | pnpm workspaces | 10.33 | `pnpm-workspace.yaml` |
| Banco | PostgreSQL | 18 (Homebrew local) | `samu_cru_dev` |
| ORM | Drizzle + postgres-js | 0.36 / 3.4 | `packages/db` |
| Web | Next.js (App Router) + React 19 | 15.1 | `apps/web` |
| Estilos | Tailwind v4 (CSS-first via `@theme`) | 4.0 | `apps/web/src/app/globals.css` |
| UI primitives | shadcn/ui (new-york, baseColor zinc) | latest | `apps/web/src/components/ui` |
| Ícones / motion | Lucide React, Framer Motion | latest | `apps/web` |
| Worker | Baileys (Phase 3) | — | `apps/ingest` |
| Parser | regex/determinístico puro (Phase 1) | — | `packages/parser` |

## Workspaces

| Workspace | Responsabilidade |
|---|---|
| `apps/web` | UI Next.js. Painel, modal de detalhes, fila de revisão. |
| `apps/ingest` | Worker Baileys que consome WhatsApp, chama o parser, insere no DB (Phase 3). |
| `packages/shared` | Enums, types, status meta, seed de unidades. Fonte única para toda a taxonomia. |
| `packages/db` | Cliente Drizzle, schema, migrations, queries. |
| `packages/parser` | Parser determinístico das mensagens (Phase 1). |

## Como rodar (do zero)

```bash
# 1. Clone e instala dependências
git clone git@github.com:caiooliveirac/Transportes-samu.git
cd Transportes-samu
nvm use            # carrega Node 25 (cai pra >=22 se 25 não tiver)
pnpm install

# 2. Postgres local (Homebrew) — uma vez na vida da máquina
brew services start postgresql@18
pnpm setup:db      # cria role samu_cru + db samu_cru_dev (idempotente)

# 3. Envs
cp .env.example .env.local

# 4. Sanity check de toda a cadeia
pnpm lint
pnpm typecheck
pnpm build

# 5. Sobe o dev server
pnpm dev           # http://localhost:3000

# Em outra aba (Phase 3 em diante):
pnpm dev:ingest    # placeholder por enquanto

# Drizzle (Phase 1 em diante):
pnpm db:generate   # gera migrations a partir do schema
pnpm db:migrate    # aplica migrations no DB local
pnpm db:studio     # GUI do drizzle-kit
```

## Decisões arquiteturais resumidas

Detalhe completo em [`PLANNING.md`](./PLANNING.md). Pontos que afetam dev
diário:

1. **Monorepo pnpm com 2 apps + 3 packages.** Web e ingest são processos
   separados desde já (PLANNING §4) para que reload de UI não derrube
   a sessão WhatsApp em produção.
2. **Sem Docker em dev.** Postgres via Homebrew, Node nativo. Em EC2
   o padrão é PM2 + self-hosted GitHub Actions runner (ver
   `caiooliveirac/plantoes` como referência de gold standard).
3. **Polling + SSE leve, não WebSocket** (PLANNING §9).
4. **Parser determinístico no MVP.** LLM como fallback pós-MVP, e
   apenas com PII desidentificada (LGPD).
5. **Tailwind v4 CSS-first via `@theme`.** Sem `tailwind.config.ts`
   (deviação documentada do PLANNING §5 — Tailwind v4 não usa JS
   config).
6. **Mensagem WhatsApp original é fonte de verdade auditável**, nunca
   deletada. Editada pelo usuário no WhatsApp → re-parse com preservação
   de edições manuais.
7. **CPF/CNS mascarado por padrão**, revelar gera evento de auditoria.

## Design

A UI foi prototipada em alta fidelidade pelo Claude Design. Detalhes,
mapeamento de tokens e correspondência arquivo→componente em
[`DESIGN.md`](./DESIGN.md). Bundle bruto preservado em `design-refs/`
(read-only — não edite).

**Cores semânticas de status:** 11 status do PLANNING §11, com
metadados de classes Tailwind em `@samu-cru/shared` → `STATUS`. Use
sempre o mapping de lá, nunca strings inline.

## Deploy

Produção em `transportes.mnrs.com.br` (EC2, Phase 6). Padrão a seguir:
[`caiooliveirac/plantoes`](https://github.com/caiooliveirac/plantoes) —
self-hosted GitHub Actions runner (o runner É a EC2, sem SSH), PM2 com
reload `--update-env`, health-check público antes de marcar verde.

## Troubleshooting

**`pnpm setup:db` falha com "Postgres not running":**
```bash
brew services start postgresql@18
brew services list   # confirma started
```

**Porta 3000 ocupada (dev server):**
```bash
lsof -ti:3000 | xargs kill -9
```

**Tipos de `@samu-cru/shared` não atualizam no editor:**
- A maioria das IDEs precisa de uma reload do TypeScript Server depois
  de tocar `packages/shared/src/*`. No VS Code: `Cmd+Shift+P` →
  "TypeScript: Restart TS Server".

**Drizzle reclama de `DATABASE_URL`:**
```bash
cp .env.example .env.local
# edite .env.local se necessário
```

**Sessão Baileys perdida (Phase 3+):**
- A pasta `apps/ingest/auth/` é gitignored. Backup criptografado é
  responsabilidade do operador. Se perder, vai precisar re-escanear o
  QR no boot do worker.

## Para o próximo agente / colaborador

Se você está pegando este projeto sem contexto:

1. Leia [`WORKLOG.md`](./WORKLOG.md) — diz exatamente onde a execução
   parou e qual o próximo passo concreto.
2. Leia [`PLANNING.md`](./PLANNING.md) — é o contrato arquitetural.
   §15 tem a ordem das fases.
3. Leia [`DESIGN.md`](./DESIGN.md) e os screenshots em
   `design-refs/dashboard-de-transportes-samu-cru/project/screenshots/`.
4. `pnpm install && pnpm setup:db && pnpm dev` e abra
   `http://localhost:3000` — deve ver placeholder dark mode com 4
   status pills e a escala ink.
