/**
 * PM2 config oficial pra produção (EC2 transportes.mnrs.com.br).
 *
 * Dois processos no mesmo checkout:
 *   - transportes-web      Next.js standalone server (porta 3008)
 *   - transportes-ingest   Worker Baileys (sem porta — só Postgres + WhatsApp)
 *
 * Ambos carregam /home/ubuntu/transportes-samu/.env.production via env_file
 * — DATABASE_URL e WA_ALLOWED_CHATS são lidos daí. Restart sempre com
 *   `pm2 reload ecosystem.config.cjs --update-env`
 * pra garantir que mudanças no .env.production atinjam os dois processos
 * (PLANNING §12 + DEPLOY.md do plantoes).
 *
 * GIT_COMMIT_SHA é injetado pelo workflow GH Actions a partir de github.sha
 * e usado pelo endpoint /api/health pra surface da versão em uso.
 */
module.exports = {
  apps: [
    {
      name: "transportes-web",
      cwd: "/home/ubuntu/transportes-samu",
      env_file: "/home/ubuntu/transportes-samu/.env.production",
      script: "pnpm",
      args: "--filter @samu-cru/web start",
      env: {
        NODE_ENV: "production",
        PORT: "3008",
        RUNTIME_SOURCE_OF_TRUTH: "pm2",
        GIT_COMMIT_SHA: process.env.GIT_COMMIT_SHA || "unknown",
      },
      // Restart automatic if memory cresce — Next costuma estabilizar < 400MB.
      max_memory_restart: "600M",
      // Web é stateless: kill-on-fail rápido é OK.
      restart_delay: 2_000,
      max_restarts: 20,
    },
    {
      name: "transportes-ingest",
      cwd: "/home/ubuntu/transportes-samu",
      env_file: "/home/ubuntu/transportes-samu/.env.production",
      script: "pnpm",
      args: "--filter @samu-cru/ingest start",
      env: {
        NODE_ENV: "production",
        RUNTIME_SOURCE_OF_TRUTH: "pm2",
        WORKER_ID: "ec2-prod",
        GIT_COMMIT_SHA: process.env.GIT_COMMIT_SHA || "unknown",
      },
      // Worker tem estado em apps/ingest/auth/ — kill-on-fail menos agressivo
      // para sobreviver a flakeness de rede; backoff maior pra evitar
      // ban do servidor WhatsApp em reconnect loop.
      max_memory_restart: "300M",
      restart_delay: 10_000,
      max_restarts: 10,
    },
  ],
};
