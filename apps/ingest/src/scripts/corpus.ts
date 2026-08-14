/**
 * Lê o corpus de mensagens reais do grupo — o material para decidir como
 * ajustar filtro e parser.
 *
 * O worker grava TODA mensagem do grupo vigiado, inclusive a que a
 * heurística rejeitou, com o veredito em `raw_json.filterVerdict`. Este
 * script mostra as duas colunas que importam juntas: o que o filtro
 * decidiu e se virou transporte.
 *
 *   pnpm ingest:corpus              # últimas 30
 *   pnpm ingest:corpus 100          # últimas 100
 *   pnpm ingest:corpus 100 --rejeitadas   # só o que o filtro barrou
 *   pnpm ingest:corpus 100 --texto        # mostra o texto inteiro
 *
 * ATENÇÃO: imprime texto clínico real (nome de paciente, CNS, CPF). Rode
 * em terminal seu, não cole a saída em issue, chat ou documento.
 */
import "../env";
import { desc, sql } from "drizzle-orm";
import { db, schema } from "@samu-cru/db";

const args = process.argv.slice(2);
const limit = Number(args.find((a) => /^\d+$/.test(a)) ?? 30);
const onlyRejected = args.includes("--rejeitadas");
const fullText = args.includes("--texto");

interface Verdict {
  pass?: boolean;
  reason?: string;
  hits?: number;
}

async function main(): Promise<void> {
  const rows = await db
    .select({
      id: schema.whatsappMessages.id,
      receivedAt: schema.whatsappMessages.receivedAt,
      sender: schema.whatsappMessages.waSenderId,
      rawText: schema.whatsappMessages.rawText,
      rawJson: schema.whatsappMessages.rawJson,
      transportId: schema.transportRequests.id,
      confidence: schema.transportRequests.parseConfidence,
    })
    .from(schema.whatsappMessages)
    .leftJoin(
      schema.transportRequests,
      sql`${schema.transportRequests.whatsappMessageId} = ${schema.whatsappMessages.id}`,
    )
    .orderBy(desc(schema.whatsappMessages.receivedAt))
    .limit(limit);

  const filtered = onlyRejected
    ? rows.filter((r) => (r.rawJson as { filterVerdict?: Verdict } | null)?.filterVerdict?.pass === false)
    : rows;

  if (filtered.length === 0) {
    console.log(
      "nenhuma mensagem gravada ainda — o worker grava a partir da primeira que chegar no grupo de WA_ALLOWED_CHATS",
    );
    return;
  }

  let passou = 0;
  let virouTransporte = 0;
  let semVeredito = 0;

  for (const r of filtered) {
    const v = (r.rawJson as { filterVerdict?: Verdict; senderName?: string } | null) ?? {};
    const verdict = v.filterVerdict ?? {};
    if (verdict.pass) passou += 1;
    if (verdict.pass === undefined) semVeredito += 1;
    if (r.transportId) virouTransporte += 1;

    const quando = r.receivedAt.toISOString().slice(0, 16).replace("T", " ");
    const quem = v.senderName || r.sender?.split("@")[0] || "?";
    const marca = r.transportId
      ? `TRANSPORTE conf=${r.confidence}`
      : verdict.pass
        ? "PASSOU mas sem transporte"
        : `BARRADO (${verdict.reason ?? "?"})`;

    console.log(`\n── #${r.id} · ${quando} · ${quem} · ${marca}`);
    const texto = r.rawText.replace(/\n+/g, " | ");
    console.log(fullText ? r.rawText : texto.slice(0, 220));
  }

  // `semVeredito` são linhas gravadas antes de o worker passar a anotar o
  // veredito no rawJson (mock antigo, ou ingestão de outra época). Contadas
  // à parte para o total não parecer inconsistente.
  console.log(
    `\n${filtered.length} mensagens · ${passou} passaram no filtro · ` +
      `${virouTransporte} viraram transporte` +
      (semVeredito > 0 ? ` · ${semVeredito} sem veredito gravado` : ""),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
