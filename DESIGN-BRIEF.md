# Brief de design — Transportes SAMU/CRU

> Documento de contexto para o **agente de design (claude.ai/design)**.
> Explica o que a aplicação faz, quem usa, quais telas existem hoje e o
> que cada uma precisa. Escrito para alguém que **nunca viu o código**.
>
> Fonte da verdade do produto é este arquivo + o código em `apps/web`.
> O `DESIGN.md` antigo descreve o protótipo original (dashboard de
> ingestão WhatsApp) e está **parcialmente desatualizado** — leia este
> primeiro.

---

## 1. O que é, em uma frase

Plataforma web para o **transporte inter-unidades de pacientes** na rede
municipal de urgência de Salvador (SAMU / Central de Regulação de
Urgências — CRU). As **unidades de saúde** (UPAs, PAs, Hospital
Municipal) **solicitam** transporte de pacientes por um formulário; o
**médico regulador do SAMU/CRU** acompanha e despacha todas as
solicitações num **painel operacional em tempo quase real**.

## 2. Quem usa (dois públicos, dois mundos visuais)

A aplicação tem **dois tipos de usuário muito diferentes**, e por isso
**duas linguagens visuais distintas** convivem no produto:

| Público | Quem é | O que faz | Mundo visual |
|---|---|---|---|
| **Unidade solicitante** | Enfermeiro/recepção de uma UPA/PA (17 unidades) | Loga com a credencial da unidade, **preenche o formulário** de pedido de transporte, acompanha **suas** solicitações | **"Warm glass"** — fundo escuro quente, gradientes radiais âmbar/gelo, glassmorphism. Acolhedor, formulário calmo. |
| **Regulador / Admin** | Médico regulador do SAMU/CRU (central 24/7) | Vê **todas** as solicitações num painel denso multi-coluna, muda status, abre detalhes clínicos | **"Dark ink"** — escala neutra escura (quase preta), alta densidade, cor só com significado. Estilo Linear / Datadog / sala de controle. |

> **Não unificar os dois mundos.** A divisão é intencional: o solicitante
> faz uma tarefa pontual e quer conforto; o regulador encara a tela o
> turno inteiro e precisa de densidade e calma cromática. Eles têm até
> rotas e tema de cor separados.

## 3. Fluxo ponta a ponta

```
UNIDADE                              REGULADOR / ADMIN (SAMU/CRU)
───────                              ────────────────────────────
/login (aba Unidade)
   │  login = credencial da unidade
   ▼
/solicitar  ──── preenche form ────►  aparece no painel /  (status "novo")
   │                                       │
   ▼                                       ├─ abre Sheet de detalhes
/solicitar/minhas                          ├─ avança status (11 estados)
   (acompanha as próprias,                 │   novo → aguardando viatura →
    pode CANCELAR enquanto                  │   designada → em deslocamento →
    não-terminal)                          │   embarcado → … → concluído
                                           ▼
                                     /admin (cria/rotaciona credenciais
                                      das unidades e usuários reguladores)
```

## 4. Telas existentes hoje (e o que cada uma precisa)

### 4.1 `/login` — entrada única `[warm glass]`
- Card central glass (`max-w-md`) sobre fundo `page-warm`. Logo = coração
  em gradiente âmbar→vermelho.
- **Abas / modos de login:** `Unidade` (usuário + senha da unidade) e
  `Regulador-Admin` (usuário nominal + senha).
- Estado atual: funcional e razoavelmente polido. **Pode evoluir:**
  hierarquia das abas, microcópia, estados de erro/carregando.

### 4.2 `/solicitar` — formulário de solicitação `[warm glass]`
O coração do lado "unidade". Card glass `max-w-3xl`. Campos (seções):
- **Paciente:** Nome completo *, Data de nascimento **ou** idade
  aproximada, CNS, CPF.
- **Rota:** Destino * (hospital/clínica), Procedimento / motivo *.
- **Timing:** Data de apresentação, Horário, Tipo de transporte
  (`Só ida` / `Ida e volta` / `A definir`), Prazo (data) e Prazo (hora).
- **Clínica (opcional):** Hipóteses diagnósticas; sinais vitais em grade —
  PA, FC, FR, SpO₂, Temp, Glasgow, Dextro.
- **Observações** livres.
- CTA: "Enviar solicitação".
- **Maior oportunidade de design.** Formulário longo; precisa de ótima
  progressão visual, agrupamento, densidade confortável, validação clara,
  feedback de envio. Campos clínicos em fonte **mono** (JetBrains Mono).

### 4.3 `/solicitar/minhas` — histórico da unidade `[warm glass]`
- Cards das solicitações **daquela unidade**. Filtros: ativas /
  concluídas / canceladas / todas.
- **Borda lateral colorida por status**, fade nos terminais, line-through
  em cancelados. Botão "Cancelar" só em status não-terminal.
- Precisa: legibilidade do estado de cada card, distinção
  ativo/terminal, estado vazio caprichado.

### 4.4 `/` (raiz) — **painel do regulador** `[dark ink]`
A tela mais importante e mais densa. É a sala de controle.
- **Server Component** lê o snapshot vivo do banco (sem cache) e entrega
  ao `DashboardShell`.
- **Layout multi-coluna por unidade de origem** — cada UPA/PA é uma
  coluna; os transportes pendentes ficam empilhados nela. Header sticky,
  indicador "live", contagem/carga.
- **Card de transporte:** destino + horário dominam (hierarquia
  brutal), status pill colorida, sinais vitais compactos.
- **Sheet de detalhes** (480px à direita): rota, clínica, hipóteses,
  timeline de eventos, dados do paciente.
- **Meta de densidade:** ~16-17 transportes pendentes simultâneos
  legíveis em 1440p **sem scroll vertical**.
- Componentes já existentes: `dashboard-shell`, `unit-column`,
  `transport-card`, `detail-sheet`, `status-pill`, `vital-grid`,
  `header`, `live-badge`, `empty-state`.
- Precisa: refinar densidade, hierarquia do card, o Sheet, estados de
  urgência (deadline próximo usa animação `card-pulse` / `ping-slow`).

### 4.5 `/admin` — administração `[warm glass]`
- Duas tabelas: **credenciais por unidade** (17 unidades × login, último
  acesso, botão "rotacionar senha" que revela a senha em claro 1×) e
  **usuários reguladores** (nome, email, papel, ativo).
- Precisa: tabelas legíveis, ação de rotação clara e segura (mostra senha
  uma vez + copiar).

## 5. Taxonomia de status (cor = significado)

11 estados, em ordem de ciclo de vida. **Cada um tem cor canônica** — a
cor NUNCA é decorativa, ela codifica o estágio. Fonte única em
`@samu-cru/shared → STATUS` (não invente cores inline).

| Status | Rótulo | Cor (accent) |
|---|---|---|
| `pendente_revisao` | Pendente revisão | amber |
| `novo` | Novo | sky |
| `aguardando_viatura` | Aguardando viatura | slate |
| `viatura_designada` | Viatura designada | violet |
| `em_deslocamento_origem` | A caminho da origem | indigo |
| `paciente_embarcado` | Paciente embarcado | blue |
| `em_deslocamento_destino` | A caminho do destino | cyan |
| `chegou_destino` | Chegou ao destino | emerald |
| `retornando_origem` | Retornando à origem | teal |
| `concluido` | Concluído | zinc (neutro) |
| `cancelado` | Cancelado | zinc (neutro) |

Terminais (esmaecidos no UI): `chegou_destino`, `concluido`, `cancelado`.
A progressão de cor (sky→violet→indigo→blue→cyan→emerald→teal) é uma
**escala de avanço da viagem** — preservar essa leitura de "rio que
flui" é desejável.

## 6. Tokens visuais atuais

### Mundo "warm glass" (login, solicitar, minhas, admin)
Espelha o app irmão `plantoes`. Definido em `apps/web/src/app/globals.css`:
- Fundos: `--color-warm-bg #0a0d12`, `--color-warm-bg-deep #040608`.
- Acentos: `--color-ice #9fbfd6`, `--color-gold #c5a16a`,
  `--color-warm-green #8fb39d`, `--color-warm-amber #d8a65d`,
  `--color-warm-red #d36464`.
- Semânticos: `--color-accent-confirm #4ec9b8`, `--accent-warn #e0a458`,
  `--accent-fraud #ef6961`, `--accent-info #7c8cf8`.
- Utilitários: `.page-warm` (gradientes radiais + grão SVG anti-banding),
  `.surface-glass`, `.surface-elevated`.

### Mundo "dark ink" (painel do regulador)
Escala neutra quase-preta:
`ink-0 #0a0c10` (bg) · `ink-50 #0d1015` · `ink-100 #11151c` (cards) ·
`ink-150 #161b24` (hover) · `ink-200 #1c2230` (controles) ·
`ink-300 #252c3c` · `ink-400 #323a4d` (bordas).
Status usa a **paleta nativa do Tailwind** (amber/sky/violet/…/rose).

### Tipografia (ambos os mundos)
- UI: **Inter** (`font-feature-settings: "cv11","ss01","ss03"`).
- Dados clínicos / mono: **JetBrains Mono**.
- Carregadas via `next/font/google`.

### Animação (parcimoniosa)
`ping-slow` (deadline próximo), `card-pulse` (urgente), `shimmer`
(skeleton). Movimento só para urgência, entrada/saída de Sheet e hover
sutil.

## 7. Regras de design não-negociáveis

1. **Densidade alta com legibilidade impecável** (regulador vê dezenas de
   cards de uma vez).
2. **Hierarquia brutal:** no card, destino + horário dominam.
3. **Cor = significado.** Não-status é neutro (zinc/slate). Sem cor
   decorativa.
4. **Movimento parcimonioso.**
5. **Tipografia que respira.**
6. **Estado vazio é parte do design**, não um afterthought.
7. **PII protegida:** CPF/CNS **nunca** na tela principal; mascarado até
   no detalhe (revelar = clique + log de auditoria). LGPD.
8. **Dois mundos visuais separados** (warm vs ink) — não unificar.

Inspirações: **Linear, Vercel Dashboard, Raycast, Datadog**.
Evitar: templates admin Bootstrap, kits ThemeForest.

## 8. Contexto técnico (só o que afeta design)

- **Next.js 15 (App Router) + React 19 + Tailwind v4** (CSS-first via
  `@theme`, sem `tailwind.config`). Primitivos shadcn/ui (Button, Badge,
  Sheet, Tooltip) + componentes próprios de status.
- Monorepo pnpm: `apps/web` (UI), `packages/shared` (taxonomia/units/
  status — fonte única), `packages/db` (Drizzle/Postgres).
- **17 unidades de origem** (UPAs/PAs + Hospital Municipal de Salvador),
  cada uma vira coluna no painel e tem credencial própria.
- Há um worker WhatsApp legado (`apps/ingest`) **dormente** — o pivot
  atual é o formulário web. Campos `source` no banco distinguem
  `web_form` / `manual` / `whatsapp` (legado).
- Deploy em produção: `transportes.mnrs.com.br` (EC2, PM2, GitHub Actions
  self-hosted runner).

## 9. O que pedir ao agente de design (sugestão de prioridade)

1. **Painel do regulador (`/`)** — a tela de maior valor e maior risco de
   ficar densa demais. Refinar card, colunas por unidade, Sheet, estados
   de urgência.
2. **Formulário `/solicitar`** — longo; ganhar com agrupamento e ritmo
   visual sem perder rapidez de preenchimento.
3. **`/solicitar/minhas`** — leitura de status por card + estado vazio.
4. **`/admin` e `/login`** — refinos.

Preservar: as duas linguagens visuais, a semântica de cor dos 11 status,
a proteção de PII e a meta de densidade do painel.
