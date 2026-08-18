import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    /**
     * `extractDeadline` usa `setHours()`, ou seja o fuso do PROCESSO, e as
     * fixtures trazem `receivedAt` em UTC. Sem fixar aqui, as quatro
     * fixtures com horário passam ou falham conforme a máquina: verdes no
     * runner self-hosted (que fica no Brasil, como a produção) e vermelhas
     * em qualquer container UTC. Passavam por acidente de geografia.
     *
     * Fixar torna a suíte determinística. Não resolve o acoplamento em si —
     * o parser continua dependendo do fuso de quem o roda, e mover a
     * produção para uma máquina em UTC deslocaria todo prazo em 3h sem que
     * teste nenhum reclamasse.
     */
    env: {
      TZ: "America/Sao_Paulo",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli.ts", "src/index.ts"],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 70,
      },
      reporter: ["text", "json-summary"],
    },
  },
});
