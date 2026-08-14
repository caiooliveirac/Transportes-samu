/**
 * Cria os transportes das mensagens que o filtro APROVOU mas que ficaram
 * sem transporte no banco.
 *
 * Existe porque o worker rodou em produção com `DRY_RUN=true` herdado do
 * `.env` da raiz: parseava, logava e não gravava. As solicitações do dia
 * ficaram só em `whatsapp_messages`.
 *
 *   pnpm ingest:backfill              # só mostra o que faria (padrão)
 *   pnpm ingest:backfill --aplicar    # cria os transportes
 *   pnpm ingest:backfill 50 --aplicar # limita às 50 mais recentes
 *
 * Respeita DRY_RUN do ambiente: com DRY_RUN=true nada é escrito mesmo com
 * --aplicar (o próprio `createTransportFromMessage` recusa).
 *
 * ATENÇÃO: imprime nome de paciente. Rode em terminal seu.
 */
import "../env";
import { desc, isNull, sql } from "drizzle-orm";
import { db, schema } from "@samu-cru/db";

import { createTransportFromMessage } from "../pipeline/ingest";

const args = process.argv.slice(2);
const limit = Number(args.find((a) => /^\d+$/.test(a)) ?? 200);
const apply = args.includes("--aplicar");

interface Verdict {
  pass?: boolean;
}

async function main(): Promise<void> {
  const rows = await db
    .select({
      id: schema.whatsappMessages.id,
      receivedAt: schema.whatsappMessages.receivedAt,
      rawText: schema.whatsappMessages.rawText,
      rawJson: schema.whatsappMessages.rawJson,
    })
    .from(schema.whatsappMessages)
    .leftJoin(
      schema.transportRequests,
      sql`${schema.transportRequests.whatsappMessageId} = ${schema.whatsappMessages.id}`,
    )
    .where(isNull(schema.transportRequests.id))
    .orderBy(desc(schema.whatsappMessages.receivedAt))
    .limit(limit);

  // Só o que a heurística aprovou. Mensagem barrada é corpus, não caso —
  // rebaixar isso aqui criaria transporte a partir de cobrança e conversa.
  const candidatas = rows.filter(
    (r) => (r.rawJson as { filterVerdict?: Verdict } | null)?.filterVerdict?.pass === true,
  );

  if (candidatas.length === 0) {
    console.log("nada a recuperar — toda mensagem aprovada já tem transporte");
    return;
  }

  console.log(
    `${candidatas.length} mensagem(ns) aprovada(s) sem transporte` +
      (apply ? " — criando" : " — simulação (use --aplicar para criar)"),
  );

  for (const r of candidatas.slice().reverse()) {
    const quando = r.receivedAt.toISOString().slice(0, 16).replace("T", " ");
    const resumo = r.rawText.replace(/\n+/g, " | ").slice(0, 90);

    if (!apply) {
      console.log(`\n── #${r.id} · ${quando}\n${resumo}`);
      continue;
    }

    const created = await createTransportFromMessage({
      whatsappMessageDbId: r.id,
      rawText: r.rawText,
      receivedAt: r.receivedAt,
    });
    console.log(
      `\n── #${r.id} · ${quando} · ${created.transportId ?? "NÃO CRIADO (DRY_RUN)"}` +
        ` · ${created.status} · conf=${created.globalConfidence}\n${resumo}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
