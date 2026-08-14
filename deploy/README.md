# Deploy — `transportes.mnrs.com.br`

Produção no **magalu** (`ssh magalu`), mesmo host de `plantoes`, `giro`,
`escala` e do gateway WhatsApp. Padrão: **PM2 + nginx + Postgres nativo**.

- checkout: `/home/ubuntu/Transportes-samu`
- web: PM2 `transportes-web`, `127.0.0.1:3020`
- ingest: PM2 `transportes-ingest`, `127.0.0.1:3082` (webhook do gateway)
- banco: `transportes` (Postgres nativo do host, role `transportes`)
- nginx: **não** usa `deploy/nginx.conf.template`. O roteamento é o mapa
  central `/etc/nginx/sites-available/mnrs.conf`
  (`transportes.mnrs.com.br 3020;`), compartilhado com os outros apps.

> A EC2 que hospedava isso morreu; o runner self-hosted
> `actions-runner-transportes` **não** existe no magalu. Até alguém
> registrar um, `.github/workflows/deploy.yml` não roda e o deploy é
> `ssh magalu 'cd /home/ubuntu/Transportes-samu && bash scripts/deploy-production.sh'`.

---

## Fluxo automático (depois do bootstrap)

```
push em main
  → GH Actions runner self-hosted no host de produção é acionado
  → job `gate`:   pnpm lint, typecheck, build, test
  → job `deploy`: bash scripts/deploy-production.sh
                  ├── pnpm install --frozen-lockfile
                  ├── pnpm db:migrate
                  ├── pnpm build
                  ├── pm2 reload ecosystem.config.cjs --update-env
                  ├── curl :3020/api/health → ok=true
                  └── curl https://transportes.mnrs.com.br/api/health → 200
```

Se qualquer step falha, deploy aborta sem rolar reload — versão atual continua de pé.

---

## Bootstrap manual (uma vez por host)

### 1. Postgres

Já existe no magalu: role e banco `transportes`. Em host novo:

```bash
sudo -u postgres createuser transportes
sudo -u postgres createdb -O transportes transportes
sudo -u postgres psql -c "ALTER USER transportes WITH PASSWORD '<SENHA_FORTE>';"
```

### 2. Clone do repo

```bash
cd /home/ubuntu
git clone git@github.com:caiooliveirac/Transportes-samu.git
cd Transportes-samu
```

### 3. Env de produção

```bash
cp deploy/.env.production.example .env.production
# Edite .env.production com a senha do Postgres e o WA_ALLOWED_CHATS real.
chmod 600 .env.production
```

### 4. Instalar deps + DB

```bash
pnpm install --frozen-lockfile
set -a; source .env.production; set +a
pnpm db:migrate
pnpm db:seed         # opcional: 17 unidades de Salvador
```

### 5. PM2 — primeiro start

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup       # imprime comando sudo — copia e executa
```

**Importante**: `transportes-ingest` **não** abre sessão WhatsApp e não
pede QR. Ele escuta webhooks do gateway `whatsmeow-gw` em
`127.0.0.1:3082`. Registre este worker como segundo destino do gateway
(o primeiro é o `giro-wa-adapter`, do Giro de Leitos):

```bash
docker inspect whatsmeow-gw --format '{{json .Config.Env}}'   # anote o env atual
```

Recrie o container com os dois destinos na variável (é lista separada por
vírgula; a sessão vive no volume, então **não** precisa re-parear):

```bash
WHATSAPP_WEBHOOK=http://host.docker.internal:3081/hook,http://host.docker.internal:3082/hook
```

Confira que subiu:

```bash
curl -s http://127.0.0.1:3082/ | jq          # {"status":"ok","worker":"..."}
pm2 logs transportes-ingest --lines 50
```

### 6. nginx

No magalu já está feito: o mapa central tem
`transportes.mnrs.com.br 3020;` e o TLS é o certificado curinga da
Cloudflare para `*.mnrs.com.br`. O `location /api/stream` do mesmo arquivo
desliga o buffer e estende o timeout — o dashboard usa SSE, e o
`proxy_read_timeout 120s` do `location /` cortaria a conexão a cada 2min.

Em host novo sem mapa central, use `deploy/nginx.conf.template`:

```bash
sudo cp deploy/nginx.conf.template /etc/nginx/sites-available/transportes.mnrs.com.br
sudo ln -s /etc/nginx/sites-available/transportes.mnrs.com.br /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d transportes.mnrs.com.br
```

### 7. DNS

`transportes.mnrs.com.br` aponta para o proxy da Cloudflare, que fala com
o magalu. Nada a fazer se o curinga `*.mnrs.com.br` já resolve.

### 8. Validar

```bash
curl https://transportes.mnrs.com.br/api/health
# → { "ok": true, "runtimeGuard": "ok", "commit": "...", "worker": { "status": "open", ... } }
```

Abrir `https://transportes.mnrs.com.br` no browser, verificar painel + LiveBadge verde + WorkerBadge verde.

### 9. GH Actions runner (pendente no magalu)

Não existe runner marcado pra este repo no magalu — enquanto isso,
deploy é manual pelo script. Para automatizar, criar via UI:

`Settings → Actions → Runners → New self-hosted runner` (instruções da
própria página). Marcar com labels que combinem com o `runs-on:
self-hosted` do workflow.

A partir daí, `git push main` no laptop deploya automaticamente.

---

## Operação diária

### Reiniciar manualmente

```bash
ssh magalu
cd /home/ubuntu/Transportes-samu
GIT_COMMIT_SHA=$(git rev-parse HEAD) pm2 reload ecosystem.config.cjs --update-env
```

### Ver logs

```bash
pm2 logs transportes-web --lines 100
pm2 logs transportes-ingest --lines 100
pm2 logs                              # ambos
```

### Health check

```bash
curl https://transportes.mnrs.com.br/api/health | jq
curl https://transportes.mnrs.com.br/api/health/worker | jq
```

### Sessão WhatsApp

Não há sessão para guardar aqui. A credencial do número do chefe de
plantão vive no volume do container `whatsmeow-gw` e é responsabilidade
da infra do gateway (compartilhada com o Giro de Leitos). Perder esse
volume força novo pareamento e derruba os **dois** consumidores.

### Backup do banco

```bash
0 4 * * * pg_dump -U transportes transportes | gzip > /home/ubuntu/backups/db-$(date +\%F).sql.gz
```

---

## Troubleshooting

**Worker "closed" no WorkerBadge, ou nenhum transporte novo entrando:**
1. O worker está de pé e o gateway está falando com ele?
   `curl -s http://127.0.0.1:3082/ | jq` — `lastWebhookAt` recente prova
   que os POSTs chegam; `received`/`ingested`/`skipped` dizem o que
   aconteceu com eles. `lastWebhookAt: null` = nada chegou desde o último
   restart, pule para o passo 2. Sem resposta = `pm2 logs transportes-ingest`.
2. O gateway ainda lista este destino?
   `docker inspect whatsmeow-gw --format '{{json .Config.Env}}' | grep WEBHOOK`
   — um `docker run` de manutenção pode ter recriado o container só com
   o hook do Giro.
3. O gateway ainda está pareado?
   `curl -s -u <basic-auth> http://127.0.0.1:3080/app/devices`
4. Assinatura batendo? `webhook signature mismatch` no log do worker
   significa `WA_WEBHOOK_SECRET` diferente do `--webhook-secret` do
   gateway — o worker devolve 401 e o gateway desiste após 5 tentativas.
5. Chegou mas não virou transporte? Log `webhook event skipped` diz o
   motivo (`chat_not_allowed` = `WA_ALLOWED_CHATS` errado; `filtered:` =
   heurística de `pipeline/filter.ts` barrou).

**Public health 502:**
- PM2 caiu ou o mapa do nginx não aponta pro :3020. Verificar:
  ```bash
  pm2 status                          # transportes-web online?
  grep transportes /etc/nginx/sites-available/mnrs.conf
  curl http://127.0.0.1:3020/api/health
  ```

**Deploy falha em "local health never reported ok":**
- App não inicializou. `pm2 logs transportes-web --lines 200` mostra o erro
  real. Provavelmente .env.production faltando ou DATABASE_URL errado.
- A versão anterior continua de pé (deploy só faz reload depois do health OK,
  mas como `reload` é graceful, processo antigo só morre se o novo subiu).
