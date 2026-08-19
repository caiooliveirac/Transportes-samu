/**
 * Lê a fila do bot em modo sombra: o que ele TERIA perguntado no grupo.
 *
 *   pnpm ingest:bot-sombra        # últimas 30
 *   pnpm ingest:bot-sombra 100
 *
 * Nada aqui envia nada — não existe caminho de envio no código. Este
 * script existe para o usuário ler um dia inteiro de perguntas antes de
 * decidir se o bot fala.
 */
import "../env";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@samu-cru/db";

const limit = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 30);

async function main(): Promise<void> {
  const rows = await db
    .select({
      id: schema.botMessages.id,
      kind: schema.botMessages.kind,
      body: schema.botMessages.body,
      createdAt: schema.botMessages.createdAt,
      status: schema.botMessages.status,
      gatilho: schema.whatsappMessages.rawText,
    })
    .from(schema.botMessages)
    .leftJoin(
      schema.whatsappMessages,
      eq(schema.botMessages.triggerMessageId, schema.whatsappMessages.id),
    )
    .orderBy(desc(schema.botMessages.createdAt))
    .limit(limit);

  if (rows.length === 0) {
    console.log(
      "fila vazia — o bot ainda não teve motivo para perguntar (ou o worker não recebeu mensagem nova)",
    );
    return;
  }

  console.log(`${rows.length} pergunta(s) — NENHUMA foi enviada\n`);
  for (const r of rows) {
    const quando = r.createdAt.toISOString().slice(0, 16).replace("T", " ");
    console.log(`── #${r.id} · ${quando} · ${r.kind} · ${r.status}`);
    console.log(`   gatilho: ${(r.gatilho ?? "").replace(/\n+/g, " | ").slice(0, 80)}`);
    console.log(`   diria:   ${r.body}\n`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
