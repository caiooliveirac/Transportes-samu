# `@samu-cru/ingest`

Recebe as solicitações reais de transporte do grupo de WhatsApp e as
transforma em `transport_requests`.

```
WhatsApp (grupo UT APOIO)
        │
        ▼
whatsmeow-gw            container no magalu, 127.0.0.1:3080
  go-whatsapp-web-multidevice, pareado em 557197150415 "Chefe De Plantão"
  detém A ÚNICA sessão WhatsApp
        │
        ├──POST /hook──▶ giro-wa-adapter :3081  ──▶ Giro de Leitos
        └──POST /hook──▶ ESTE WORKER     :3082  ──▶ parser ──▶ Postgres
```

## Por que webhook e não Baileys

A versão anterior deste worker abria sessão Baileys própria no **mesmo
número** do chefe de plantão que o Giro de Leitos já usava. Cada
pareamento ocupa um slot de Linked Device: quando um re-pareava, o
WhatsApp revogava o slot do outro (`reason=401`, `loggedOut`), e os dois
entravam em loop de reconexão — a ponto de o worker ser desligado em
produção. Diagnóstico completo em `giro-de-leitos/docs/baileys-isolamento-2026-05-25.md`.

Uma sessão, N consumidores. Este worker não tem credencial de WhatsApp,
não pede QR e não tem pasta `auth/`.

## Contrato do webhook

`POST /` com corpo JSON do gateway
(`src/infrastructure/whatsapp/event_message.go` do upstream):

```json
{
  "event": "message",
  "device_id": "…",
  "payload": {
    "id": "3EB0…",                              // → wa_message_id (UNIQUE)
    "timestamp": "2026-08-14T02:25:34Z",
    "is_from_me": false,
    "chat_id": "557181082189-1589997108@g.us",  // → whitelist
    "from": "557181469133@s.whatsapp.net",
    "from_name": "Regulação UPA SANTO ANTONIO",
    "body": "texto da solicitação"
  }
}
```

Eventos aceitos: `message` e `message.edited` (que traz
`original_message_id` e dispara re-parse). O resto é descartado com 204.

Autenticação: header `X-Hub-Signature-256: sha256=<hmac-sha256-hex>` do
corpo cru, chave = `--webhook-secret` do gateway (default upstream:
`secret`). Configure em `WA_WEBHOOK_SECRET`.

O worker responde 2xx **depois** de ingerir. Erro vira 500 de propósito:
o gateway reenvia até 5x com backoff, e `wa_message_id` é UNIQUE, então
repetir é inofensivo.

`GET /` é health check: `{"status":"ok","worker":"<WORKER_ID>"}`.

## Env

| Variável | Default | Para quê |
|---|---|---|
| `DATABASE_URL` | — (obrigatória) | Postgres |
| `WORKER_ID` | `local-dev` | linha em `worker_heartbeat` |
| `WA_WEBHOOK_PORT` | `3082` | porta local (loopback) |
| `WA_WEBHOOK_SECRET` | `secret` | HMAC; vazio desliga a checagem |
| `WA_ALLOWED_CHATS` | vazio | JIDs separados por vírgula; vazio = todo `@g.us` |
| `DRY_RUN` | `false` | parseia e loga, não escreve transporte |
| `LOG_LEVEL` | `info` | |

## Rodar local

```bash
pnpm dev:ingest
```

E simular uma mensagem (com `WA_WEBHOOK_SECRET=` vazio no `.env.local`):

```bash
curl -X POST http://127.0.0.1:3082/ -H 'Content-Type: application/json' -d '{"event":"message","payload":{"id":"teste-1","chat_id":"557181082189-1589997108@g.us","from":"5571999999999@s.whatsapp.net","body":"Paciente para hemodiálise, destino HGE, sai da UPA San Martin"}}'
```

## Testes

```bash
pnpm --filter @samu-cru/ingest test
```
