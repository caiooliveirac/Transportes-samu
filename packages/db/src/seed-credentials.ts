/**
 * Seed/rotate de credenciais das unidades pra o form web.
 *
 * - Idempotente para usernames: cada unidade tem `username = unit.code`.
 * - NÃO idempotente para senhas: gera nova senha SE não existe registro
 *   ainda; pra rotacionar usa `pnpm db:seed:credentials --rotate`.
 * - Imprime tabela `unidade | login | senha` em stdout — a senha em
 *   claro só aparece nesse momento (depois fica só hash no DB).
 *
 * Uso:
 *   pnpm db:seed:credentials           # cria as que faltam, ignora as existentes
 *   pnpm db:seed:credentials --rotate  # rotaciona TODAS as senhas
 */
import { loadMonorepoEnvFromCwd } from "./load-env";

loadMonorepoEnvFromCwd();

import { db } from "./client";
import { units, unitCredentials } from "./schema";
import { eq } from "drizzle-orm";
import { generateReadablePassword, hashPassword } from "./password";

const ROTATE = process.argv.includes("--rotate");

interface OutRow {
  unidade: string;
  login: string;
  senha: string;
  estado: "criado" | "rotacionado" | "existente";
}

async function main() {
  const allUnits = await db.select().from(units);
  const existing = await db.select().from(unitCredentials);
  const existingByUnit = new Map(existing.map((c) => [c.unitId, c] as const));

  const out: OutRow[] = [];

  for (const unit of allUnits) {
    const username = unit.code;
    const existsForUnit = existingByUnit.get(unit.id);

    if (existsForUnit && !ROTATE) {
      out.push({
        unidade: unit.name,
        login: existsForUnit.username,
        senha: "(inalterada)",
        estado: "existente",
      });
      continue;
    }

    const plain = generateReadablePassword();
    const passwordHash = await hashPassword(plain);

    if (existsForUnit) {
      await db
        .update(unitCredentials)
        .set({ username, passwordHash, updatedAt: new Date() })
        .where(eq(unitCredentials.unitId, unit.id));
      out.push({
        unidade: unit.name,
        login: username,
        senha: plain,
        estado: "rotacionado",
      });
    } else {
      await db.insert(unitCredentials).values({
        unitId: unit.id,
        username,
        passwordHash,
      });
      out.push({
        unidade: unit.name,
        login: username,
        senha: plain,
        estado: "criado",
      });
    }
  }

  const widthUnit = Math.max(...out.map((r) => r.unidade.length), 8);
  const widthLogin = Math.max(...out.map((r) => r.login.length), 5);
  const widthSenha = Math.max(...out.map((r) => r.senha.length), 5);
  const widthEstado = Math.max(...out.map((r) => r.estado.length), 6);

  const sep = `+-${"-".repeat(widthUnit)}-+-${"-".repeat(widthLogin)}-+-${"-".repeat(widthSenha)}-+-${"-".repeat(widthEstado)}-+`;
  console.log("\nCredenciais das unidades — anotar e distribuir:\n");
  console.log(sep);
  console.log(
    `| ${"unidade".padEnd(widthUnit)} | ${"login".padEnd(widthLogin)} | ${"senha".padEnd(widthSenha)} | ${"estado".padEnd(widthEstado)} |`,
  );
  console.log(sep);
  for (const r of out) {
    console.log(
      `| ${r.unidade.padEnd(widthUnit)} | ${r.login.padEnd(widthLogin)} | ${r.senha.padEnd(widthSenha)} | ${r.estado.padEnd(widthEstado)} |`,
    );
  }
  console.log(sep);
  console.log(
    `\n${out.length} unidades · ${out.filter((r) => r.estado === "criado").length} criadas · ${out.filter((r) => r.estado === "rotacionado").length} rotacionadas · ${out.filter((r) => r.estado === "existente").length} já existiam\n`,
  );
  if (!ROTATE && out.some((r) => r.estado === "existente")) {
    console.log(
      "Pra ver as senhas das já existentes, rotacione com: pnpm db:seed:credentials --rotate\n",
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
