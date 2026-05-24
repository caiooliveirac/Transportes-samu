# WORKLOG — Transportes SAMU/CRU

> Estado de execução para retomada por novo agente após `/clear` ou queda
> de sessão. Atualizado a cada commit relevante.

**Última atualização:** 2026-05-24 · Fase 0 (Setup do monorepo) — em verificação final

---

## Resume here

A próxima ação concreta é **rodar a bateria de verificação local e fazer push
inicial pro GitHub**:

```bash
cd /Users/caiooliveirac/Projetos/TransportesSAMU
pnpm install
pnpm setup:db                      # cria role + db local
cp .env.example .env.local
pnpm lint && pnpm typecheck && pnpm build
gh repo create caiooliveirac/Transportes-samu --private --source=. --remote=origin --push
```

Depois de tudo verde:
1. Abrir issue "Fase 0 — Setup do monorepo" via `gh issue create`, com
   checklist espelhando os critérios de pronto (abaixo).
2. Fechar a issue via commit `docs: close phase 0 — Closes #1`
3. Perguntar ao Caio se inicia Fase 1.

Se `pnpm install` falhar pelo `engines` mismatch e o ambiente estiver em
Node < 22, instale via nvm (`nvm install 25 && nvm use 25`).

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
- [ ] `pnpm install && pnpm lint && pnpm typecheck && pnpm build` passa limpo  ← próximo passo
- [ ] Repo no GitHub `caiooliveirac/Transportes-samu` (privado) criado e push de `main`
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
| 12 | (próximo) | docs: add README and WORKLOG with phase 0 status |

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
