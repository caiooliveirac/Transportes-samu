import type { NextConfig } from "next";
import { config as loadDotenv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Next.js carrega .env.* a partir de `apps/web/`. Em monorepo pnpm, o
// .env.local fica na raiz para que o worker (apps/ingest) e scripts do
// Drizzle (packages/db) compartilhem o mesmo arquivo. Carregamos do root
// aqui — uma vez no boot do dev/build server, persiste no process.env
// para qualquer route handler.
const here = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(here, "..", "..");
loadDotenv({ path: resolve(monorepoRoot, ".env.local"), override: false });
loadDotenv({ path: resolve(monorepoRoot, ".env"), override: false });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@samu-cru/shared", "@samu-cru/db"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
