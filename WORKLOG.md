# WORKLOG — Transportes SAMU/CRU

> Estado de execução para retomada por novo agente após `/clear` ou queda
> de sessão. Atualizado a cada commit relevante.

**Última atualização:** 2026-05-24 · Fase 2 (Dashboard read-only) — PR 3 (realtime) pronto pra push; PR 1+2 merged

---

## Resume here

Branch `feat/phase-2-realtime` com SSE `/api/stream` + hook
`useLiveDashboard` + LiveBadge no header — completa o ciclo da Fase 2.
Verificado end-to-end:

```bash
gtimeout 12 curl -sN http://localhost:3000/api/stream
# event: hello + event: tick a cada 5s ✓
# psql UPDATE → event: change em < 5s ✓
```

Próxima ação:

```bash
cd /Users/caiooliveirac/Projetos/TransportesSAMU
git push -u origin feat/phase-2-realtime
gh pr create ... # Closes #5
gh pr merge ... --merge --delete-branch
```

Após merge: **Fase 2 está fechada**. Próximo grande bloco é **Fase 3
(Baileys worker)** — primeiro clonar `caiooliveirac/giro-de-leitos` em
`/tmp` e estudar padrões de sessão/reconexão/handlers (PLANNING §12).

### Como o Caio testa este PR

```bash
pnpm install                # adiciona Radix Dialog/Tooltip + tw-animate-css
pnpm db:seed:mock           # se ainda não rodou; idempotente
pnpm dev                    # http://localhost:3000
```

Esperado em `/`:
- Header dark "SAMU/CRU · Transportes" + contagem "X ativos · N urgentes"
- 4 pills de filtro (Tudo / Hoje / Atrasados / Pendentes revisão)
- Busca com atalho `/` (foca o input ao apertar barra)
- Botão "+ Novo" disabled (Fase 4)
- Bola colorida do worker WhatsApp (cinza, Fase 3 liga)
- 10 colunas por unidade (UPA San Martin vazia intencionalmente)
- Cards 48-56px com borda lateral colorida por status
- Cards atrasados pulsam (animate-card-pulse) e mostram relógio ⏰ piscando
- Card cancelado riscado
- Concluído antigo fade
- Tooltip ao hover do card mostra "Maria S. · Status · em 22min"
- Clique em qualquer card abre Sheet 480px da direita com ROTA/CLÍNICA/HIPÓTESES/TIMELINE
- Botões [revelar]/[copiar] CNS
- "Mostrar texto bruto" expande mensagem WhatsApp original (apenas em Pirajá e Brotas, os 2 com WA real)
- Esc fecha Sheet

## Fase 2 — PR 1 (backend) — critérios de pronto

- [x] `seed-mock-transports.ts` idempotente, 22 transportes, 11 status, 2 whatsapp_messages
- [x] `pnpm db:seed:mock` no root (separado do `db:seed` de produção)
- [x] `listTransportsForDashboard()` retorna `{ units, transports, serverTime }` em uma chamada, com filtro de terminais antigos
- [x] `findTransportWithContext(id)` retorna `{ transport, whatsappMessage, events }` para o Sheet de detalhes da PR2
- [x] `apps/web/src/app/api/transports/route.ts` — `force-dynamic`, no-store, error handler
- [x] `next.config.ts` carrega `.env.local` da raiz do monorepo via dotenv (apps/web não roda na raiz)
- [x] `client.ts` agora é lazy (Proxy) — postgres pool só é criado na primeira query, desacoplando do build do Next
- [x] Smoke test live: 17 unidades, 22 transportes, 11/11 status, serverTime presente
- [ ] PR aberto e merged

## Fase 2 — PR 2 (UI) — critérios de pronto

- [x] Header global (logo, contagem viva, pills, busca com `/`, worker badge stub, +Novo disabled)
- [x] Grid multi-coluna por unidade com header sticky + barra de carga
- [x] Card compacto com borda lateral de status, ícone trip-type, tooltip privacy-safe
- [x] Estados: novo, em deslocamento, atrasado pulsando, concluído fade, cancelado riscado, pendente revisao com warnings
- [x] Sheet de detalhes (ROTA / CLÍNICA / HIPÓTESES / TIMELINE / Mensagem original colapsável)
- [x] CNS mascarado + [revelar]/[copiar]
- [x] Atalhos: `/` foca busca, `Esc` fecha Sheet
- [x] Mobile: básico funcional (responsive); polimento mobile fica para Fase 7
- [x] Gate verde (lint + typecheck + build + 52/52 testes)
- [x] Smoke E2E: home renderiza, /api/transports retorna 17+22, detail Sheet carrega vitals/diagnoses/mensagem WhatsApp original
- [ ] PR aberto e merged

## Fase 2 — PR 3 (real-time) — critérios de pronto

- [x] SSE `/api/stream` com eventos `hello` / `tick` / `change`. Detecção de mudança via `max(updated_at)` (Phase 3 troca por LISTEN/NOTIFY)
- [x] Hook `useLiveDashboard` consumido pelo `DashboardShell` — refetch automático em `change`, mantém `data` vivo
- [x] Fallback polling 10s quando SSE cai (`EventSource.CLOSED`)
- [x] `LiveBadge` no header: sse (verde pulsando) / polling (âmbar) / connecting (cinza) / offline (rose). Tooltip com idade do último evento
- [x] Tab visibility integration: refetch imediato ao voltar foco no tab
- [x] Smoke E2E: `event: change` emitido < 5s após UPDATE no DB
- [ ] PR aberto e merged
- [ ] Issue #5 fechada via `Closes #5`

## Fase 1 — PR 1 (DB) — critérios de pronto

- [x] Schema Drizzle: units, whatsapp_messages, transport_requests, transport_events, users
- [x] Enums (transport_status, trip_type, unit_type) derivados de `@samu-cru/shared`
- [x] Migration `0000_lovely_pete_wisdom.sql` gerada e aplica limpo em `samu_cru_dev`
- [x] Seed das 17 unidades idempotente (`pnpm db:seed`)
- [x] Queries tipadas: `listAllUnits`, `findUnitByCode`, `insertTransport`, `findTransportsByWhatsappMessage`, `findTransportById`, `listPendingReview`
- [x] `pnpm db:seed` no root
- [x] `loadMonorepoEnv` resolvido para drizzle-kit + migrate + seed funcionarem da raiz
- [x] lint + typecheck + build verde
- [ ] PR aberto e merged

## Fase 1 — PR 2 (parser) — critérios de pronto

- [x] `normalize.ts`, `segment.ts`, `confidence.ts`
- [x] 11 extractors (name/age/birthDate/cns/cpf/origin/destination/procedure/timeText/deadline/procedureDate/vitals/diagnoses) + `inferTripType`
- [x] 10 fixtures totais (2 prévios + 8 novos) com `.expected.json`
- [x] Vitest + `@vitest/coverage-v8` — 93.55% stmt, 90.81% branch, 100% fn (acima dos thresholds 80/80/80/70)
- [x] CLI `pnpm parser:test <arquivo>` com output colorido
- [x] Gate verde (lint + typecheck + build + 52/52 testes)
- [ ] PR aberto e merged
- [ ] Issue #2 fechada via `Closes #2`

## Fase 0 — critérios de pronto (PLANNING §15)

- [x] `git init` + primeiro commit com `.gitignore` completo
- [x] Monorepo pnpm com workspaces (`apps/web`, `apps/ingest`, `packages/db`, `packages/parser`, `packages/shared`)
- [x] TypeScript strict + `noUncheckedIndexedAccess`, tsconfig.base + project references
- [x] ESLint flat config + Prettier funcionando
- [x] `apps/web` com Next.js 15 + Tailwind v4 + shadcn/ui (Button, Badge) + fontes Inter / JetBrains Mono via `next/font`
- [x] Tokens de design (ink-0..400, status colors via `@samu-cru/shared`, keyframes) em `globals.css` via `@theme`
- [x] `packages/db` com Drizzle + postgres-js client e schema vazio (Fase 1 preenche)
- [x] `packages/parser` esqueleto com 2 fixtures reais extraídos do design (T-1001 e T-1011)
- [x] `packages/shared` com STATUS, UNITS (17), DESTINOS, types, constants
- [x] PLANNING.md, DESIGN.md e `design-refs/` commitados
- [x] `.env.example` versionado, `.env.local` no .gitignore, `auth/` gitignored
- [x] `scripts/setup-db.sh` idempotente
- [x] Scripts raiz: `dev`, `build`, `lint`, `typecheck`, `format`, `db:*`, `setup:db`
- [x] README "retomada por IA"
- [x] `pnpm install && pnpm lint && pnpm typecheck && pnpm build` passa limpo
- [ ] Repo no GitHub `caiooliveirac/Transportes-samu` (privado) criado e push de `main`  ← próximo passo
- [ ] Issue do milestone aberta no GitHub e fechada via commit

## Commits da Fase 0 (cronológico)

| # | Hash | Subject |
|---|---|---|
| 1 | `f434436` | chore: initialize project with gitignore, nvmrc, editor config |
| 2 | `9ecdfb5` | chore: bootstrap pnpm workspace and tsconfig base |
| 3 | `89e6804` | chore: add eslint flat config and prettier |
| 4 | `c4cecaf` | docs: import architectural planning and design references |
| 5 | `b9bdd37` | feat(shared): scaffold @samu-cru/shared with status, units, destinos taxonomy |
| 6 | `23dc6d0` | feat(parser): scaffold @samu-cru/parser with fixtures from design mocks |
| 7 | `3f0617a` | feat(db): scaffold @samu-cru/db with drizzle client and empty schema |
| 8 | `791feb4` | feat(web): bootstrap next.js 15 with tailwind v4 and design tokens |
| 9 | `cd32877` | feat(web): init shadcn/ui and render token-driven placeholder home |
| 10 | `eba060a` | feat(ingest): scaffold apps/ingest worker placeholder |
| 11 | `f7d70e4` | chore: add env.example, db setup script, and root npm scripts wiring |
| 12 | `1a52b17` | docs: add README and WORKLOG with phase 0 status |
| 13 | `5522b70` | fix: simplify TS resolution and unblock lint/build |
| 14 | `7a63edd` | chore: add pnpm lockfile |
| 15 | `946b06b` | docs: close phase 0 — Closes #1 |

### Fase 1 — PR 1 (`feat/phase-1-db-schema`) — merged via `5fce97b`

| # | Hash | Subject |
|---|---|---|
| 1 | `aee014d` | feat(db): add drizzle schema and 0000 migration |
| 2 | `d03caeb` | feat(db): add idempotent unit seed script |
| 3 | `0f6eec7` | feat(db): add typed query helpers for units and transports |

### Fase 1 — PR 2 (`feat/phase-1-parser`) — merged via `7df7226`

| # | Hash | Subject |
|---|---|---|
| 1 | `2d49481` | feat(parser): implement deterministic pipeline — normalize, segment, 11 extractors, scoring |
| 2 | `ab24b2a` | test(parser): add 10 fixtures with declarative expected.json |
| 3 | `14702d0` | feat(parser): add vitest suite, CLI, and fix regex bugs surfaced by fixtures |

### Fase 2 — PR 1 (`feat/phase-2-mock-seed-and-api`) — merged via `76c32fe`

| # | Hash | Subject |
|---|---|---|
| 1 | `60258fc` | feat(db): add idempotent mock transport seed for dashboard dev |
| 2 | `2581391` | feat(db): add dashboard query and lazy client init |
| 3 | `b16e49f` | feat(web): add GET /api/transports and load .env.local from monorepo root |
| 4 | `86e348a` | docs(worklog): record phase 2 PR 1 (backend) progress |

### Fase 2 — PR 2 (`feat/phase-2-dashboard-ui`) — merged via `cf252e4`

| # | Hash | Subject |
|---|---|---|
| 1 | `6def045` | chore(web): teach tailwind v4 to scan @samu-cru/shared |
| 2 | `e566a60` | feat(web): add shadcn Sheet, Tooltip + tw-animate-css |
| 3 | `1d9dff3` | feat(web): add format/urgency helpers and StatusPill + EmptyState |
| 4 | `e845ea7` | feat(web): add TransportCard and UnitColumn components |
| 5 | `42a4353` | feat(web): add dashboard Header and DashboardShell with filter/search state |
| 6 | `c89137d` | feat(web): add DetailSheet with ROTA, CLÍNICA, HIPÓTESES, TIMELINE, mensagem original |
| 7 | `04143f1` | feat(web): wire dashboard page and GET /api/transports/[id] |

### Fase 2 — PR 3 (`feat/phase-2-realtime`)

| # | Hash | Subject |
|---|---|---|
| 1 | `916eb69` | feat(web): add SSE /api/stream endpoint with hello/tick/change events |
| 2 | `d7c3113` | feat(web): add useLiveDashboard hook (SSE + polling fallback) |
| 3 | `efe6616` | feat(web): wire live updates via SSE + polling fallback, replace stub dot |

## Decisões deliberadas desta fase

1. **Tailwind v4 CSS-first em vez de `tailwind.config.ts`.** PLANNING §5
   sugere config TS — Tailwind 4 não usa mais. Tokens via `@theme` em
   `globals.css`. Documentado no commit 8.
2. **Node 25 fixado em `.nvmrc`, `engines: >=22` no `package.json` raiz.**
   Usuário confirmou Node 25 local + EC2 tem Node 24 (ver
   `checagemdebases/.nvmrc`). Engine permissivo evita travar build em
   futuras versões.
3. **Nome do repo: `Transportes-samu` (não `samu-cru-dashboard` que aparece
   no PLANNING).** Usuário confirmou.
4. **shadcn com `cssVariables: false` + `baseColor: zinc`.** Evita conflito
   com os tokens `ink-*` que já existem em `@theme`. Mantém shadcn
   utilities consistentes com a paleta neutra do design.
5. **`packages/shared` é a fonte única da taxonomia.** STATUS (com classes
   Tailwind por status), UNITS (17 com aliases para fuzzy matching),
   DESTINOS, types, constants. Drizzle vai derivar pgEnum a partir das
   tuplas literais aqui — single source of truth.
6. **`moduleResolution: Bundler` no `tsconfig.base.json`, sem composite/
   project references.** Forçar `.js` em imports (`NodeNext`) funciona em
   TS mas quebra `next build` no webpack. `Bundler` aceita imports
   extensionless e funciona com tsx + Next + qualquer futuro bundler. O
   pnpm workspace já resolve `@samu-cru/*` via symlink — não precisa de
   composite/references. Documentado no commit `fix: simplify TS resolution
   and unblock lint/build` (5522b70).
7. **Sem `eslint-config-next` na flat config.** Next 15 emite warning
   "plugin not detected" no `next build` mas não é erro. Integração da
   eslint-config-next com flat config v9 ainda é desajeitada — entra como
   melhoria opcional em fase posterior se quisermos as regras
   next-específicas.

## Próximas fases (PLANNING §15)

- **Fase 1** (2 dias): Schema Drizzle, migrations, seed das 17 unidades,
  parser com extratores (>=80% coverage), CLI `pnpm parser:test <arquivo>`.
- **Fase 2** (2 dias): Tela principal multi-coluna por unidade, cards
  compactos, polling/SSE, modal de detalhes, filtros, busca. Usa dados
  mock primeiro, depois reais.
- **Fase 3** (1-2 dias): Worker Baileys com pareamento QR, whitelist,
  ingestão → parser → banco, heartbeat. **Antes:** clonar
  `caiooliveirac/giro-de-leitos` e estudar sessão/reconexão/handlers.
- **Fase 4** (1 dia): Mudança de status manual, fila de revisão, edição
  manual, "criar manualmente", timeline de eventos.
- **Fase 5** (1 dia): NextAuth Credentials, middleware, mascaramento PII,
  auditoria.
- **Fase 6** (1 dia): GH Actions self-hosted (pattern `plantoes`), Caddy
  ou Nginx, PM2, `transportes.mnrs.com.br`, backup automatizado.
- **Fase 7** (contínuo): polimento, atalhos, animações, mobile fine-tune,
  métricas.

## Pendências / decisões adiadas

- **Workflow GitHub Actions.** Não criado na Fase 0 — entra na Fase 6.
  Quando for, reusar pattern de `caiooliveirac/plantoes/.github/workflows/deploy.yml`
  (self-hosted runner).
- **Drizzle schema completo.** Esqueleto está no commit 7. Fase 1 preenche
  com `units`, `whatsapp_messages`, `transport_requests`, `transport_events`,
  `users` (PLANNING §6).
- **Tabelas seed das 17 unidades.** `UNITS` já existe em
  `packages/shared/src/units.ts` mas precisa virar `seed.ts` em
  `packages/db` na Fase 1.
- **Provisionamento EC2.** Postgres 18 em prod precisa ser validado —
  pode subir RDS ou self-hosted. Decisão na Fase 6.

## Como atualizar este WORKLOG

A cada commit relevante:
1. Adicione linha à tabela "Commits desta Fase".
2. Marque critério de pronto se completo.
3. Atualize "Resume here" com a próxima ação concreta.
4. Se uma decisão não-trivial foi tomada, documente em "Decisões deliberadas".
5. Mantenha o arquivo curto (~200 linhas alvo). Quando uma fase termina,
   compacte para uma linha em "Resumo de fases anteriores".
