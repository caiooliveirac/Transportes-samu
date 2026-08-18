/**
 * Roda filtro + parser sobre o corpus já gravado, SEM ESCREVER NADA.
 *
 * O `corpus` mostra o texto e o veredito do filtro; o `backfill` age. Falta
 * a medida: **de tudo que o grupo mandou, quanto o parser está acertando, e
 * quanto disso vira card visível?** Sem isso, "melhorou" fica no olhômetro
 * de quem leu algumas mensagens.
 *
 * Aqui o veredito do filtro é RECALCULADO com o código de hoje — não o que
 * ficou congelado em `raw_json.filterVerdict` no dia da ingestão — e o parser
 * roda inclusive sobre a mensagem barrada, que é onde se vê se o filtro está
 * jogando fora coisa que o parser saberia ler.
 *
 * Duas colunas respondem por que um card não aparece:
 *
 *   coluna    — o `origin_unit_raw` resultante casa com algum `units.code`?
 *               Se não, o card existe e cai no balde "Origem não
 *               identificada", esperando alguém informar a unidade.
 *   completo  — destino e procedimento saíram preenchidos?
 *
 *   pnpm ingest:replay                  # últimas 30, campo a campo
 *   pnpm ingest:replay 100              # últimas 100
 *   pnpm ingest:replay 100 --rejeitadas # só o que o filtro barra
 *   pnpm ingest:replay 100 --texto      # texto inteiro, sem truncar
 *   pnpm ingest:replay 100 --min-hits 2 # simula outro limiar de filtro
 *   pnpm ingest:replay 100 --resumo     # só o agregado, sem dado de paciente
 *
 * ATENÇÃO: a saída detalhada imprime texto clínico real (nome, CNS, CPF).
 * Rode em terminal seu. `--resumo` é a única saída sem PHI — é a que dá
 * para colar em algum lugar.
 */
import "../env";
import { desc } from "drizzle-orm";
import { db, schema } from "@samu-cru/db";
import { parseMessage } from "@samu-cru/parser";
import { MISSING_ORIGIN } from "@samu-cru/shared";

import { MIN_HITS, looksLikeTransport } from "../pipeline/filter";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

/**
 * O limite é o inteiro solto entre os argumentos — cuidado para não pegar o
 * VALOR de uma flag. `--min-hits 2` estava virando "analise 2 mensagens", e
 * o resumo saía com cara de medida do corpus inteiro sobre uma amostra de
 * duas. Exportada para ficar sob teste: é fácil regredir mexendo em flags.
 */
export function parseLimit(args: readonly string[], fallback = 30): number {
  const minHitsArg = args.indexOf("--min-hits");
  return Number(args.find((a, i) => /^\d+$/.test(a) && i !== minHitsArg + 1) ?? fallback);
}

const args = process.argv.slice(2);
const minHitsArg = args.indexOf("--min-hits");
const minHits = minHitsArg > -1 ? Number(args[minHitsArg + 1]) : MIN_HITS;
const limit = parseLimit(args);
const onlyRejected = args.includes("--rejeitadas");
const fullText = args.includes("--texto");
const summaryOnly = args.includes("--resumo");

/** Campos medidos: os que decidem se o card serve para alguma coisa. */
const CAMPOS = ["paciente", "origem", "destino", "procedimento", "prazo"] as const;
type Campo = (typeof CAMPOS)[number];

interface Totals {
  mensagens: number;
  passa: number;
  barrado: number;
  porMotivo: Map<string, number>;
  achou: Map<Campo, number>;
  visivel: number;
  invisivel: number;
  porStatus: Map<string, number>;
  porTipo: Map<string, number>;
}

function emptyTotals(): Totals {
  const achou = new Map<Campo, number>();
  for (const c of CAMPOS) achou.set(c, 0);
  return {
    mensagens: 0,
    passa: 0,
    barrado: 0,
    porMotivo: new Map(),
    achou,
    visivel: 0,
    invisivel: 0,
    porStatus: new Map(),
    porTipo: new Map(),
  };
}

function bump<K>(m: Map<K, number>, k: K): void {
  m.set(k, (m.get(k) ?? 0) + 1);
}

/** Motivo sem os números, para agrupar ("not enough hints (2/3)" → "…"). */
function reasonBucket(reason: string): string {
  return reason.replace(/\s*\(.*\)$/, "");
}

function conf(c: number): string {
  const cor = c >= 0.85 ? GREEN : c >= 0.6 ? YELLOW : RED;
  return `${cor}${c.toFixed(2)}${RESET}`;
}

function linha(nome: string, valor: unknown, c: number, aviso?: string): string {
  const v = valor === null || valor === undefined ? `${DIM}—${RESET}` : String(valor);
  return `  ${nome.padEnd(14)} ${conf(c)}  ${v}` + (aviso ? `  ${YELLOW}⚠ ${aviso}${RESET}` : "");
}

async function main(): Promise<void> {
  if (!Number.isFinite(minHits) || minHits < 1) {
    console.error("--min-hits precisa de um inteiro ≥ 1");
    process.exit(2);
  }

  // Códigos vindos do banco, não da constante: as colunas do painel são
  // montadas a partir da tabela `units`, então é ela que define o visível.
  const unitRows = await db.select({ code: schema.units.code }).from(schema.units);
  const unitCodes = new Set(unitRows.map((u) => u.code));

  const rows = await db
    .select({
      id: schema.whatsappMessages.id,
      receivedAt: schema.whatsappMessages.receivedAt,
      sender: schema.whatsappMessages.waSenderId,
      rawText: schema.whatsappMessages.rawText,
      rawJson: schema.whatsappMessages.rawJson,
    })
    .from(schema.whatsappMessages)
    .orderBy(desc(schema.whatsappMessages.receivedAt))
    .limit(limit);

  if (rows.length === 0) {
    console.log(
      "nenhuma mensagem gravada ainda — o worker grava a partir da primeira que chegar no grupo de WA_ALLOWED_CHATS",
    );
    return;
  }

  const t = emptyTotals();

  for (const r of rows) {
    const verdict = looksLikeTransport(r.rawText, minHits);
    if (onlyRejected && verdict.pass) continue;

    t.mensagens += 1;
    if (verdict.pass) t.passa += 1;
    else {
      t.barrado += 1;
      bump(t.porMotivo, reasonBucket(verdict.reason));
    }

    const p = parseMessage({ rawText: r.rawText, receivedAt: r.receivedAt });
    const originRaw = p.originUnitCode.value ?? MISSING_ORIGIN;
    const visivel = unitCodes.has(originRaw);

    if (verdict.pass) {
      if (visivel) t.visivel += 1;
      else t.invisivel += 1;
      bump(t.porStatus, p.suggestedStatus);
      bump(t.porTipo, p.tripType.value ?? "unknown");
      const presente: Record<Campo, boolean> = {
        paciente: p.patientName.value != null,
        origem: visivel,
        destino: p.destination.value != null,
        procedimento: p.procedure.value != null,
        prazo: p.deadlineAt.value != null,
      };
      for (const c of CAMPOS) {
        if (presente[c]) t.achou.set(c, t.achou.get(c)! + 1);
      }
    }

    if (summaryOnly) continue;

    const quando = r.receivedAt.toISOString().slice(0, 16).replace("T", " ");
    const meta = (r.rawJson as { senderName?: string } | null) ?? {};
    const quem = meta.senderName || r.sender?.split("@")[0] || "?";
    const marca = verdict.pass
      ? `${GREEN}PASSA${RESET} (${verdict.hits} hints)`
      : `${RED}BARRADO${RESET} (${verdict.reason})`;

    console.log(`\n${BOLD}── #${r.id} · ${quando} · ${quem} · ${marca}${RESET}`);
    const texto = r.rawText.replace(/\n+/g, " | ");
    console.log(`${DIM}${fullText ? r.rawText : texto.slice(0, 220)}${RESET}`);

    console.log(
      linha("paciente", p.patientName.value, p.patientName.confidence, p.patientName.warning),
    );
    console.log(
      linha(
        "origem",
        p.originUnitCode.value,
        p.originUnitCode.confidence,
        p.originUnitCode.warning,
      ),
    );
    console.log(
      linha("destino", p.destination.value, p.destination.confidence, p.destination.warning),
    );
    console.log(
      linha("procedimento", p.procedure.value, p.procedure.confidence, p.procedure.warning),
    );
    console.log(
      linha(
        "prazo",
        p.deadlineAt.value?.toISOString(),
        p.deadlineAt.confidence,
        p.deadlineAt.warning,
      ),
    );
    console.log(linha("tipo viagem", p.tripType.value, p.tripType.confidence));
    console.log(
      `  ${"→ global".padEnd(14)} ${p.globalConfidence.toFixed(3)}  status ${p.suggestedStatus}`,
    );
    console.log(
      `  ${"→ coluna".padEnd(14)} ${
        visivel
          ? `${GREEN}${originRaw}${RESET}`
          : `${RED}${originRaw} — cai em "Origem não identificada"${RESET}`
      }`,
    );
  }

  printSummary(t);
}

function pct(n: number, total: number): string {
  return total === 0 ? "  0%" : `${String(Math.round((n / total) * 100)).padStart(3)}%`;
}

function printSummary(t: Totals): void {
  const limiar = minHits === MIN_HITS ? "" : `  ${YELLOW}(limiar simulado: ${minHits})${RESET}`;
  console.log(`\n${BOLD}━━ Resumo ━━${RESET}${limiar}`);
  console.log(`${t.mensagens} mensagens analisadas`);

  console.log(`\n${BOLD}Filtro${RESET}`);
  console.log(`  passa    ${String(t.passa).padStart(4)}  ${pct(t.passa, t.mensagens)}`);
  console.log(`  barrado  ${String(t.barrado).padStart(4)}  ${pct(t.barrado, t.mensagens)}`);
  for (const [motivo, n] of [...t.porMotivo].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${DIM}${motivo.padEnd(24)}${RESET} ${String(n).padStart(4)}`);
  }

  if (t.passa === 0) {
    console.log(`\n${YELLOW}Nenhuma mensagem passa no filtro — nenhum card seria criado.${RESET}`);
    console.log(
      `${DIM}O parser não chega a ser exercitado. Rode com --min-hits 2 para ver o que mudaria.${RESET}`,
    );
    return;
  }

  console.log(`\n${BOLD}Extração${RESET} ${DIM}(das ${t.passa} que passam)${RESET}`);
  for (const c of CAMPOS) {
    const ok = t.achou.get(c)!;
    const falta = t.passa - ok;
    console.log(
      `  ${c.padEnd(14)} ${String(ok).padStart(4)}/${t.passa}  ${pct(ok, t.passa)}` +
        (falta > 0 ? `  ${RED}${falta} sem${RESET}` : ""),
    );
  }

  console.log(`\n${BOLD}Painel${RESET}`);
  console.log(
    `  card com coluna  ${String(t.visivel).padStart(4)}/${t.passa}  ${pct(t.visivel, t.passa)}`,
  );
  const inv = t.invisivel > 0 ? RED : DIM;
  console.log(
    `  ${inv}sem coluna       ${String(t.invisivel).padStart(4)}/${t.passa}  ` +
      `${pct(t.invisivel, t.passa)}  (origem não reconhecida)${RESET}`,
  );

  console.log(`\n${BOLD}Status sugerido${RESET}`);
  for (const [status, n] of [...t.porStatus].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status.padEnd(20)} ${String(n).padStart(4)}`);
  }

  console.log(`\n${BOLD}Tipo de viagem${RESET}`);
  for (const [tipo, n] of [...t.porTipo].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tipo.padEnd(20)} ${String(n).padStart(4)}`);
  }
}

// `import.meta.main` não existe no tsx; comparar o argv[1] evita que
// importar `parseLimit` num teste dispare uma varredura no banco.
const invocadoDireto = process.argv[1]?.endsWith("replay.ts") ?? false;
if (invocadoDireto) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
