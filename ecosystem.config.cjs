/**
 * PM2 config oficial pra produção (transportes.mnrs.com.br, magalu).
 *
 * `transportes-ingest` voltou. Ele foi desligado quando era um worker
 * Baileys: disputava slot de Linked Device com o Giro de Leitos no MESMO
 * número (chefe de plantão) e vivia em loop de reconexão. Agora não abre
 * sessão nenhuma — é um servidor HTTP em 127.0.0.1:3082 que recebe os
 * webhooks do container `whatsmeow-gw`, o mesmo gateway que já alimenta o
 * Giro. Uma sessão, dois consumidores.
 *
 * O gateway precisa listar os dois destinos:
 *   WHATSAPP_WEBHOOK=http://host.docker.internal:3081/hook,\
 *                    http://host.docker.internal:3082/hook
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
      max_memory_restart: "600M",
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
        GIT_COMMIT_SHA: process.env.GIT_COMMIT_SHA || "unknown",
      },
      max_memory_restart: "400M",
      restart_delay: 2_000,
      max_restarts: 20,
    },
  ],
};
