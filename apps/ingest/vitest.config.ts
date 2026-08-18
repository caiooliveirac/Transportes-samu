import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    /**
     * `src/env.ts` exige DATABASE_URL no import — é ele que impede o worker
     * de subir sem banco. Os testes não tocam no banco (o cliente Drizzle é
     * lazy), mas importam módulos que puxam o env. Placeholder explícito,
     * para não depender de .env.local na máquina de ninguém nem no CI.
     */
    env: {
      DATABASE_URL: "postgres://test@localhost:5432/test",
    },
  },
});
