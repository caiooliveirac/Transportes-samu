import { defineConfig } from "drizzle-kit";
import { loadMonorepoEnvFromCwd } from "./src/load-env";

loadMonorepoEnvFromCwd();

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is required — copy .env.example to .env.local at the repo root",
  );
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
