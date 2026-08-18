/**
 * Recupera o que o pipeline deixou para trás:
 *
 *  - sem `--reparse`: cria transporte para mensagem APROVADA pelo filtro
 *    que ficou sem um (o worker rodou em produção com `DRY_RUN=true`
 *    herdado do `.env` da raiz — parseava, logava e não gravava)
 *  - com `--reparse`: re-roda o parser sobre mensagem que JÁ tem
 *    transporte e atualiza os campos. É como um caso parseado por uma
 *    versão pior do parser se corrige, sem duplicar nada
 *
 *   pnpm ingest:backfill                     # simulação da criação
 *   pnpm ingest:backfill --aplicar           # cria os transportes
 *   pnpm ingest:backfill --reparse           # simulação do re-parse
 *   pnpm ingest:backfill --reparse --aplicar # atualiza os existentes
 *   pnpm ingest:backfill 50 --aplicar        # limita às 50 mais recentes
 *
 * O re-parse não mexe em status de caso que o regulador já moveu; o único
 * avanço é `pendente_revisao` → `novo` quando o parser preencheu o que
 * faltava. Também não sobrescreve campo corrigido à mão — ele imprime o que
 * preservou, porque é justamente depois de melhorar o parser que há mais
 * correção acumulada para perder.
 *
 * Respeita DRY_RUN do ambiente: com DRY_RUN=true nada é escrito mesmo com
 * --aplicar (o próprio `createTransportFromMessage` recusa).
 *
 * ATENÇÃO: imprime nome de paciente. Rode em terminal seu.
 */
import "../env";
import { desc, isNotNull, isNull, sql } from "drizzle-orm";
import { db, schema } from "@samu-cru/db";

import {
  createTransportFromMessage,
  reparseTransportFromMessage,
} from "../pipeline/ingest";

const args = process.argv.slice(2);
const limit = Number(args.find((a) => /^\d+$/.test(a)) ?? 200);
const apply = args.includes("--aplicar");
const reparse = args.includes("--reparse");

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
    .where(
      reparse
        ? isNotNull(schema.transportRequests.id)
        : isNull(schema.transportRequests.id),
    )
    .orderBy(desc(schema.whatsappMessages.receivedAt))
    .limit(limit);

  // Só o que a heurística aprovou. Mensagem barrada é corpus, não caso —
  // rebaixar isso aqui criaria transporte a partir de cobrança e conversa.
  const candidatas = rows.filter(
    (r) => (r.rawJson as { filterVerdict?: Verdict } | null)?.filterVerdict?.pass === true,
  );

  if (candidatas.length === 0) {
    console.log(
      reparse
        ? "nenhum transporte para re-parsear"
        : "nada a recuperar — toda mensagem aprovada já tem transporte",
    );
    return;
  }

  const acao = reparse ? "re-parsear" : "criar";
  console.log(
    `${candidatas.length} mensagem(ns) a ${acao}` +
      (apply ? " — aplicando" : ` — simulação (use --aplicar para ${acao})`),
  );

  for (const r of candidatas.slice().reverse()) {
    const quando = r.receivedAt.toISOString().slice(0, 16).replace("T", " ");
    const resumo = r.rawText.replace(/\n+/g, " | ").slice(0, 90);

    if (!apply) {
      console.log(`\n── #${r.id} · ${quando}\n${resumo}`);
      continue;
    }

    if (reparse) {
      const res = await reparseTransportFromMessage({
        whatsappMessageDbId: r.id,
        rawText: r.rawText,
        receivedAt: r.receivedAt,
      });
      const preservados =
        res.preserved.length > 0
          ? ` · preservou correção manual: ${res.preserved.join(", ")}`
          : "";
      console.log(
        `\n── #${r.id} · ${quando} · ${res.updated} atualizado(s)` +
          ` · conf=${res.globalConfidence}${res.promoted ? " · promovido a novo" : ""}` +
          `${preservados}\n${resumo}`,
      );
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
