# WORKLOG — Transportes SAMU/CRU

> Estado de execução para retomada por novo agente após `/clear` ou queda
> de sessão. Atualizado a cada commit relevante.

**Última atualização:** 2026-07-13 · Intercorrências / rastreio de gargalos de tempo

---

## Resume here

**Fase 8 — Intercorrências e demoras (rastreio de gargalos).**

Objetivo: gerar dados sobre por que transportes demoram. Aprovado pelo
usuário em 2026-07-13; taxonomia de 27 motivos agrupados por fase do
ciclo (regulação/clínica/origem/trajeto/destino/retorno/outro).

- `packages/shared/src/delays.ts` — DELAY_REASON (fonte única),
  DELAY_REASON_META (labels dos chips), DELAY_REASONS_BY_PHASE
- DB: enum `delay_reason`, tabela `transport_delays` (unique
  transport_id+reason → toggle idempotente), coluna
  `transport_requests.delay_report` (relato livre do encerramento).
  Migration `0006_cuddly_black_widow.sql`
- Queries: `addTransportDelay`/`removeTransportDelay` (toggle em tempo
  real, gera transport_events `delay_added`/`delay_removed` pra timeline)
  e `finalizeTransportDelays` (consolidação transacional no encerramento
  com impactMinutes + report)
- API: POST/DELETE/PUT `/api/transports/[id]/delays`
- UI: `delay-control.tsx` — `DelaySection` no detail-sheet (chips
  colapsados atrás de "Registrar intercorrência", mobile-first) e
  `ClosureDialog` (interceptação do status "concluido" no
  ProgressControl: pergunta "houve demora?", pré-seleciona o que foi
  marcado durante o caso, minutos facultativos por motivo + relato livre).
  ClosureDialog renderiza via createPortal(body) — o SheetContent tem
  transform e quebraria o position:fixed
- Painel de compilação/estatísticas fica pra fase seguinte (dados já
  ficam prontos pra agregar por motivo/fase/unidade)
- Pendência conhecida (pré-existente, não deste diff): dashboard tem
  min-width ~484px e corta em viewport 375px — task sugerida à parte

## Fase 7 (anterior)

**Pivot arquitetural — desativa Baileys, adota form web direto.**

Motivo: o worker Baileys entrava em loop de reconexão por competir
sessão WhatsApp com outras apps no EC2 e derrubava o host (502 em prod).
Usuário pediu adaptar a aplicação para ter form próprio com cards e
paleta moderna do plantoes/giro-de-leitos.

**PRs abertos:**
- **#23** `fix/emergency-disable-ingest` — tira `transportes-ingest` do
  PM2, deleta WorkerBadge/useWorkerStatus/api/health/worker. **MERGE
  PRIMEIRO** pra site voltar do 502.
- **#?** `feat/web-request-form` — pivot completo (DB + auth + form +
  histórico + admin). Documentado abaixo.

**Próxima ação após merge dos dois PRs:**
```bash
# No EC2 (ou via deploy auto):
pnpm db:seed:credentials        # cria credenciais das 17 unidades
                                 # — imprime tabela [unidade | login | senha]
                                 # — anote e distribua manualmente
# .env.production precisa ter AUTH_SECRET (>=32 chars) e ADMIN_PASSWORD
```

`apps/ingest/` continua no repo mas **dormente** — código preservado
caso volte com número WhatsApp dedicado no futuro.

## Fase 7 — Web request form (`feat/web-request-form`)

Substitui WhatsApp ingest pelo form web por unidade. Critérios de pronto:

### DB
- [x] Schema: `unit_credentials` (1 por unidade, password hash scrypt) +
  `transport_requests.source` ('whatsapp' | 'web_form' | 'manual') +
  `transport_requests.created_by_unit_id` FK
- [x] Migration `0003_web_request_form.sql` gerada via drizzle-kit
- [x] `seed-credentials.ts` idempotente — cria as que faltam, imprime
  senhas em claro. `--rotate` força nova senha pra todas
- [x] Queries: `findCredentialByUsername`, `listCredentialsWithUnits`,
  `upsertCredential`, `rotateCredential`, `touchLastLogin`,
  `insertTransportFromWebForm`, `cancelTransportByCreator`,
  `listTransportsByCreatedByUnit`
- [x] `hashPassword/verifyPassword` (scrypt em node:crypto, zero deps)
- [x] `generateReadablePassword` — 4 grupos de 3 chars sem ambíguos

### Auth (jose JWT em cookie httpOnly)
- [x] `lib/auth/session.ts` — sign/verify HS256, 12h TTL, edge-compatível
- [x] `lib/auth/server.ts` — `getSession`/`requireUnitSession`/`requireAdminSession`
- [x] `middleware.ts` — protege `/solicitar/*`, `/api/solicitar/*`
  (sessão unit) e `/`, `/admin/*`, `/api/admin/*`, `/api/transports/*`,
  `/api/stream` (sessão admin). APIs respondem 401 JSON; UI redireciona
  pra `/login?next=...`
- [x] `POST /api/auth/login` — discriminated union: `kind: unit`
  (username+password) ou `kind: admin` (apenas password). `ADMIN_PASSWORD`
  via env. timingSafeEqual pra senha admin
- [x] `POST /api/auth/logout`

### Rotas (RSC + client form)
- [x] `/login` — tabs Unidade / Regulador-Admin, paleta plantoes
- [x] `/solicitar` — form completo com paciente / destino / procedimento /
  prazo / tipo / clínica (diagnoses + vitals opcionais) / observações
- [x] `/solicitar/minhas` — cards do histórico com filtros (ativas /
  concluídas / canceladas / todas), borda lateral colorida por status,
  fade nos terminais, line-through em cancelados, botão "Cancelar" só
  pra não-terminais
- [x] `/admin` — tabela de unidades × credenciais. "Rotacionar senha"
  mostra a senha em claro 1x, com botão copiar. Último login por unidade
- [x] `POST /api/solicitar` — zod validate, insere com source='web_form'
- [x] `POST /api/solicitar/[id]/cancel` — só o criador, só não-terminal
- [x] `POST /api/admin/credentials/[unitId]/rotate` — gera + retorna senha

### Design / paleta
- [x] Tokens do plantoes/app/globals.css importados em `@theme`:
  `--color-warm-bg`, `--color-warm-bg-deep`, `--color-ice`, `--color-gold`,
  `--color-warm-green`, `--color-warm-amber`, `--color-warm-red`,
  `--color-accent-confirm/warn/fraud/info`
- [x] Classes utilitárias `.page-warm`, `.surface-glass`, `.surface-elevated`
  com gradientes radiais, grão SVG, glassmorphism

### Config
- [x] `.env.example` documenta `AUTH_SECRET` e `ADMIN_PASSWORD`
- [x] Root `db:seed:credentials` script
- [x] `jose`, `zod` adicionados a `apps/web`

### Pendências antes do deploy
- [ ] PR aberto e merged (após #23)
- [ ] No EC2: setar `AUTH_SECRET` e `ADMIN_PASSWORD` em `.env.production`
- [ ] No EC2: rodar `pnpm db:seed:credentials` e distribuir senhas

### Fora de escopo deste PR (futuras iterações)
- Edição de transporte pelo solicitante após criar (apenas cancelar)
- Anexos / fotos
- 2FA / link mágico
- Botão de logout no header do dashboard regulador (acessar via /api/auth/logout)
- Histórico do regulador filtrar por unidade solicitante

## Fase 0–6 (concluídas) — resumo

Fase 0 bootstrap (monorepo, Next 15, Drizzle, shadcn, Tailwind v4 CSS-first,
Node 25, Postgres 18) · Fase 1 (schema + parser 11 extractors, 93% cov) ·
Fase 2 (dashboard multi-coluna, SSE, sheet detalhes) · Fase 3 (worker
Baileys — desligado em prod a partir do PR #23) · Fase 6 (deploy

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
## Como atualizar este WORKLOG

A cada commit relevante:
1. Adicione linha à tabela "Commits desta Fase".
2. Marque critério de pronto se completo.
3. Atualize "Resume here" com a próxima ação concreta.
4. Se uma decisão não-trivial foi tomada, documente em "Decisões deliberadas".
5. Mantenha o arquivo curto (~200 linhas alvo). Quando uma fase termina,
   compacte para uma linha em "Resumo de fases anteriores".
