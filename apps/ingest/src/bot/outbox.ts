import { db, schema } from "@samu-cru/db";
import { gt, sql } from "drizzle-orm";
import { logger } from "../logger";
import type { ComposedMessage } from "./compose";

/**
 * Registro do que o bot diria. **Não existe caminho de envio neste
 * arquivo, de propósito** — enquanto o usuário não autorizar explicitamente
 * que ele fale no grupo, o código não deve ser capaz de falar. Ligar o
 * envio será um PR próprio, com a decisão registrada.
 *
 * O que existe aqui é a fila do modo sombra: a pergunta é montada,
 * gravada e logada, para dar para ler um dia inteiro de perguntas antes de
 * decidir.
 */

/**
 * Teto por hora. Um grupo operacional aguenta pouca interrupção
 * automática — e o teto também protege contra laço acidental que
 * transformaria uma falha de parser em enxurrada.
 */
const MAX_PER_HOUR = 6;

export async function recordBotMessage(params: {
  composed: ComposedMessage;
  transportId: string | null;
  triggerMessageDbId: number;
  waChatId: string;
  replyToWaMessageId: string | null;
}): Promise<void> {
  try {
    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.botMessages)
      .where(gt(schema.botMessages.createdAt, new Date(Date.now() - 60 * 60 * 1000)));

    if (count >= MAX_PER_HOUR) {
      logger.warn(
        { kind: params.composed.kind, lastHour: count },
        "bot no teto por hora — pergunta descartada",
      );
      return;
    }

    const [row] = await db
      .insert(schema.botMessages)
      .values({
        kind: params.composed.kind,
        transportId: params.transportId,
        triggerMessageId: params.triggerMessageDbId,
        waChatId: params.waChatId,
        replyToWaMessageId: params.replyToWaMessageId,
        body: params.composed.body,
        status: "shadow",
      })
      .onConflictDoNothing()
      .returning();

    if (row) {
      logger.info(
        { kind: row.kind, botMessageId: row.id, body: row.body },
        "bot (sombra) — pergunta que seria enviada ao grupo",
      );
    }
  } catch (err) {
    // O bot é acessório. Falhar aqui não pode atrapalhar a ingestão.
    logger.error({ err }, "falha ao registrar mensagem do bot");
  }
}
