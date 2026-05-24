# Design — Dashboard de Transportes SAMU/CRU

## Fonte

Protótipo de alta fidelidade gerado em **Claude Design** (`claude.ai/design`)
e exportado como bundle. Bundle bruto preservado em `design-refs/` para
consulta. **Não edite `design-refs/` — é fonte imutável.**

- Bundle original: `design-refs/dashboard-de-transportes-samu-cru/`
- README do bundle: `design-refs/dashboard-de-transportes-samu-cru/README.md`
- Brief que produziu o design: `design-refs/.../chats/chat1.md` (linhas 27-191)
- Implementação React (referência): `design-refs/.../project/src/*.jsx`
- Screenshots: `design-refs/.../project/screenshots/`
- URL do artefato (autenticado): https://api.anthropic.com/v1/design/h/reitf0KUOqDFqtuCEW2XrA

## Tokens visuais (fonte de verdade)

Os tokens abaixo foram extraídos do design e estão em
`apps/web/src/app/globals.css` via `@theme` do Tailwind v4.

### Tipografia

- UI: **Inter** (400/500/600/700) com `font-feature-settings: "cv11", "ss01", "ss03"`.
- Dados clínicos e mensagem original: **JetBrains Mono** (400/500/600).
- Carregadas via `next/font/google` (sem `<link>` manual no head).

### Paleta

Escala neutra escura (default — modo escuro é primário, central operacional 24/7):

| Token       | Hex       | Uso                                          |
| ----------- | --------- | -------------------------------------------- |
| `ink-0`     | `#0a0c10` | background da página (escuro)                |
| `ink-50`    | `#0d1015` | superfícies sutis                            |
| `ink-100`   | `#11151c` | cards, sheets                                |
| `ink-150`   | `#161b24` | hover de cards                               |
| `ink-200`   | `#1c2230` | controles (button secondary, select)         |
| `ink-300`   | `#252c3c` | controles ativos                             |
| `ink-400`   | `#323a4d` | bordas mais fortes                           |

Cores semânticas de status usam **paleta nativa do Tailwind**: `amber-500`,
`sky-500`, `slate-400`, `violet-500`, `indigo-500`, `blue-600`, `cyan-500`,
`emerald-500`, `teal-500`, `zinc-400/500`, `rose-500/600` (urgência).
Mapeamento canônico está em `@samu-cru/shared` → `STATUS`.

### Animações

- `ping-slow` — 1.8s ease-in-out infinite (deadline próximo)
- `card-pulse` — 1.8s opacity 1 ↔ .82 (urgente)
- `shimmer` — 2.4s linear infinite (skeleton)

## Telas (do bundle, para uso em fases 2-7)

1. **Painel desktop (dark/light)** — `screens-main.jsx`. Multi-coluna por
   unidade de origem, header sticky, contagem + barra de carga.
2. **Detalhes (Sheet)** — `screens-detail.jsx`. Sheet 480px à direita,
   ROTA / CLÍNICA / HIPÓTESES / TIMELINE / Mensagem original.
3. **Fila de revisão** — `screens-review.jsx`. Split 40/60, parser warnings
   em ring-amber-500 nos campos baixa confiança.
4. **Mobile** — `screens-mobile.jsx`. Seções empilhadas, FAB + bottom nav.
5. **Componentes isolados** — `screens-components.jsx`. Todos os estados
   de card, status pill, vital signs, etc.

## Componentes UI

O design implementa primitivos shadcn-style à mão (`ui.jsx`): Button, Badge,
Kbd, Tooltip, Select, Sheet, StatusDot, StatusPill, PillGroup, Section.

**Decisão de implementação:** ao portar para `apps/web`, usar **shadcn/ui
oficial** para Button, Badge, Sheet, Tooltip, Select. Manter
StatusPill/StatusDot/PillGroup como wrappers próprios em
`apps/web/src/components/` consumindo `STATUS` de `@samu-cru/shared`.

## Mocks como fixtures

- `data.jsx` define 24 transportes mock distribuídos por 10 unidades.
- Mensagens WhatsApp reais (campos `mensagem`) extraídas para
  `packages/parser/__tests__/fixtures/*.txt` — alimentam os testes do
  parser na Fase 1.
- A taxonomia de status (`STATUS`, `STATUS_ORDER`) e a lista de unidades
  (`UNITS`, `DESTINOS`) viraram seed de `@samu-cru/shared` desde a Fase 0.

## Regras de design não-negociáveis (do brief)

1. Densidade alta com legibilidade impecável (16-17 transportes pendentes
   simultâneos em 1440p sem scroll vertical).
2. Hierarquia visual brutal — destino + horário dominam o card.
3. Cor com significado, nunca decorativa. Não-status é neutro (zinc/slate).
4. Movimento parcimonioso — Framer Motion só em (a) pulse de urgentes,
   (b) entrada/saída do Sheet, (c) hover sutil.
5. Tipografia que respira.
6. Estado vazio é parte do design.
7. **Nunca exibir CPF/CNS na tela principal.** Mascarado também no modal —
   reveal exige clique + log de auditoria (`pii_revealed`).

Inspirações declaradas: **Linear, Vercel Dashboard, Raycast, Datadog**. Evitar:
Bootstrap admin templates, ThemeForest kits.

---

Atualize esta página quando portar telas para `apps/web` — registre a
correspondência arquivo do design → componente Next implementado.
