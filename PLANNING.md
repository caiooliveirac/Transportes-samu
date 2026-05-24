# Dashboard de Transportes — SAMU / CRU
## Planejamento Arquitetural Completo

---

## 1. Resumo do Produto

**Dashboard de Transportes SAMU/CRU** é um painel operacional em tempo quase real para o médico regulador acompanhar requisições de apoio inter-unidades vindas da Central Estadual de Regulação. O sistema ingere mensagens semi-estruturadas do WhatsApp (atualmente o canal de fato), as transforma em registros estruturados, e as exibe num painel denso-mas-limpo agrupado por unidade de origem, com modal de detalhes sob demanda.

**Proposta de valor central:** substituir a memória do regulador e o scroll infinito no WhatsApp por uma fonte única de verdade visual, auditável e compartilhável entre plantões.

**Não-objetivos do MVP:** despacho de viaturas, integração com sistemas estaduais, prontuário, faturamento, app móvel nativo. O sistema é *read-mostly* com edição manual leve.

---

## 2. Hipótese de MVP

**Hipótese:** se o regulador tiver uma tela única que mostre todos os transportes pendentes/em curso por unidade, com horário-limite e tipo de transporte visíveis sem clique, ele economiza tempo significativo de busca no WhatsApp e reduz erros de esquecimento de transporte.

**MVP enxuto (entregável em ~3 semanas de trabalho focado):**

1. Ingestão Baileys → parser determinístico → banco
2. Tela única com cards compactos agrupados por unidade
3. Modal de detalhes com mensagem original
4. Mudança manual de status (dropdown ou botões rápidos)
5. Fila de "pendente de revisão" para mensagens com baixa confiança de parsing
6. Autenticação simples (1 perfil: regulador)
7. Deploy em EC2 com HTTPS

**Fora do MVP, mas planejado:** múltiplos perfis, métricas/relatórios, alertas sonoros, integração com mapa, fallback LLM para parsing, edição inline de campos.

---

## 3. Fluxo Operacional Ponta a Ponta

```
[WhatsApp do chefe de plantão]
        │
        ▼
[Worker Baileys] ──── sessão isolada (auth dir próprio)
        │
        ├─ filtra mensagens de grupos/contatos relevantes
        ├─ deduplica por messageId
        ▼
[Parser determinístico]
        │
        ├─ alta confiança ─────► [TransportRequest: status=novo]
        └─ baixa confiança ────► [TransportRequest: status=pendente_revisao]
        │
        ▼
[Postgres] ─── source of truth, mensagem original preservada
        │
        ▼
[API Next.js: /api/transports + SSE/polling]
        │
        ▼
[Dashboard React] ─── agrupado por unidade, cards compactos
        │
        ├─ clique em card ──► modal com detalhes completos
        ├─ ação rápida ─────► PATCH status
        └─ pendente revisão ─► tela de revisão com campos editáveis
        │
        ▼
[TransportEvent: log de cada mudança] ─── auditoria
```

**Fluxo de exceção:** mensagem editada no WhatsApp → Baileys recebe evento de update → parser reexecuta → se já existe registro com mesmo messageId, faz UPDATE preservando histórico em `transport_events`.

---

## 4. Arquitetura Recomendada

**Decisão: monorepo com dois processos, banco compartilhado.**

```
┌─────────────────────────────────────────────────────┐
│  Monorepo (pnpm workspaces)                         │
│                                                     │
│  ┌──────────────┐    ┌──────────────┐              │
│  │  apps/web    │    │ apps/ingest  │              │
│  │  Next.js 15  │    │ Node worker  │              │
│  │  App Router  │    │ Baileys      │              │
│  └──────┬───────┘    └──────┬───────┘              │
│         │                   │                       │
│         └─────┬─────────────┘                       │
│               ▼                                     │
│      ┌─────────────────┐                            │
│      │ packages/db     │  Drizzle schema + client   │
│      │ packages/parser │  Parser puro testável      │
│      │ packages/shared │  tipos, enums, utils       │
│      └─────────────────┘                            │
└─────────────────────────────────────────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │   PostgreSQL    │
         └─────────────────┘
```

**Por quê separar `apps/ingest` de `apps/web`:**

- Baileys é stateful (sessão WhatsApp persistente, reconexão, QR code). Se cair junto com o web, derruba ingestão.
- Reload de código do Next.js em dev não pode reiniciar a sessão WhatsApp (re-scan QR é doloroso).
- Em produção, processos separados no PM2/systemd permitem reiniciar a UI sem perder a conexão WhatsApp.
- Permite testar o parser sem subir o Next.

**Comunicação:** apenas via Postgres. Sem fila, sem Redis, sem HTTP entre eles no MVP. O worker faz `INSERT` direto via `packages/db`. A UI faz polling (5-10s) ou SSE leve. **Não use websocket no MVP** — polling é mais simples, mais resiliente, e suficiente para a cardinalidade (16 unidades × poucas dezenas de transportes/dia).

**Sem Docker no dev:** Postgres local via Homebrew (`brew install postgresql@16`), Node nativo. Docker apenas para a produção se quiser (mas EC2 com PM2 + Postgres gerenciado ou Postgres na própria instância também serve).

---

## 5. Estrutura de Pastas Sugerida

```
samu-cru-dashboard/
├── apps/
│   ├── web/                          # Next.js
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/login/
│   │   │   │   ├── (dashboard)/
│   │   │   │   │   ├── page.tsx                # Painel principal
│   │   │   │   │   ├── revisao/page.tsx        # Fila de pendentes
│   │   │   │   │   └── transporte/[id]/        # rota opcional
│   │   │   │   ├── api/
│   │   │   │   │   ├── transports/route.ts
│   │   │   │   │   ├── transports/[id]/route.ts
│   │   │   │   │   ├── transports/[id]/status/route.ts
│   │   │   │   │   ├── stream/route.ts         # SSE
│   │   │   │   │   └── auth/[...nextauth]/
│   │   │   │   └── layout.tsx
│   │   │   ├── components/
│   │   │   │   ├── transport-card.tsx
│   │   │   │   ├── transport-modal.tsx
│   │   │   │   ├── unit-column.tsx
│   │   │   │   ├── status-badge.tsx
│   │   │   │   └── ui/                         # shadcn
│   │   │   ├── lib/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── format.ts                   # mask CPF/CNS
│   │   │   │   └── time.ts                     # delta, "atrasado"
│   │   │   └── hooks/
│   │   │       └── use-transports.ts
│   │   ├── next.config.mjs
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── ingest/                       # Worker Baileys
│       ├── src/
│       │   ├── index.ts              # entrypoint
│       │   ├── whatsapp/
│       │   │   ├── client.ts         # bootstrap Baileys
│       │   │   ├── auth-state.ts     # persistência sessão
│       │   │   └── handlers.ts       # message, update, etc.
│       │   ├── pipeline/
│       │   │   ├── filter.ts         # mensagens relevantes
│       │   │   ├── ingest.ts         # orquestra parse + insert
│       │   │   └── dedupe.ts
│       │   └── logger.ts
│       ├── auth/                     # GITIGNORED: sessão Baileys
│       └── package.json
│
├── packages/
│   ├── db/
│   │   ├── src/
│   │   │   ├── schema.ts             # Drizzle tables
│   │   │   ├── client.ts             # pool + drizzle()
│   │   │   ├── seed.ts               # unidades
│   │   │   └── queries/
│   │   │       ├── transports.ts
│   │   │       └── units.ts
│   │   ├── drizzle.config.ts
│   │   └── migrations/
│   │
│   ├── parser/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── normalize.ts          # tira asteriscos, emojis, lowercase
│   │   │   ├── extractors/
│   │   │   │   ├── patient.ts
│   │   │   │   ├── route.ts          # origem/destino
│   │   │   │   ├── vitals.ts
│   │   │   │   ├── diagnoses.ts
│   │   │   │   └── timing.ts
│   │   │   ├── confidence.ts
│   │   │   └── types.ts
│   │   └── __tests__/
│   │       └── fixtures/             # mensagens reais anonimizadas
│   │
│   └── shared/
│       ├── src/
│       │   ├── enums.ts              # TransportStatus, TripType
│       │   ├── types.ts
│       │   └── constants.ts
│       └── package.json
│
├── .github/workflows/
│   ├── ci.yml                        # lint + typecheck + build + test
│   └── deploy.yml                    # deploy EC2 via SSH
│
├── scripts/
│   ├── deploy.sh
│   └── seed-units.ts
│
├── .env.example
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
└── README.md
```

---

## 6. Modelo de Dados Inicial

Drizzle, Postgres. Schema enxuto, normalizado o suficiente, sem over-engineering.

```typescript
// packages/db/src/schema.ts

export const unitTypeEnum = pgEnum('unit_type', ['UPA', 'PA', 'HOSPITAL', 'OUTRO']);

export const tripTypeEnum = pgEnum('trip_type', [
  'one_way',      // 🚑➡️  só vai (internamento, transferência definitiva)
  'round_trip',   // 🔄    vai e retorna (avaliação, exame, procedimento)
  'unknown'
]);

export const transportStatusEnum = pgEnum('transport_status', [
  'pendente_revisao',
  'novo',
  'aguardando_viatura',
  'viatura_designada',
  'em_deslocamento_origem',
  'paciente_embarcado',
  'em_deslocamento_destino',
  'chegou_destino',
  'retornando_origem',
  'concluido',
  'cancelado'
]);

// Unidades (seed)
export const units = pgTable('units', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 32 }).notNull().unique(),  // slug
  name: varchar('name', { length: 120 }).notNull(),
  type: unitTypeEnum('type').notNull(),
  isOrigin: boolean('is_origin').notNull().default(true),    // pode ser origem?
  aliases: text('aliases').array(),                          // p/ matching no parser
  displayOrder: integer('display_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Mensagem original do WhatsApp (auditoria)
export const whatsappMessages = pgTable('whatsapp_messages', {
  id: serial('id').primaryKey(),
  waMessageId: varchar('wa_message_id', { length: 128 }).notNull().unique(),
  waChatId: varchar('wa_chat_id', { length: 128 }).notNull(),
  waSenderId: varchar('wa_sender_id', { length: 128 }),
  rawText: text('raw_text').notNull(),
  rawJson: jsonb('raw_json'),                                // payload completo Baileys
  receivedAt: timestamp('received_at').notNull(),
  editedAt: timestamp('edited_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Solicitação de transporte (entidade central)
export const transportRequests = pgTable('transport_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  whatsappMessageId: integer('whatsapp_message_id').references(() => whatsappMessages.id),

  // Paciente (desnormalizado deliberadamente — não há cadastro de paciente reaproveitável)
  patientName: varchar('patient_name', { length: 200 }).notNull(),
  patientBirthDate: date('patient_birth_date'),
  patientAgeText: varchar('patient_age_text', { length: 32 }),  // "3 anos", quando não tem data
  patientCns: varchar('patient_cns', { length: 32 }),
  patientCpf: varchar('patient_cpf', { length: 14 }),

  // Rota
  originUnitId: integer('origin_unit_id').references(() => units.id),
  originUnitRaw: varchar('origin_unit_raw', { length: 200 }).notNull(),    // texto bruto
  destinationName: varchar('destination_name', { length: 200 }).notNull(),

  // Procedimento e timing
  procedure: text('procedure').notNull(),
  procedureDate: date('procedure_date'),
  procedureTime: varchar('procedure_time', { length: 32 }),                // "ATÉ 22:00" — manter como texto
  deadlineAt: timestamp('deadline_at'),                                     // parseado quando possível
  tripType: tripTypeEnum('trip_type').notNull().default('unknown'),

  // Clínica (jsonb pra evitar 1 tabela para sinais vitais)
  vitals: jsonb('vitals').$type<{
    pa?: string; fc?: number; fr?: number; spo2?: number;
    glasgow?: number; temp?: number; dextro?: number;
  }>(),
  diagnoses: text('diagnoses').array(),                                     // ["PNEUMONIA", "ASMA"]

  // Operacional
  status: transportStatusEnum('status').notNull().default('novo'),
  parseConfidence: real('parse_confidence').notNull().default(1.0),
  parseWarnings: text('parse_warnings').array(),
  notes: text('notes'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Log operacional (auditoria + timeline no modal)
export const transportEvents = pgTable('transport_events', {
  id: serial('id').primaryKey(),
  transportId: uuid('transport_id').references(() => transportRequests.id, { onDelete: 'cascade' }).notNull(),
  kind: varchar('kind', { length: 64 }).notNull(),     // 'status_change', 'field_edit', 'parse_revised'
  fromValue: jsonb('from_value'),
  toValue: jsonb('to_value'),
  userId: integer('user_id').references(() => users.id),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Usuários
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 200 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 32 }).notNull().default('regulador'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Sessão Baileys (alternativa a salvar em disco — opcional, FASE 2)
// export const whatsappAuthState = pgTable('whatsapp_auth_state', { ... });
```

**Decisões deliberadas:**

- **`procedureTime` como string** além de `deadlineAt` timestamp parseado. Mensagens dizem "ATÉ 22:00", "ENTRE 14H E 16H", "ASSIM QUE POSSÍVEL". Texto bruto preserva intenção; o timestamp é melhor-esforço para ordenação.
- **Sinais vitais e diagnósticos em jsonb/array** em vez de tabelas próprias. Não há queries analíticas sobre eles no MVP.
- **`originUnitRaw`** mantido mesmo após resolver `originUnitId`, porque o parser pode errar e a edição manual pode corrigir.
- **`whatsapp_messages` como entidade própria** — não embute o texto em `transport_requests` porque uma mensagem pode gerar mais de um transporte (família, gêmeos), ou pode ser editada sem invalidar o transporte.

---

## 7. Estratégia de Parsing das Mensagens

**Princípio: parser determinístico primeiro, com confidence score. LLM como fallback futuro, não no MVP.**

### Pipeline

```
raw text
  │
  ▼
[normalize] ──► remove asteriscos, normaliza acentos, lowercase rótulos,
                converte unicode (✱ → *), preserva valores
  │
  ▼
[segment]  ──► identifica blocos por rótulos conhecidos
  │
  ▼
[extract]  ──► 1 extrator por campo, cada um retorna { value, confidence }
  │
  ▼
[resolve]  ──► matching fuzzy de unidades, cálculo de deadline, etc.
  │
  ▼
[score]    ──► confiança agregada → status: novo | pendente_revisao
```

### Extratores (cada um é uma função pura testável)

```typescript
type Extracted<T> = { value: T | null; confidence: number; raw?: string; warning?: string };

extractName(text)         // regex por *NOME*: ou NOME: ... \n
extractBirthDate(text)    // DD/MM/AAAA, DD-MM-AA, "DATA DE NASC"
extractCnsOrCpf(text)     // 15 dígitos (CNS) ou 11 (CPF) com validação
extractOrigin(text, units) // matching fuzzy contra units.aliases
extractDestination(text)  // hospital/unidade após "DESTINO:"
extractProcedure(text)    // após "PROCEDIMENTO:" ou "MOTIVO:"
extractDate(text)         // "DATA DE PROCEDIMENTO"
extractTime(text)         // "HORÁRIO", "CHEGAR ATÉ", "ENTRE X E Y"
extractVitals(text)       // PA, FC, FR, SpO2, GLASGOW, TEMP
extractDiagnoses(text)    // P1, P2, P3 ou hipóteses
inferTripType(procedure)  // "INTERNAMENTO" → one_way, "AVALIAÇÃO"/"CONSULTA" → round_trip
```

### Matching de unidades

Use **similaridade por substring + Levenshtein normalizado** sobre `units.name` e `units.aliases`. Threshold de 0.8 para auto-match, entre 0.6 e 0.8 marca warning e mantém `originUnitId = null` mas `originUnitRaw` preenchido.

Cadastre aliases agressivamente no seed:
```ts
{ name: "PA Orlando Imbassahy", aliases: ["PA ORLANDO", "ORLANDO IMBASSAHY", "PA ORLANDO IMBASSAY"] }
```

### Confidence score

```
confidence_global = média ponderada {
  patientName: 0.20,
  origin: 0.20,
  destination: 0.20,
  procedure: 0.15,
  procedureDateTime: 0.15,
  patientId (CNS/CPF/birth): 0.10
}
```

Se `confidence_global < 0.75` ou se qualquer campo crítico (nome, destino, origem) faltar → `status = pendente_revisao`.

### Por que não LLM no MVP

- **Latência:** Baileys recebe a mensagem; processar via API em ~2s adia o card.
- **Custo e privacidade:** dados de saúde indo pra API externa exige análise LGPD (PHI). Anthropic tem ZDR, mas requer revisão jurídica.
- **Não-determinismo:** mesma mensagem gera resultados diferentes. Dificulta auditoria.
- **Vai funcionar:** as mensagens já são quase-estruturadas. Regex + heurística cobre >90%. O restante vai pra fila de revisão manual — e é nessa fila que o LLM eventualmente entra (com paciente desidentificado).

---

## 8. Estratégia para Mensagens Fora do Padrão

**Camadas de defesa:**

1. **Filtro de relevância antes do parser.** Heurística: a mensagem contém pelo menos 3 de [NOME, DESTINO, PROCEDIMENTO, ORIGEM, "APOIO", emoji 🚑]? Senão, ignora silenciosamente (mas loga em `whatsapp_messages` se for de chat monitorado).

2. **Parser tolerante.** Cada extrator é independente; um campo faltando não derruba os outros. Cada extrator retorna confidence própria.

3. **Fila de revisão (`/revisao`).** Tela dedicada lista `status=pendente_revisao`. Cada item mostra: mensagem original lado a lado com formulário pré-preenchido dos campos que o parser conseguiu, destacando em amarelo os warnings. Regulador edita, salva, status vira `novo`. Toda revisão gera `transport_event` kind=`parse_revised`.

4. **Mensagem editada no WhatsApp.** Baileys emite `messages.update`. Se o `wa_message_id` já existe em `whatsapp_messages`, reexecuta o parser sobre o novo texto. Se já existe `transport_request` linkado, atualiza campos preservando edições manuais (campo `updatedByUser: boolean` por campo, ou flag global "manualmente editado" que bloqueia overwrite).

5. **Mensagens encaminhadas/duplicadas.** Dedupe primário por `wa_message_id`. Dedupe secundário (caso seja reencaminhada de outro chat): hash de (nome normalizado + data nascimento + data procedimento). Se colidir, cria evento `duplicate_suspected` e exibe alerta no card.

6. **Mensagens com múltiplos pacientes.** Detecta múltiplas ocorrências do bloco "NOME:". Cria N transportes vinculados ao mesmo `whatsapp_message_id`. Card mostra badge "1 de 2".

7. **Botão "Criar manualmente"** no dashboard. Cobre o caso de chamada por telefone, falha de Baileys, ou mensagem totalmente fora do padrão.

---

## 9. UX da Tela Principal

### Layout

**Desktop (>= 1024px):** grid responsivo de colunas, uma por unidade de origem. Largura mínima de coluna 280px, com scroll horizontal se necessário. As colunas se reorganizam por **densidade** (unidades com mais transportes pendentes ficam à esquerda) — opção alternativa: ordem alfabética com toggle.

**Mobile/tablet (< 1024px):** unidades viram seções empilhadas com header sticky e contagem.

### Header global

```
┌──────────────────────────────────────────────────────┐
│ SAMU/CRU · Transportes        🟢 18 ativos · 3 urgentes │
│                                                      │
│ [Tudo] [Hoje] [Atrasados] [Pendentes revisão (2)]   │
│                              [+ Novo]  [⚙]   [🔔]  │
└──────────────────────────────────────────────────────┘
```

### Coluna de unidade

```
┌─ PA ORLANDO IMBASSAHY ────────── 4 ┐
│                                    │
│  🏥 HMV · 🚑➡️ · 22:00 · INTERN.    │   ← card compacto
│  🏥 H. Couto · 🔄 · 14:00 · CONSU.  │
│  🏥 HGCA · 🚑➡️ · 18:00 · INTERN.   │
│  ⚠ Pendente revisão                │   ← card amarelado
│                                    │
└────────────────────────────────────┘
```

### Card compacto — anatomia

Altura ~48-56px, padding compacto, hover destaca. Estrutura horizontal:

```
[ícone tipo viagem] [destino abreviado em bold] · [hora] · [procedimento truncado]
                                                          [pequena barra de status na borda esquerda]
```

**Regras visuais:**

- **Borda esquerda colorida (4px)** indica status (vide §11).
- **Fundo do card** pulsa sutilmente (Framer Motion `animate-pulse` controlado) se faltam <30 min para o deadline e status ainda não chegou em "chegou_destino".
- **Atrasado** (passou do deadline sem concluir): borda vermelha + ícone ⏰ piscando.
- **Truncate** com tooltip no hover/long-press.
- **Sem CNS/CPF visível** na tela principal — nunca.

### Ícones de tipo de viagem

- `🚑➡️` ou `→` em ícone próprio: **one_way** (só vai — internamento, transferência)
- `🔄` ou `↔`: **round_trip** (vai e volta — avaliação, exame, consulta)
- `❓`: **unknown** (chama atenção para revisão)

Preferência: usar Lucide icons (`ArrowRight`, `RefreshCcw`, `HelpCircle`) em vez de emojis, com cor sutil. Emoji só se o regulador insistir — emojis renderizam de forma inconsistente entre OS.

### Interações

- **Clique no card** → modal de detalhes
- **Long-press / botão direito** → menu rápido de mudança de status (4 ações mais comuns)
- **Drag entre colunas** — NÃO no MVP (origem é fato, não move)
- **Atalhos de teclado:** `/` foca busca, `r` abre fila de revisão, `n` novo manual, `Esc` fecha modal

### Estados vazios e loading

- Coluna sem transportes: mostra ícone leve + "Sem transportes" em cinza
- Loading inicial: skeleton de 3 cards por coluna
- Erro de rede: banner discreto no topo + retry exponencial silencioso

### Atualização em tempo real

SSE em `/api/stream` envia `transport.created`, `transport.updated`, `transport.status_changed`. Cliente faz patch otimista no estado local. Fallback: polling a cada 10s caso SSE caia.

---

## 10. UX do Modal de Detalhes

**Comportamento:** Sheet (shadcn `Sheet` component) deslizando da direita em desktop (largura 480px), full-screen em mobile. Não bloqueia totalmente o painel atrás — borda translúcida.

**Estrutura (top-down):**

```
┌─ Theo Santos Ferreira · 7 anos                ✕ ┐
│  CNS 1125…0528  [revelar] [copiar]              │
│  ─────────────────────────────────────          │
│                                                 │
│  [STATUS DROPDOWN]              ⏰ Chegar 22:00  │
│                                                 │
│  ROTA                                           │
│  📍 PA Orlando Imbassahy                        │
│  ↓ one-way                                      │
│  🏥 Hospital Manoel Victorino                   │
│  Procedimento: INTERNAMENTO                     │
│                                                 │
│  CLÍNICA                                        │
│  ┌───┬───┬───┬───┬───┬───┐                     │
│  │PA │FC │FR │SpO│GCS│T° │                     │
│  │ - │134│22 │97 │15 │36.5│                    │
│  └───┴───┴───┴───┴───┴───┘                     │
│                                                 │
│  HIPÓTESES                                      │
│  • Pneumonia  • Exacerbação asmática            │
│  • Amigdalite bacteriana                        │
│                                                 │
│  TIMELINE                                       │
│  🟢 Criado · 21:43 · WhatsApp                   │
│  🔵 Status → aguardando viatura · 21:45 · Dr.X  │
│                                                 │
│  ─── Mensagem original ───────  [expandir]      │
│  PA ORLANDO IMBASSAHY SOLICITA APOIO 🚑...      │
│                                                 │
│  [Editar campos] [Cancelar transporte]          │
└─────────────────────────────────────────────────┘
```

**Princípios:**

- CNS/CPF **mascarado por padrão** (`••• ••• 528`), botão "revelar" registra evento de auditoria.
- Status como dropdown shadcn `Select`, atalhos numéricos `1-9`.
- Timeline lê de `transport_events`, ordem cronológica decrescente.
- "Editar campos" abre formulário inline com mesmos campos da fila de revisão.
- "Mensagem original" colapsada por padrão, monoespaçada quando expandida.
- Botão "Copiar resumo" gera texto formatado pronto para repassar ao despachador via WhatsApp.

---

## 11. Status e Cores Sugeridas

Paleta semântica, tokens Tailwind. Acessibilidade: contraste >= 4.5:1.

| Status | Cor borda | Background card | Significado |
|---|---|---|---|
| `pendente_revisao` | `amber-500` | `amber-50` (dark: `amber-950/30`) | Parser baixa confiança, ação necessária |
| `novo` | `sky-500` | base | Recém-chegado, ainda não trabalhado |
| `aguardando_viatura` | `slate-400` | base | Aguardando recurso |
| `viatura_designada` | `violet-500` | base | Recurso alocado |
| `em_deslocamento_origem` | `indigo-500` | base | A caminho do paciente |
| `paciente_embarcado` | `blue-600` | base | Paciente na viatura |
| `em_deslocamento_destino` | `cyan-500` | base | A caminho do destino |
| `chegou_destino` | `emerald-500` | base | Entregue |
| `retornando_origem` | `teal-500` | base | Só p/ round_trip |
| `concluido` | `zinc-400` | `zinc-50/50` (opacity) | Encerrado, fade out |
| `cancelado` | `zinc-500` | listrado, riscado | Não vai acontecer |

**Camada extra (urgência), independente do status:**

- Deadline em <30 min e status < `chegou_destino`: borda dupla com `rose-500`
- Deadline ultrapassado: borda `rose-600` sólida + ícone ⏰
- Concluído há mais de 2h: opacity-50, move pro final da coluna ou some com toggle

**Modo escuro como default** — tela de central operacional, monitor 24/7, escuro é menos cansativo. Light mode disponível.

---

## 12. Plano de Integração com Baileys

### Pré-requisitos críticos

1. **Sessão separada da aplicação "giro de leitos".** Mesmo número, mas:
   - **Pasta de auth completamente diferente** (`apps/ingest/auth/`).
   - **Cada instância Baileys precisa do seu próprio dispositivo vinculado.** WhatsApp permite até 4 dispositivos vinculados além do principal. Cada `useMultiFileAuthState` gera um pareamento separado.
   - **Risco:** se você usar a mesma pasta de auth nas duas apps, uma derruba a outra. Trate como dois "Web/Linked Devices" independentes.

2. **Filtragem por chat.** Configurar **whitelist de `chatId`s ou `senderJid`s** que enviam solicitações de apoio. Variável de ambiente `WA_ALLOWED_CHATS=jid1,jid2`. Tudo fora disso é silenciosamente ignorado (mas pode ser logado em modo dev).

### Pipeline do worker

```typescript
sock.ev.on('messages.upsert', async ({ messages, type }) => {
  if (type !== 'notify') return;
  for (const msg of messages) {
    if (!isFromAllowedChat(msg)) continue;
    if (msg.key.fromMe) continue;

    const text = extractText(msg);  // text, extendedText, caption
    if (!text || !looksLikeTransportRequest(text)) continue;

    await ingestMessage({
      waMessageId: msg.key.id!,
      waChatId: msg.key.remoteJid!,
      waSenderId: msg.key.participant ?? msg.key.remoteJid!,
      rawText: text,
      rawJson: msg,
      receivedAt: new Date((Number(msg.messageTimestamp) || 0) * 1000),
    });
  }
});

sock.ev.on('messages.update', async (updates) => {
  for (const u of updates) {
    if (u.update.message) {
      await handleEdit(u.key.id!, extractText(u.update));
    }
  }
});

sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
  if (qr) writeQrToFile(qr);   // exibe QR no console e salva png
  if (connection === 'close') reconnectWithBackoff(lastDisconnect);
});
```

### Resiliência

- **Reconexão exponencial** (1s, 2s, 4s, ... max 60s). Não tentar reconectar se `DisconnectReason.loggedOut` — exige novo QR.
- **Heartbeat:** worker grava em uma tabela `worker_heartbeat` a cada 30s; UI mostra indicador 🟢/🔴 da ingestão.
- **Outbox pattern para falhas de DB:** se `INSERT` falha, mensagem vai pra fila em disco (`auth/outbox/`) e é reprocessada.
- **Idempotência:** `INSERT ... ON CONFLICT (wa_message_id) DO NOTHING` na tabela `whatsapp_messages`.

### Boas práticas (reaproveitando padrões de "giro de leitos")

Quando for executar, primeiro inspecione o repositório existente:
```bash
gh repo clone caiooliveirac/giro-de-leitos /tmp/giro && \
  rg -l "Baileys|makeWASocket|useMultiFileAuthState" /tmp/giro/src
```
Reaproveite a lógica de reconexão, logger e estrutura de event handlers que já está validada.

### Em produção

- Worker como serviço **systemd** ou **PM2** com `restart: always`.
- Logs em `/var/log/samu-cru-ingest/` com rotação.
- Pasta `auth/` em volume persistente, com **backup criptografado diário** (perder a auth = re-scan QR + perde histórico de sincronização).
- **Nunca commitar `auth/` — adicionar ao `.gitignore` desde o primeiro commit.**

---

## 13. Plano de Autenticação e Segurança

### Autenticação

**MVP:** NextAuth (Auth.js v5) com Credentials provider.
- Senha hash com `argon2id` (não bcrypt — argon2 é o estado da arte).
- Sessão JWT em cookie `httpOnly`, `Secure`, `SameSite=Lax`, 12h.
- Sem auto-registro. Usuários criados via script CLI (`pnpm seed:user`).
- **2FA TOTP** já no MVP é overkill, mas planejar para fase 2.

### Autorização

MVP tem 1 perfil (`regulador`). Estrutura preparada com `users.role`. Middleware Next protege todas as rotas exceto `/login`.

### Dados sensíveis

- **CNS/CPF mascarado por padrão** em UI. Reveal explícito gera evento de auditoria com `transportEvents` kind=`pii_revealed`.
- **Nunca logar dados de paciente.** Logger configurado com redactor (Pino com `redact: ['*.cpf', '*.cns', '*.patientName']`).
- **Backups do banco** criptografados (pg_dump | age | s3 cp).
- **Mensagem original do WhatsApp** contém PII. Acesso ao raw_text restrito ao modal autenticado, nunca exposto em endpoints públicos.

### Hardening de produção

- Next.js em modo `standalone`, atrás de Caddy ou Nginx com HTTPS (Let's Encrypt).
- Postgres escutando apenas em `localhost` ou na VPC.
- Variáveis de ambiente via systemd `EnvironmentFile=` com permissão 600.
- `SECURITY.md` no repo com canal de reporte.
- Headers de segurança via Next middleware: `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`.
- Rate limiting nas rotas de auth (10 tentativas/15min/IP).

### LGPD operacional

- Base legal: **tutela da saúde** (Art. 11, II, "f" da LGPD) — execução de serviço público de saúde. Documentar isso no README.
- **Termo interno de uso** assinado pelos reguladores antes de receber credencial.
- **Política de retenção:** transportes concluídos há mais de 12 meses → arquivo frio (tabela `transport_requests_archive` ou soft delete com anonimização do nome).
- **Direito de portabilidade/eliminação:** baixa prioridade (dados de prontuário têm exceção legal de retenção mínima de 20 anos para CFM), mas estruturar o `deletePatient(transportId)` para anonimizar.

---

## 14. Plano de CI/CD com GitHub Actions e EC2

### Estrutura

```
.github/workflows/
├── ci.yml         # roda em PR e push: lint, typecheck, test, build
└── deploy.yml     # roda em push para main: ssh + script
```

### CI (`ci.yml`)

Jobs paralelos:
1. **lint** — `pnpm lint`
2. **typecheck** — `pnpm typecheck`
3. **test** — `pnpm test` (parser tem cobertura, resto é teste de fumaça)
4. **build** — `pnpm build` em ambos `apps/web` e `apps/ingest`

Postgres como service container para testes de integração do `packages/db`.

### Deploy (`deploy.yml`)

Trigger: push em `main` após CI verde.

```yaml
- ssh into EC2 (using GH Secret SSH_KEY)
- cd /srv/samu-cru
- git pull
- pnpm install --frozen-lockfile --prod=false
- pnpm db:migrate
- pnpm build
- pm2 reload ecosystem.config.cjs --update-env
- curl -fsS http://localhost:3000/api/health || rollback
```

### Secrets a configurar no GitHub

```
SSH_HOST
SSH_USER
SSH_KEY (chave privada)
SSH_PORT
DEPLOY_PATH
```

Secrets de runtime (`.env` na máquina, não no GH):
```
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
WA_ALLOWED_CHATS
```

### Setup inicial da EC2

Script `scripts/provision-ec2.sh` idempotente:
- Instala Node 20 LTS via nvm
- Instala pnpm, pm2, Postgres 16, Caddy
- Cria usuário `samu-cru`, pasta `/srv/samu-cru`
- Configura systemd unit alternativa caso prefira ao PM2
- Configura Caddy com auto-HTTPS apontando para domínio

**Antes de executar essa fase, inspecionar repositórios anteriores em `caiooliveirac` em busca de workflows e scripts de provisionamento já validados.** Reaproveitar `deploy.yml` e `provision.sh` se existirem.

---

## 15. Ordem de Execução em Fases

### Fase 0 — Setup (½ dia)
- Criar repo, monorepo pnpm, tsconfig base
- Postgres local rodando, `.env.example`
- shadcn init, Tailwind, fontes (Inter + JetBrains Mono)
- README com decisões arquiteturais

### Fase 1 — Banco e parser (2 dias)
- Schema Drizzle, migrations, seed das 17 unidades
- `packages/parser` com extratores e fixtures de 10 mensagens reais (anonimizadas)
- Coverage do parser >= 80%
- CLI `pnpm parser:test <arquivo.txt>` para iterar

### Fase 2 — Dashboard read-only (2 dias)
- Tela principal com cards compactos, dados mock primeiro, depois reais
- Agrupamento por unidade
- SSE básico ou polling
- Modal de detalhes
- Filtros simples e busca

### Fase 3 — Worker Baileys (1-2 dias)
- Bootstrap em `apps/ingest`, pareamento via QR
- Filtragem por whitelist
- Ingestão → parser → banco
- Heartbeat e logs

### Fase 4 — Operação manual (1 dia)
- Mudança de status (dropdown + ação rápida)
- Fila de revisão
- Edição manual de campos
- Botão "criar manualmente"
- Timeline de eventos

### Fase 5 — Auth e segurança (1 dia)
- NextAuth Credentials
- Middleware de proteção
- Mascaramento de PII
- Auditoria de revelação

### Fase 6 — Deploy (1 dia)
- Workflows GH Actions
- Provisionamento EC2
- Caddy + HTTPS
- PM2 com app web e worker
- Backup automatizado do banco

### Fase 7 — Polimento (contínuo)
- Atalhos de teclado
- Estados de loading/erro
- Animações Framer Motion
- Mobile fine-tune
- Métricas operacionais (tela `/metrics` simples)

---

## 16. Prompt Posterior para Claude Design

> Você é um designer de produto sênior especializado em interfaces operacionais densas (NOC, command centers, healthcare dashboards).
>
> **Contexto:** dashboard para médico regulador do SAMU acompanhar transportes inter-unidades. Tela é vista em monitor de central 24/7, e ocasionalmente em celular durante plantão.
>
> **Stack:** Next.js + Tailwind + shadcn/ui + Lucide icons + Framer Motion. Modo escuro como default.
>
> **Tarefa:** projete os seguintes componentes em alta fidelidade (pode entregar como HTML+Tailwind ou React+Tailwind renderizável):
>
> 1. **Header global** com contagem de transportes ativos, filtros rápidos (Hoje/Atrasados/Pendentes revisão), busca, e indicador de status do worker WhatsApp (🟢/🔴).
> 2. **Coluna de unidade** com header sticky (nome + contagem) e lista de cards compactos.
> 3. **Card compacto de transporte** (altura ~48-56px) mostrando ícone de tipo de viagem, destino abreviado em destaque, horário/deadline, procedimento truncado, com borda lateral colorida indicando status. Inclua todos os estados visuais: novo, em deslocamento, atrasado (pulsando), concluído (fade), cancelado (riscado), pendente revisão.
> 4. **Modal/Sheet de detalhes** com rota visual (origem → destino), bloco clínico em mini-tabela de sinais vitais, lista de hipóteses, timeline de eventos, mensagem original colapsável, e ações rápidas. Inclua estado de CNS mascarado com botão "revelar".
> 5. **Fila de revisão** — tela onde o regulador vê mensagens parseadas com baixa confiança, com mensagem original lado a lado com formulário pré-preenchido, warnings destacados em amarelo nos campos incertos.
>
> **Regras de design:**
> - Densidade alta mas legível (16-17 transportes pendentes simultâneos visíveis sem scroll em 1440p).
> - Cores semânticas estritamente seguindo a tabela de status [colar §11].
> - Nada de cara de "dashboard genérico bootstrap 2018". Inspire-se em Linear, Vercel, Datadog, Raycast.
> - Tipografia Inter para UI, JetBrains Mono para dados clínicos e mensagem original.
> - Mobile-first nos componentes individuais; layout multi-coluna só em ≥1024px.
> - **Nunca** mostre CPF/CNS na tela principal.
>
> Entregue artefatos renderizáveis no Claude Artifacts mostrando: (a) tela cheia desktop com 4 colunas de unidades populadas com transportes em estados variados, (b) modal aberto sobre o painel, (c) versão mobile da tela principal e do modal, (d) tela de revisão.

---

## 17. Prompt Posterior para Claude Code

> Você é meu engenheiro implementando o projeto **samu-cru-dashboard** localmente no macOS. O planejamento arquitetural completo está em `PLANNING.md` (cole o conteúdo deste documento). Siga-o como contrato. Desvios exigem justificativa explícita.
>
> **Princípios de execução:**
> - Trabalhe em commits pequenos, atômicos, com mensagens convencionais (`feat:`, `fix:`, `chore:`).
> - Mantenha `main` sempre verde. Use branches `feat/...` e PRs locais via `gh pr create`.
> - Ao iniciar cada fase do plano, abra uma issue no GitHub com checklist; feche via commit message `Closes #N`.
> - **Antes de implementar Baileys**, clone `caiooliveirac/giro-de-leitos` em `/tmp` e estude a estrutura de sessão, reconexão e handlers. Reaproveite padrões.
> - **Antes de criar `.github/workflows`**, busque workflows existentes em outros repositórios meus (`gh repo list caiooliveirac --limit 50`). Reaproveite o `deploy.yml` validado.
> - Não me pergunte sobre questões já decididas no plano. Quando houver decisão técnica menor não coberta, decida com bom senso e documente no commit.
>
> **Comece pela Fase 0:** crie o monorepo, configure pnpm workspaces, tsconfig base, ESLint flat config, Prettier, Drizzle + Postgres local (via Homebrew, sem Docker), shadcn init em `apps/web`, README inicial. Confirme que `pnpm lint && pnpm typecheck && pnpm build` passa antes de prosseguir para Fase 1.
>
> **Definição de pronto por fase:**
> - Todos os critérios da seção 15 do plano cumpridos.
> - Testes (quando aplicável) verdes.
> - README ou docs/ atualizado.
> - Pushed para `main` com CI verde.
>
> **Variáveis de ambiente** vão em `.env.example` (versionado) e `.env.local` (gitignored). Nunca commite secrets.
>
> Comece executando `pnpm init` e me reportando o plano detalhado da Fase 0 antes de codar.

---

## Premissas declaradas (revisar se discordar)

1. **Sem Docker em dev** — Postgres via Homebrew é mais simples no macOS e dev iteration é mais rápido.
2. **Polling + SSE leve em vez de WebSocket** — cardinalidade não justifica complexidade.
3. **Parser determinístico no MVP, LLM apenas pós-MVP e com PHI desidentificado** — privacidade + previsibilidade.
4. **Worker e web separados desde o início** — barato fazer agora, doloroso refatorar depois.
5. **Mensagem original do WhatsApp é fonte de verdade auditável**, nunca deletada.
6. **Modo escuro default** — central operacional 24/7.
7. **NextAuth v5 (Auth.js) com Credentials**, sem OAuth no MVP — independência de Google/MS.
8. **pnpm workspaces** em vez de Turborepo/Nx — overhead mínimo, suficiente para 2 apps + 3 packages.
9. **Sessão Baileys em arquivo (`auth/`) com backup criptografado**, não em DB — alinhado com prática do "giro de leitos", evita complexidade.
10. **Drizzle ORM confirmado** — type-safety superior, migrations versionadas, baixo overhead. Não há razão para Prisma neste projeto.

---

Quer que eu já transforme um destes blocos (prompt de Design, prompt de Code, ou README inicial) em artefato pronto para uso?