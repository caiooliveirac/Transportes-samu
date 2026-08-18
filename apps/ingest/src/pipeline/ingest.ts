import { eq, sql } from "drizzle-orm";
import { parseMessage } from "@samu-cru/parser";
import {
  MISSING_DESTINATION,
  MISSING_ORIGIN,
  MISSING_PROCEDURE,
  isHumanCorrected,
  type CorrectableField,
} from "@samu-cru/shared";
import {
  db,
  findTransportsByWhatsappMessage,
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

  const skipped = (): IngestResult => ({
    created: false,
    stored: isNew,
    whatsappMessageDbId,
    globalConfidence: 0,
  });

  if (!input.createTransport) {
    baseLog.debug("message stored for corpus only (filtro não passou)");
    return skipped();
  }

  // O portão é "esta mensagem já tem transporte?", não "acabei de gravar a
  // mensagem?". As duas perguntas parecem a mesma e não são: a mensagem é
  // gravada ANTES de o parser rodar, então uma falha no insert do transporte
  // deixava a linha de `whatsapp_messages` no banco sem transporte — e o
  // reenvio do gateway caía em "já conheço esta mensagem" e respondia 200
  // sem criar nada. Perguntando pelo transporte linkado, o reenvio se cura
  // sozinho e duplicata continua sendo recusada.
  //
  // Mensagem recém-inserida não pode ter transporte linkado; só consulta
  // quando ela já existia.
  if (!isNew) {
    const linked = await findTransportsByWhatsappMessage(whatsappMessageDbId);
    if (linked.length > 0) {
      baseLog.debug("transport already linked to this message, skipping create");
      return skipped();
    }
    baseLog.info(
      "mensagem já gravada e sem transporte linkado — criando agora (retry pós-falha)",
    );
  }

  // 2. Parser + insert (compartilhado com o backfill)
  const created = await createTransportFromMessage({
    whatsappMessageDbId,
    rawText: input.rawText,
    receivedAt: input.receivedAt,
  });

  return {
    created: created.transportId !== null,
    stored: isNew,
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
    originUnitRaw:
      parsed.originUnitCode.value ?? parsed.originUnitCode.raw ?? MISSING_ORIGIN,
    destinationName: parsed.destination.value ?? MISSING_DESTINATION,
    procedure: parsed.procedure.value ?? MISSING_PROCEDURE,
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
 *
 * O que também NÃO faz: sobrescrever campo que um regulador corrigiu à mão.
 * A correção manual e o re-parse escrevem nas MESMAS colunas, e este comando
 * é rodado justamente depois de melhorar o parser — que é quando há mais
 * correção acumulada para perder. `corrected_fields` diz de quem é cada
 * valor; o que é humano fica de fora do UPDATE.
 */
export async function reparseTransportFromMessage(params: {
  whatsappMessageDbId: number;
  rawText: string;
  receivedAt: Date;
}): Promise<{
  updated: number;
  globalConfidence: number;
  promoted: boolean;
  /** Campos que ficaram de fora por serem correção humana. */
  preserved: CorrectableField[];
}> {
  const parsed = parseMessage({
    rawText: params.rawText,
    receivedAt: params.receivedAt,
  });
  const units = await getUnitsByCode();
  const originResolved = parsed.originUnitCode.value
    ? (units.get(parsed.originUnitCode.value) ?? null)
    : null;

  const existing = await db
    .select({
      id: schema.transportRequests.id,
      status: schema.transportRequests.status,
      correctedFields: schema.transportRequests.correctedFields,
    })
    .from(schema.transportRequests)
    .where(eq(schema.transportRequests.whatsappMessageId, params.whatsappMessageDbId));

  const promote =
    parsed.suggestedStatus === "novo" &&
    existing.length > 0 &&
    existing.every((t) => t.status === "pendente_revisao");

  // Um UPDATE por transporte, e não um em massa: `corrected_fields` é por
  // linha — um dos gêmeos pode ter tido o destino corrigido e o outro não.
  // Numa transação porque o UPDATE em massa que havia antes era atômico, e
  // uma falha no meio do laço deixaria gêmeos em estados diferentes com os
  // contadores impressos descrevendo meia execução.
  const preserved = new Set<CorrectableField>();
  let updated = 0;

  await db.transaction(async (tx) => {
  for (const row of existing) {
    const owned = (f: CorrectableField): boolean => {
      const human = isHumanCorrected(row.correctedFields, f);
      if (human) preserved.add(f);
      return human;
    };

    const values: Record<string, unknown> = {
      patientName: parsed.patientName.value ?? "(sem nome)",
      patientAgeText: parsed.patientAgeYears.value
        ? `${parsed.patientAgeYears.value}a`
        : null,
      patientBirthDate: parsed.patientBirthDate.value
        ? parsed.patientBirthDate.value.toISOString().slice(0, 10)
        : null,
      patientCns: parsed.patientCns.value,
      patientCpf: parsed.patientCpf.value,
      procedureTime: parsed.procedureTimeText.value,
      deadlineAt: parsed.deadlineAt.value,
      vitals: parsed.vitals.value ?? null,
      diagnoses: parsed.diagnoses.value ?? null,
      ...(promote ? { status: "novo" as const } : {}),
      parseConfidence: parsed.globalConfidence,
      parseWarnings: parsed.warnings.length > 0 ? parsed.warnings : null,
      updatedAt: new Date(),
    };

    if (!owned("originUnitRaw")) {
      values.originUnitId = originResolved?.id ?? null;
      // Mesmo fallback da criação: o trecho cru é a única pista do que o
      // parser leu, e é ele que a gaveta mostra para o regulador escolher a
      // unidade certa. Trocá-lo pelo travessão aqui apagaria essa pista em
      // massa a cada `--reparse`.
      values.originUnitRaw =
        parsed.originUnitCode.value ?? parsed.originUnitCode.raw ?? MISSING_ORIGIN;
    }
    if (!owned("destinationName")) {
      values.destinationName = parsed.destination.value ?? MISSING_DESTINATION;
    }
    // `trip_type` é derivado do procedimento, então acompanha o dono dele:
    // senão um procedimento corrigido à mão ficaria com o tipo de viagem do
    // procedimento antigo.
    if (!owned("procedure")) {
      values.procedure = parsed.procedure.value ?? MISSING_PROCEDURE;
      values.tripType = parsed.tripType.value ?? "unknown";
    }

    const done = await tx
      .update(schema.transportRequests)
      .set(values)
      .where(eq(schema.transportRequests.id, row.id))
      .returning({ id: schema.transportRequests.id });
    updated += done.length;
  }
  });

  return {
    updated,
    globalConfidence: parsed.globalConfidence,
    promoted: promote && updated > 0,
    preserved: [...preserved],
  };
}
