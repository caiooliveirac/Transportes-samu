# WORKLOG — Transportes SAMU/CRU

> Estado de execução para retomada por novo agente após `/clear` ou queda
> de sessão. Atualizado a cada commit relevante.

**Última atualização:** 2026-08-14 · No ar no magalu (PM2) + ingestão real via gateway whatsmeow

---

## Resume here

**Produção no magalu, de verdade.** Antes disso a app respondia em
`transportes.mnrs.com.br` por um **processo órfão**: um `next start --port
3020` solto desde 28/07, sem PM2, sem commit conhecido
(`/api/health` devolvia `runtime: dev`, `commit: unknown`). Era ele também
que impedia o PM2 de subir — `EADDRINUSE` em loop, 25 restarts.

- órfão morto; `transportes-web` e `transportes-ingest` sob PM2, `pm2 save`
  feito, `pm2-ubuntu` já enabled (sobrevive a reboot)
- health público agora casa com o commit publicado e diz `runtime: pm2`
- constantes de deploy corrigidas: `APP_DIR` era `/home/ubuntu/transportes-samu`
  (o checkout é `Transportes-samu`) e a porta era 3008 (o mapa central do
  nginx roteia **3020**). Com os valores antigos nada subiria
- runner self-hosted `transportes-ec2` estava offline desde a morte da EC2,
  travando todo CI. Registrado `magalu-transportes` no magalu (mesmo padrão
  de escala/nep/simulador) e removido o antigo. Push em main volta a
  deployar sozinho
- nginx: `location /api/stream` no mapa central com `proxy_buffering off` e
  `proxy_read_timeout 24h`. O `location /` tem 120s, que cortaria o SSE do
  dashboard a cada 2min. Backup em `~/nginx-backups/`, `nginx -t` ok,
  plantoes e escala revalidados em 200
- gateway `whatsmeow-gw` recriado com os DOIS webhooks
  (`:3081` giro, `:3082` transportes) + `WHATSAPP_WEBHOOK_SECRET`. Sessão
  preservada no volume, sem re-pareamento
- `ufw allow in on docker0 to any port 3082` — o `3081` do Giro já tinha a
  regra equivalente; sem ela o POST do gateway morre em
  `context deadline exceeded`

**Estado da ingestão: FUNCIONANDO.** Primeira mensagem real do UT APOIO
gravada em 2026-08-14 09:39. Fan-out provado com timestamp casando dos dois
lados no log do gateway e no `lastWebhookAt` do worker.

Proporção observada em produção: ~500 `message.ack` por hora contra ~34
`message`. O ack é ruído (responde 204, não conta em `received`). Quem
estiver lendo o log do `giro-wa-adapter` para diagnosticar: ele loga TODO
evento, inclusive ack, e ack aparece como `len=0` — isso não é mídia sem
legenda, é ack. Confundir os dois leva a concluir errado que o grupo manda
solicitação por print. `mediaOnly` no health é quem responde essa pergunta
de verdade (esteve em 0 o tempo todo).

**O worker rodou o dia inteiro em `DRY_RUN`.** Em 14/08 o corpus tinha 37
mensagens, 11 aprovadas pelo filtro e **zero transportes**. Não era limiar
nem parser: `/home/ubuntu/Transportes-samu/.env` trazia `DRY_RUN=true`, e
`apps/ingest/src/env.ts` carrega `.env` como fallback depois do
`.env.production` (que não tem a variável). O log dizia
`DRY_RUN parsed but NOT inserting transport` com confiança 0,40–0,90 —
o parser acertava e nada era gravado.

- corrigido no servidor: `DRY_RUN=false` no `.env` (backup `.env.bak-dryrun-*`),
  `pm2 restart transportes-ingest --update-env`
- `createTransportFromMessage` extraído de `ingestMessage` — parse+insert
  numa cópia só, usada também pelo backfill
- `pnpm ingest:backfill` recupera mensagem aprovada que ficou sem
  transporte. Simulação por padrão, `--aplicar` grava. Só age sobre
  `filterVerdict.pass === true`: barrada é corpus, não caso
- **backfill aplicado em 14/08 17:47**: as 11 solicitações do dia viraram
  transporte (1 `novo` com conf 0,86; 10 `pendente_revisao`, conf 0,40 a
  0,72). Nova rodada devolve "nada a recuperar". Duas mensagens de
  cancelamento circularam no grupo no mesmo dia (12:29 Alfredo Bureau e
  17:25 "cancelar OC 0534") — o parser não age sobre caso existente, então
  esses precisam ser cancelados na UI pelo regulador

**Os quatro templates do grupo.** Com os 11 casos na tabela deu para ver o
que o parser não entendia — e não era limiar: cada unidade tem seu
template, todos estáveis.

- rótulo sinônimo resolvido em `segment.ts` (`UNIDADE DE DESTINO` →
  `destino`, `DATA/HORÁRIO DA APRESENTAÇÃO` → `horario`, `RECURSO
  SOLICITADO` → `procedimento`), não em cada extractor
- **dois rótulos na mesma linha** (`DATA: 14/08/2026 HORÁRIO: IMEDIATO`)
  agora viram dois pares. Antes o segundo sumia e o valor do primeiro era
  a linha inteira — daí `2026  HORÁRIO` virar "hora 26" e o prazo cair
  como `invalid time`
- `DESTINATION_ACRONYMS` em `packages/shared`: `HSA` vira
  `HSA — Hospital Santo Antônio`. `HM`/`HG`/`HE` servem a mais de um
  hospital e ficam como estão, com aviso — chutar poria o paciente no
  lugar errado
- `IMEDIATO`/`IMEDIATA` passa a ser prazo = horário da mensagem (era o
  prazo de 10 dos 11 casos, e virava nada)
- procedimento em checkbox `( X ) INTERNAMENTO` e no formato
  `SUSPEITA // PROCEDIMENTO`; `NOME FULANO` sem dois-pontos; suspeita
  diagnóstica finalmente extraída (`SD:`, `SUSPEITA DIAGNÓSTICA:` e lista
  nas linhas abaixo)
- 4 fixtures novos, um por template, anonimizados. 56 testes no parser
- `ingest:backfill --reparse` re-roda o parser sobre caso já criado. Não
  mexe em status que o regulador moveu; só promove `pendente_revisao` →
  `novo`
- abreviação de exame (`RX`, `USG`, `ECO`, `ANGIO…`) passa a classificar
  ida-e-volta. Três casos do Hélio Machado com `RX DE TORAX` ficaram
  `trip_type: unknown` no primeiro re-parse — a viatura espera o paciente,
  e marcar errado tira uma da fila sem necessidade

Nota de segurança: ao inspecionar `/proc/<pid>/environ` o
`WA_WEBHOOK_SECRET` apareceu em terminal. Rotacionar no gateway e no
`.env.production` quando conveniente.

**A primeira mensagem real já expôs a decisão de produto pendente.** Ela foi
BARRADA pelo filtro (`not enough hints (2/3)`) e é sobre transporte — mas é
COBRANÇA de um caso existente ("paciente com risco de perder a vaga",
"alguma posição?"), não uma solicitação nova. Duas leituras, com
implementações opostas:

- filtro certo: não havia transporte a criar; baixar o limiar para 2 enche
  o painel de cobrança e conversa
- filtro cego: a urgência é o sinal operacional que o regulador quer ver, e
  hoje some

Nada foi ajustado — o usuário pediu para discutir o treinamento depois, e
n=1 de madrugada não sustenta mudança de limiar. Deixar o corpus acumular
antes de mexer em `pipeline/filter.ts`.

Checagem:

```bash
ssh magalu 'curl -s http://127.0.0.1:3082/ | jq'
ssh magalu 'cd /home/ubuntu/Transportes-samu && set -a && source .env.production && set +a && pnpm ingest:corpus 30'
```

**Dados falsos apagados** (2026-08-14, autorizado pelo usuário): 21
`transport_requests` + 5 `transport_events` + 17 `transport_delays`. Todos
eram mock — `whatsapp_message_id IS NULL` nos 21, nada tinha vindo do
WhatsApp. `units`, `users` e `unit_credentials` intactos. Backup em
`~/backups-adhoc/transportes-pre-limpeza-mock-20260814-052158.sql.gz`.

**Corpus de treinamento:** o worker passou a gravar TODA mensagem do grupo
vigiado, inclusive a que o filtro rejeita (veredito em
`raw_json.filterVerdict`), porque é a mensagem barrada que mostra onde o
filtro erra. `pnpm ingest:corpus` lê com veredito e confiança lado a lado.
Material para decidir o ajuste de filtro/parser — a discussão ainda não
aconteceu.

**Login:** a sessão que existia desde julho era do processo órfão; ao matá-lo,
todo cookie caiu. As contas estão intactas (hash scrypt de 15/07, nenhuma
tocada). Só `caio.oliveira` foi rotacionada, para reentrar como admin — as
outras se rotacionam pela UI de `/admin`.

## Fase 10 — ingestão via gateway whatsmeow

**Ingestão real — worker passa a consumir o gateway whatsmeow compartilhado.**

O app rodava só com dados fictícios (`db:seed:mock`) porque o worker
Baileys estava desligado desde o PR #23: ele abria sessão própria no
**mesmo número** do chefe de plantão (557197150415) que o Giro de Leitos
já usava, os dois disputavam slot de Linked Device e viviam em loop de
reconexão (diagnóstico em `giro-de-leitos/docs/baileys-isolamento-2026-05-25.md`).

Causa raiz resolvida trocando o transporte, não remendando a reconexão:
o magalu já roda `whatsmeow-gw` (`go-whatsapp-web-multidevice`,
`127.0.0.1:3080`) como **dono único** da sessão, e o gateway aceita uma
**lista** de webhooks (`--webhook strings`). O Giro consome pelo
`giro-wa-adapter` (:3081); o transportes vira o segundo destino (:3082).

- `apps/ingest/src/webhook/payload.ts` — normaliza o envelope do gateway
  (`{event, device_id, payload}`) e verifica o HMAC
  `X-Hub-Signature-256`. Contrato conferido no fonte upstream
  (`event_message.go`), não adivinhado
- `apps/ingest/src/webhook/server.ts` — servidor HTTP; reusa
  `pipeline/filter` + `pipeline/dedupe` + `pipeline/ingest` intactos.
  Responde 2xx só depois de ingerir (erro = 500 → gateway reenvia 5x;
  `wa_message_id` UNIQUE torna o retry inofensivo)
- `apps/ingest/src/index.ts` reescrito; `src/whatsapp/` e
  `src/scripts/list-groups.ts` deletados; Baileys e qrcode-terminal
  fora do `package.json`
- Env: `WA_WEBHOOK_PORT`, `WA_WEBHOOK_SECRET` substituem `WA_SESSION_DIR`.
  `WA_ALLOWED_CHATS=557181082189-1589997108@g.us` (grupo **UT APOIO** —
  confirmado com o usuário; não existe grupo chamado "TRANSPORTES" na
  conta do chefe)
- `transportes-ingest` volta ao `ecosystem.config.cjs`; o
  `pm2 delete transportes-ingest` do `deploy-production.sh` saiu
- 8 testes em `apps/ingest/__tests__/payload.test.ts`; typecheck e lint ok

Duas correções vieram depois, achadas em produção:
- `GET /` do worker ganhou contadores (`received`/`ingested`/`skipped`/
  `rejected`/`lastWebhookAt`) — em `LOG_LEVEL=info` um worker que recebe e
  filtra tudo era indistinguível de um que não recebe nada
- o bind era `127.0.0.1`, inalcançável pelo container do gateway (que chega
  pelo host-gateway, 172.17.0.1). `WA_WEBHOOK_HOST` default `0.0.0.0`, e o
  worker recusa subir com bind não-loopback e segredo vazio

## Fase 9 (anterior)

**Fix — dashboard utilizável em 375px (sem scroll horizontal).**

Causa raiz: linha única do header (marca + busca w-44 + Novo + LiveBadge
+ Admin + Sair, sem wrap) somava ~490px e expandia o viewport; elementos
fixed herdavam essa largura e apareciam cortados.

- `header.tsx`: container com `flex-wrap`; bloco pills+busca vira segunda
  linha no mobile (`order-last w-full`, pills com overflow-x sem
  scrollbar, busca full-width) e volta ao lugar original no `sm+`; "Novo"
  (desabilitado, Fase 4) oculto no mobile; "Admin" vira só ícone no mobile
- `dashboard-shell.tsx`: GRID `grid-cols-1` no mobile (empilha unidades),
  `auto-fill minmax(300px,1fr)` a partir de `sm`; subtítulo "unidades sem
  ambulância própria" da faixa Prioridade oculto no mobile (cada card já
  repete a info)
- `ui/sheet.tsx`: variantes right/left `w-full` no mobile, `sm:w-3/4`
  (mantém max-w-[480px])
- Verificado no browser em 375×812 logado: scrollWidth=clientWidth=375,
  header em 2 linhas, sheet de detalhe full-width íntegro; desktop 1280
  inalterado. typecheck + lint ok.

## Fase 8 (anterior)

**Intercorrências e demoras (rastreio de gargalos).**

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
  min-width ~484px e corta em viewport 375px — RESOLVIDA no fix acima

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
