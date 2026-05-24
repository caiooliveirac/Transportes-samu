# Fixtures do parser

Mensagens WhatsApp reais (ou plausíveis) usadas como ground truth dos testes.

## Convenção de nome

```
<unidade-origem>-<categoria>.txt
```

Exemplos:
- `upa-piraja-internamento.txt` — mensagem estruturada, alta confiança
- `upa-brotas-baixa-confianca.txt` — mensagem informal, baixa confiança

## Adicionando fixtures

Para cada fixture `.txt`, adicione um par `.expected.json` ao lado quando
implementar os testes da Fase 1, contendo o `ParseResult` esperado. Os
testes do `@samu-cru/parser` carregam ambos e comparam.

## Anonimização

Nomes, datas e identificadores nesses fixtures são plausíveis mas não
correspondem a pacientes reais. Se você for adicionar fixture a partir de
uma mensagem de produção, anonimize **antes** de salvar:
- Trocar nome por nome plausível
- Embaralhar últimos dígitos de CNS/CPF
- Subtrair/adicionar dias da data de procedimento

Origem dos dois fixtures iniciais: `design-refs/.../project/src/data.jsx`
(transportes T-1001 e T-1011, campo `mensagem`).
