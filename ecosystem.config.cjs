/**
 * PM2 config oficial pra produção (EC2 transportes.mnrs.com.br).
 *
 * Apenas web. O worker Baileys (transportes-ingest) foi desligado:
 * estava em loop de reconexão por disputar sessão WhatsApp com outra
 * app no mesmo EC2 e derrubando o host. O código de apps/ingest fica
 * dormente no repo. A reativação depende de número WhatsApp dedicado.
 *
 * O deploy script garante `pm2 delete transportes-ingest` antes do
 * reload pra remover o processo legado se ainda estiver carregado.
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
  ],
};
