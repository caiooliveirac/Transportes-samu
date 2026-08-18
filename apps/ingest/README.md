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
    "id": "3EB0…", // → wa_message_id (UNIQUE)
    "timestamp": "2026-08-14T02:25:34Z",
    "is_from_me": false,
    "chat_id": "557181082189-1589997108@g.us", // → whitelist
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

`GET /` é health check e contador:

```json
{
  "status": "ok",
  "worker": "magalu-prod-1",
  "received": 12,
  "stored": 5,
  "ingested": 3,
  "skipped": 7,
  "mediaOnly": 4,
  "rejected": 0,
  "lastWebhookAt": "2026-08-14T07:31:02.114Z"
}
```

`lastWebhookAt` avança em **qualquer** POST autenticado (inclusive ack e
presença), então é ela que responde "o gateway ainda está mandando pra
cá?" — com `LOG_LEVEL=info` um worker que recebe e filtra tudo não
apareceria no log. `received` conta só eventos de mensagem; `rejected`
soma corpo grande, JSON inválido e assinatura errada. `mediaOnly` é um
subconjunto de `skipped`: mensagem do grupo vigiado que veio só com mídia
(foto, áudio, documento) e portanto não tem o que parsear — `mediaOnly`
alto com `stored` baixo significa que o grupo manda print, não texto, e aí
nenhum ajuste de parser resolve. Os contadores zeram a cada restart.

## Corpus: toda mensagem do grupo é gravada

O worker grava em `whatsapp_messages` **toda** mensagem do grupo vigiado,
inclusive a que a heurística de `pipeline/filter.ts` rejeitou. O transporte
só é criado quando o filtro passa; o veredito
(`{pass, reason, hits}`) fica em `raw_json.filterVerdict`.

O motivo é direto: a mensagem que o filtro barrou é justamente a que mostra
onde o filtro erra. Descartando-a, não há material para ajustar filtro nem
parser — só a suspeita de que algo não entrou.

```bash
pnpm ingest:corpus                    # últimas 30, com veredito e confiança
pnpm ingest:corpus 100 --rejeitadas   # só o que o filtro barrou
pnpm ingest:corpus 100 --texto        # texto inteiro, sem truncar
```

Isso imprime texto clínico real (nome, CNS, CPF). Terminal seu — não colar
a saída em issue, chat ou documento.

## `ingest:replay` — quanto o parser está acertando

O `corpus` mostra o texto e o veredito do filtro; o `backfill` age. Faltava a
medida: **de tudo que o grupo mandou, quanto o parser acerta, e quanto disso
vira card visível?** Sem ela, "melhorou" fica no olhômetro de quem leu algumas
mensagens.

O `replay` roda filtro **e** parser sobre o corpus, sem escrever nada, e
recalcula o veredito com o código de hoje — não com o que ficou congelado em
`raw_json.filterVerdict`. O parser roda inclusive na mensagem barrada, que é
onde se vê se o filtro está jogando fora coisa que o parser saberia ler.

```bash
pnpm ingest:replay                    # últimas 30, campo a campo
pnpm ingest:replay 100 --rejeitadas   # só o que o filtro barra
pnpm ingest:replay 100 --min-hits 2   # simula outro limiar, sem editar código
pnpm ingest:replay 100 --resumo       # só o agregado — SEM dado de paciente
```

`--resumo` é a única saída colável: acerto por campo, quantos cards ficariam
sem coluna, distribuição de status e tipo de viagem. Rodar antes e depois de
mexer em extrator é o que mostra se a mudança valeu.

Uma linha do resumo merece atenção: **sem coluna**. É o transporte cuja origem
o parser não reconheceu — ele existe no banco e vai para o balde "Origem não
identificada" do painel, esperando alguém informar a unidade na gaveta.

## Env

| Variável            | Default         | Para quê                                                                          |
| ------------------- | --------------- | --------------------------------------------------------------------------------- |
| `DATABASE_URL`      | — (obrigatória) | Postgres                                                                          |
| `WORKER_ID`         | `local-dev`     | linha em `worker_heartbeat`                                                       |
| `WA_WEBHOOK_PORT`   | `3082`          | porta do webhook                                                                  |
| `WA_WEBHOOK_HOST`   | `0.0.0.0`       | interface de bind; `127.0.0.1` não é alcançável pelo container                    |
| `WA_WEBHOOK_SECRET` | `secret`        | HMAC; vazio desliga a checagem — o worker recusa subir se o bind não for loopback |
| `WA_ALLOWED_CHATS`  | vazio           | JIDs separados por vírgula; vazio = todo `@g.us`. Define o que entra no corpus    |
| `DRY_RUN`           | `false`         | parseia e loga, não escreve transporte                                            |
| `LOG_LEVEL`         | `info`          |                                                                                   |

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

## Bind: por que não é loopback

O gateway roda em container e chega pelo `host.docker.internal`, que
resolve para o host-gateway do Docker (`172.17.0.1`) — **não** para o
loopback do host. Um worker escutando só em `127.0.0.1` faz todo POST do
gateway morrer em `context deadline exceeded`, e o gateway desiste após 5
tentativas. O `giro-wa-adapter` escuta em `0.0.0.0` pelo mesmo motivo.

Isso não expõe a porta na internet: o `ufw` do magalu tem `INPUT DROP` e
libera só SSH/80/443. O que protege a porta é o HMAC — por isso o worker
**recusa subir** com `WA_WEBHOOK_SECRET` vazio e bind não-loopback.
