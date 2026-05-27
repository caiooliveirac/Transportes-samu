/**
 * Seed/rotate dos usuários nominais (reguladores e admins).
 *
 * - 6 reguladores + 4 admins, listados abaixo.
 * - Idempotente para identidade (email/role/nome): re-executar atualiza
 *   sem trocar a senha existente.
 * - NÃO idempotente para senha: gera uma quando o usuário não existe,
 *   ou quando passado --rotate (rotaciona TODAS).
 * - Imprime tabela `nome | login | senha | papel` em stdout — anote.
 */
import { loadMonorepoEnvFromCwd } from "./load-env";

loadMonorepoEnvFromCwd();

import { eq } from "drizzle-orm";
import { db } from "./client";
import { users } from "./schema";
import { generateReadablePassword, hashPassword } from "./password";

interface Seed {
  email: string;
  name: string;
  role: "regulador" | "admin";
}

const SEED: Seed[] = [
  { email: "luiz", name: "Luiz", role: "regulador" },
  { email: "lucyane", name: "Lucyane", role: "regulador" },
  { email: "ana.paula", name: "Ana Paula", role: "regulador" },
  { email: "ana.luiza", name: "Ana Luiza", role: "regulador" },
  { email: "carolina.tanajura", name: "Carolina Tanajura", role: "regulador" },
  { email: "vaner.paulo", name: "Vaner Paulo", role: "regulador" },
  { email: "ivan.paiva", name: "Ivan Paiva", role: "admin" },
  { email: "caio.oliveira", name: "Caio Oliveira", role: "admin" },
  { email: "antonio.fernando", name: "Antonio Fernando", role: "admin" },
  { email: "maria.auxiliadora", name: "Maria Auxiliadora", role: "admin" },
];

const ROTATE = process.argv.includes("--rotate");

interface OutRow {
  nome: string;
  login: string;
  senha: string;
  papel: string;
  estado: "criado" | "rotacionado" | "atualizado" | "existente";
}

async function main() {
  const existing = await db.select().from(users);
  const byEmail = new Map(existing.map((u) => [u.email, u] as const));

  const out: OutRow[] = [];

  for (const s of SEED) {
    const found = byEmail.get(s.email);
    const willRotate = ROTATE || !found;
    const plain = willRotate ? generateReadablePassword() : "(inalterada)";

    if (!found) {
      const passwordHash = await hashPassword(plain);
      await db.insert(users).values({
        email: s.email,
        name: s.name,
        passwordHash,
        role: s.role,
        isActive: true,
      });
      out.push({
        nome: s.name,
        login: s.email,
        senha: plain,
        papel: s.role,
        estado: "criado",
      });
    } else if (ROTATE) {
      const passwordHash = await hashPassword(plain);
      await db
        .update(users)
        .set({ name: s.name, role: s.role, passwordHash, isActive: true })
        .where(eqEmail(s.email));
      out.push({
        nome: s.name,
        login: s.email,
        senha: plain,
        papel: s.role,
        estado: "rotacionado",
      });
    } else {
      // Atualiza nome/role sem mexer na senha existente
      if (found.name !== s.name || found.role !== s.role || !found.isActive) {
        await db
          .update(users)
          .set({ name: s.name, role: s.role, isActive: true })
          .where(eqEmail(s.email));
        out.push({
          nome: s.name,
          login: s.email,
          senha: "(inalterada)",
          papel: s.role,
          estado: "atualizado",
        });
      } else {
        out.push({
          nome: s.name,
          login: s.email,
          senha: "(inalterada)",
          papel: s.role,
          estado: "existente",
        });
      }
    }
  }

  const W = {
    nome: Math.max(...out.map((r) => r.nome.length), 4),
    login: Math.max(...out.map((r) => r.login.length), 5),
    senha: Math.max(...out.map((r) => r.senha.length), 5),
    papel: Math.max(...out.map((r) => r.papel.length), 5),
    estado: Math.max(...out.map((r) => r.estado.length), 6),
  };

  const sep =
    "+-" +
    "-".repeat(W.nome) +
    "-+-" +
    "-".repeat(W.login) +
    "-+-" +
    "-".repeat(W.senha) +
    "-+-" +
    "-".repeat(W.papel) +
    "-+-" +
    "-".repeat(W.estado) +
    "-+";

  console.log("\nUsuários nominais — anotar e distribuir:\n");
  console.log(sep);
  console.log(
    `| ${"nome".padEnd(W.nome)} | ${"login".padEnd(W.login)} | ${"senha".padEnd(W.senha)} | ${"papel".padEnd(W.papel)} | ${"estado".padEnd(W.estado)} |`,
  );
  console.log(sep);
  for (const r of out) {
    console.log(
      `| ${r.nome.padEnd(W.nome)} | ${r.login.padEnd(W.login)} | ${r.senha.padEnd(W.senha)} | ${r.papel.padEnd(W.papel)} | ${r.estado.padEnd(W.estado)} |`,
    );
  }
  console.log(sep);
  const criados = out.filter((r) => r.estado === "criado").length;
  const rotacionados = out.filter((r) => r.estado === "rotacionado").length;
  const atualizados = out.filter((r) => r.estado === "atualizado").length;
  console.log(
    `\n${out.length} usuários · ${criados} criados · ${rotacionados} rotacionados · ${atualizados} atualizados\n`,
  );
  if (!ROTATE && out.some((r) => r.estado === "existente" || r.estado === "atualizado")) {
    console.log(
      "Pra ver senhas dos já existentes, rotacione: pnpm db:seed:users --rotate\n",
    );
  }
}

function eqEmail(email: string) {
  return eq(users.email, email);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
