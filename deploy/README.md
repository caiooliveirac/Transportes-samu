# Deploy — `transportes.mnrs.com.br`

Produção EC2 (mesma instância que serve `plantoes.mnrs.com.br` e
`checagem.mnrs.com.br`). Padrão: **self-hosted GitHub Actions runner +
PM2 + nginx + Postgres local**.

---

## Fluxo automático (depois do bootstrap)

```
push em main
  → GH Actions runner (rodando na própria EC2) é acionado
  → job `gate`:   pnpm lint, typecheck, build, test
  → job `deploy`: bash scripts/deploy-production.sh
                  ├── pnpm install --frozen-lockfile
                  ├── pnpm db:migrate
                  ├── pnpm build
                  ├── pm2 reload ecosystem.config.cjs --update-env
                  ├── curl :3005/api/health → ok=true
                  └── curl https://transportes.mnrs.com.br/api/health → 200
```

Se qualquer step falha, deploy aborta sem rolar reload — versão atual continua de pé.

---

## Bootstrap manual (uma vez na EC2)

### 1. Postgres

```bash
sudo -u postgres createuser transportes_samu
sudo -u postgres createdb -O transportes_samu transportes_samu
sudo -u postgres psql -c "ALTER USER transportes_samu WITH PASSWORD '<SENHA_FORTE>';"
```

### 2. Clone do repo

```bash
cd /home/ubuntu
git clone git@github.com:caiooliveirac/Transportes-samu.git transportes-samu
cd transportes-samu
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

**Importante**: o worker Baileys (`transportes-ingest`) vai imprimir QR no
log do PM2 logo após o primeiro start. Pegue com:

```bash
pm2 logs transportes-ingest --lines 200 --raw
```

Peça pro chefe escanear o QR. Depois disso, a sessão fica em
`apps/ingest/auth/` (gitignored) e sobrevive a restarts.

### 6. nginx + TLS

```bash
sudo cp deploy/nginx.conf.template /etc/nginx/sites-available/transportes.mnrs.com.br
sudo ln -s /etc/nginx/sites-available/transportes.mnrs.com.br /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d transportes.mnrs.com.br
```

### 7. DNS

Apontar `transportes.mnrs.com.br` A record para o IP público da EC2.

### 8. Validar

```bash
curl https://transportes.mnrs.com.br/api/health
# → { "ok": true, "runtimeGuard": "ok", "commit": "...", "worker": { "status": "open", ... } }
```

Abrir `https://transportes.mnrs.com.br` no browser, verificar painel + LiveBadge verde + WorkerBadge verde.

### 9. GH Actions runner

Se ainda não existir runner self-hosted na EC2 marcado pra esse repo, criar via UI:

`Settings → Actions → Runners → New self-hosted runner` (instruções da
própria página). Marcar com labels que combinem com o `runs-on:
self-hosted` do workflow.

A partir daí, `git push main` no laptop deploya automaticamente.

---

## Operação diária

### Reiniciar manualmente

```bash
ssh ubuntu@<EC2>
cd /home/ubuntu/transportes-samu
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

### Backup do `auth/`

A pasta `apps/ingest/auth/` contém as credenciais Baileys. **Perder essa pasta força novo QR scan no celular do chefe.** Cronjob diário sugerido:

```bash
0 3 * * * cd /home/ubuntu/transportes-samu && tar czf /home/ubuntu/backups/auth-$(date +\%F).tar.gz apps/ingest/auth/ && find /home/ubuntu/backups/ -name 'auth-*.tar.gz' -mtime +14 -delete
```

(Para encriptar, faça pipe pra `age` ou `gpg`.)

### Backup do banco

```bash
0 4 * * * pg_dump -U transportes_samu transportes_samu | gzip > /home/ubuntu/backups/db-$(date +\%F).sql.gz
```

---

## Troubleshooting

**Worker em "logged_out" no WorkerBadge:**
- WhatsApp removeu o aparelho do chefe. Limpar sessão e re-scanear:
  ```bash
  pm2 stop transportes-ingest
  rm -rf apps/ingest/auth
  pm2 start transportes-ingest
  pm2 logs transportes-ingest
  # Chefe escaneia novo QR
  ```

**Public health 502:**
- PM2 caiu ou nginx não está apontando pro :3005. Verificar:
  ```bash
  pm2 status                          # transportes-web online?
  sudo systemctl status nginx
  curl http://127.0.0.1:3005/api/health
  ```

**Deploy falha em "local health never reported ok":**
- App não inicializou. `pm2 logs transportes-web --lines 200` mostra o erro
  real. Provavelmente .env.production faltando ou DATABASE_URL errado.
- A versão anterior continua de pé (deploy só faz reload depois do health OK,
  mas como `reload` é graceful, processo antigo só morre se o novo subiu).
