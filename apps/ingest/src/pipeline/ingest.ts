import { eq, sql } from "drizzle-orm";
import { parseMessage } from "@samu-cru/parser";
import {
  db,
  insertTransport,
  schema,
  type WhatsappMessage,
} from "@samu-cru/db";

import { logger } from "../logger";
import { ENV } from "../env";

interface UnitResolution {
  id: number;
  code: string;
}

/**
 * Cache local de unidades em memória — não muda em runtime (seed estático
 * + manutenção rara). Carregado lazily na primeira chamada e reutilizado.
 */
let unitsByCode: Map<string, UnitResolution> | null = null;

async function getUnitsByCode(): Promise<Map<string, UnitResolution>> {
  if (unitsByCode) return unitsByCode;
  const rows = await db.select().from(schema.units);
  unitsByCode = new Map(rows.map((u) => [u.code, { id: u.id, code: u.code }]));
  return unitsByCode;
}

export interface IngestInput {
  waMessageId: string;
  waChatId: string;
  waSenderId: string | null;
  rawText: string;
  rawJson: unknown;
  receivedAt: Date;
  /**
   * `false` grava a mensagem em whatsapp_messages e para ali — sem
   * parser, sem transport. É como o corpus de treinamento é formado: a
   * mensagem que a heurística REJEITOU é justamente a que ensina onde a
   * heurística erra, e antes disso ela era descartada sem deixar rastro.
   */
  createTransport: boolean;
}

export interface IngestResult {
  /** True = um novo transport foi criado. */
  created: boolean;
  /** True = esta chamada inseriu a linha em whatsapp_messages. */
  stored: boolean;
  whatsappMessageDbId: number;
  transportId?: string;
  globalConfidence: number;
}

/**
 * Pipeline: insert whatsapp_messages (idempotente) e, quando
 * `createTransport`, parser → insert transport_request linkado.
 * Retorna o estado pra logging.
 *
 * Idempotência:
 *  - whatsapp_messages tem UNIQUE(wa_message_id); ON CONFLICT DO NOTHING
 *    descobre se já tínhamos a mensagem. Se sim, NÃO criamos transport
 *    novo (uma mensagem reentrante é tratada em handleMessageEdit).
 *  - transport_requests.id é UUID — não há chave natural, então o gate
 *    é "criamos um novo transport SOMENTE quando inserimos uma nova
 *    whatsapp_messages".
 */
export async function ingestMessage(input: IngestInput): Promise<IngestResult | null> {
  const baseLog = logger.child({
    waMessageId: input.waMessageId,
    waChatId: input.waChatId,
  });

  // 1. Insert whatsapp_messages — pega ID novo OU descobre que já existia
  const [inserted] = await db
    .insert(schema.whatsappMessages)
    .values({
      waMessageId: input.waMessageId,
      waChatId: input.waChatId,
      waSenderId: input.waSenderId,
      rawText: input.rawText,
      rawJson: input.rawJson as Record<string, unknown>,
      receivedAt: input.receivedAt,
    })
    .onConflictDoNothing({ target: schema.whatsappMessages.waMessageId })
    .returning();

  let whatsappMessageDbId: number;
  let isNew: boolean;
  if (inserted) {
    whatsappMessageDbId = inserted.id;
    isNew = true;
  } else {
    const [existing] = await db
      .select({ id: schema.whatsappMessages.id })
      .from(schema.whatsappMessages)
      .where(eq(schema.whatsappMessages.waMessageId, input.waMessageId))
      .limit(1);
    if (!existing) {
      baseLog.error("conflict but no existing row — race condition?");
      return null;
    }
    whatsappMessageDbId = existing.id;
    isNew = false;
  }

  if (!isNew) {
    baseLog.debug("whatsapp_message already known, skipping transport create");
    return {
      created: false,
      stored: false,
      whatsappMessageDbId,
      globalConfidence: 0,
    };
  }

  if (!input.createTransport) {
    baseLog.debug("message stored for corpus only (filtro não passou)");
    return {
      created: false,
      stored: true,
      whatsappMessageDbId,
      globalConfidence: 0,
    };
  }

  // 2. Parser + insert (compartilhado com o backfill)
  const created = await createTransportFromMessage({
    whatsappMessageDbId,
    rawText: input.rawText,
    receivedAt: input.receivedAt,
  });

  return {
    created: created.transportId !== null,
    stored: true,
    whatsappMessageDbId,
    transportId: created.transportId ?? undefined,
    globalConfidence: created.globalConfidence,
  };
}

/**
 * Parseia uma mensagem já gravada e cria o transport ligado a ela.
 * Extraído de `ingestMessage` porque o backfill (`scripts/backfill.ts`)
 * precisa exatamente disto para as mensagens que ficaram sem transporte —
 * duas cópias divergiriam no primeiro campo novo do parser.
 *
 * Respeita `DRY_RUN`: parseia, loga e devolve `transportId: null`.
 */
export async function createTransportFromMessage(params: {
  whatsappMessageDbId: number;
  rawText: string;
  receivedAt: Date;
}): Promise<{ transportId: string | null; globalConfidence: number; status: string }> {
  const baseLog = logger.child({ whatsappMessageDbId: params.whatsappMessageDbId });

  const parsed = parseMessage({
    rawText: params.rawText,
    receivedAt: params.receivedAt,
  });

  // Resolve origin unit code → DB id (parser pode vir com null)
  const units = await getUnitsByCode();
  const originResolved = parsed.originUnitCode.value
    ? (units.get(parsed.originUnitCode.value) ?? null)
    : null;

  if (ENV.dryRun) {
    baseLog.info(
      {
        confidence: parsed.globalConfidence,
        suggestedStatus: parsed.suggestedStatus,
        warnings: parsed.warnings,
        origin: parsed.originUnitCode.value,
      },
      "DRY_RUN parsed but NOT inserting transport",
    );
    return {
      transportId: null,
      globalConfidence: parsed.globalConfidence,
      status: parsed.suggestedStatus,
    };
  }

  const transport = await insertTransport({
    whatsappMessageId: params.whatsappMessageDbId,
    patientName: parsed.patientName.value ?? "(sem nome)",
    patientAgeText: parsed.patientAgeYears.value
      ? `${parsed.patientAgeYears.value}a`
      : null,
    patientBirthDate: parsed.patientBirthDate.value
      ? parsed.patientBirthDate.value.toISOString().slice(0, 10)
      : null,
    patientCns: parsed.patientCns.value,
    patientCpf: parsed.patientCpf.value,
    originUnitId: originResolved?.id ?? null,
    originUnitRaw: parsed.originUnitCode.value ?? parsed.originUnitCode.raw ?? "—",
    destinationName: parsed.destination.value ?? "(sem destino)",
    procedure: parsed.procedure.value ?? "(sem procedimento)",
    procedureTime: parsed.procedureTimeText.value,
    deadlineAt: parsed.deadlineAt.value,
    tripType: parsed.tripType.value ?? "unknown",
    vitals: parsed.vitals.value ?? null,
    diagnoses: parsed.diagnoses.value ?? null,
    status: parsed.suggestedStatus,
    parseConfidence: parsed.globalConfidence,
    parseWarnings: parsed.warnings.length > 0 ? parsed.warnings : null,
  });

  baseLog.info(
    {
      transportId: transport.id,
      status: transport.status,
      confidence: parsed.globalConfidence,
    },
    "transport created",
  );

  return {
    transportId: transport.id,
    globalConfidence: parsed.globalConfidence,
    status: transport.status,
  };
}

/**
 * Edição de mensagem original. Atualiza rawText, re-roda o parser e
 * UPDATE no transport linkado. PLANNING §8 manda "preservar edições
 * manuais"; como Phase 4 que adiciona edições não existe ainda, no
 * MVP a re-parse simplesmente sobrescreve.
 */
export async function handleMessageEdit(
  waMessageId: string,
  newRawText: string,
  editedAt: Date,
): Promise<void> {
  const baseLog = logger.child({ waMessageId });

  const [waRow] = (await db
    .select()
    .from(schema.whatsappMessages)
    .where(eq(schema.whatsappMessages.waMessageId, waMessageId))
    .limit(1)) as WhatsappMessage[];
  if (!waRow) {
    baseLog.warn("edit for unknown wa_message_id — ignoring");
    return;
  }
  if (waRow.rawText === newRawText) {
    baseLog.debug("edit with identical text — no-op");
    return;
  }

  await db
    .update(schema.whatsappMessages)
    .set({ rawText: newRawText, editedAt })
    .where(eq(schema.whatsappMessages.id, waRow.id));

  await reparseTransportFromMessage({
    whatsappMessageDbId: waRow.id,
    rawText: newRawText,
    receivedAt: waRow.receivedAt,
  });

  // Garante updated_at avança mesmo se nada mudou de fato (raro)
  void sql; // pacificador do linter — sql usado se quisermos forçar update

  baseLog.info("transport re-parsed after WhatsApp edit");
}

/**
 * Re-roda o parser sobre uma mensagem já gravada e atualiza o transport
 * ligado a ela. Serve à edição no WhatsApp e ao `ingest:backfill --reparse`
 * (recuperar casos parseados por uma versão pior do parser).
 *
 * O que NÃO faz: mexer no status de um caso que o regulador já moveu. O
 * único avanço permitido é `pendente_revisao` → `novo`, quando o parser
 * novo preencheu o que faltava.
 */
export async function reparseTransportFromMessage(params: {
  whatsappMessageDbId: number;
  rawText: string;
  receivedAt: Date;
}): Promise<{ updated: number; globalConfidence: number; promoted: boolean }> {
  const parsed = parseMessage({
    rawText: params.rawText,
    receivedAt: params.receivedAt,
  });
  const units = await getUnitsByCode();
  const originResolved = parsed.originUnitCode.value
    ? (units.get(parsed.originUnitCode.value) ?? null)
    : null;

  const existing = await db
    .select({ id: schema.transportRequests.id, status: schema.transportRequests.status })
    .from(schema.transportRequests)
    .where(eq(schema.transportRequests.whatsappMessageId, params.whatsappMessageDbId));

  const promote =
    parsed.suggestedStatus === "novo" &&
    existing.every((t) => t.status === "pendente_revisao");

  const rows = await db
    .update(schema.transportRequests)
    .set({
      patientName: parsed.patientName.value ?? "(sem nome)",
      patientAgeText: parsed.patientAgeYears.value
        ? `${parsed.patientAgeYears.value}a`
        : null,
      patientBirthDate: parsed.patientBirthDate.value
        ? parsed.patientBirthDate.value.toISOString().slice(0, 10)
        : null,
      patientCns: parsed.patientCns.value,
      patientCpf: parsed.patientCpf.value,
      originUnitId: originResolved?.id ?? null,
      originUnitRaw: parsed.originUnitCode.value ?? "—",
      destinationName: parsed.destination.value ?? "(sem destino)",
      procedure: parsed.procedure.value ?? "(sem procedimento)",
      procedureTime: parsed.procedureTimeText.value,
      deadlineAt: parsed.deadlineAt.value,
      tripType: parsed.tripType.value ?? "unknown",
      vitals: parsed.vitals.value ?? null,
      diagnoses: parsed.diagnoses.value ?? null,
      ...(promote ? { status: "novo" as const } : {}),
      parseConfidence: parsed.globalConfidence,
      parseWarnings: parsed.warnings.length > 0 ? parsed.warnings : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.transportRequests.whatsappMessageId, params.whatsappMessageDbId))
    .returning({ id: schema.transportRequests.id });

  return {
    updated: rows.length,
    globalConfidence: parsed.globalConfidence,
    promoted: promote && rows.length > 0,
  };
}
