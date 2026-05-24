import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required (see .env.example)");
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
