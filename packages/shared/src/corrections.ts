/**
 * Campos que o regulador corrige à mão, e como saber quais são dele.
 *
 * A correção manual (`correctTransportFields`) e o re-parse
 * (`reparseTransportFromMessage`) escrevem nas MESMAS colunas. Sem marcar
 * de quem é o valor, `pnpm ingest:backfill --reparse --aplicar` sobrescreve
 * em massa tudo que foi corrigido à mão — o comando existe justamente para
 * ser rodado depois de melhorar o parser, que é quando mais há correção
 * acumulada para perder. `transport_events` registra a correção, mas é log:
 * ninguém consulta log antes de um UPDATE.
 *
 * Daí `transport_requests.corrected_fields`: a lista de campos cujo dono é
 * humano. O re-parse pula esses; o resto ele atualiza à vontade.
 */
import { UNITS } from "./units";

export const CORRECTABLE_FIELDS = ["destinationName", "procedure", "originUnitRaw"] as const;

export type CorrectableField = (typeof CORRECTABLE_FIELDS)[number];

export const CORRECTABLE_FIELD_LABEL: Record<CorrectableField, string> = {
  destinationName: "Destino",
  procedure: "Procedimento",
  originUnitRaw: "Unidade de origem",
};

/** O valor deste campo foi escrito por um humano? */
export function isHumanCorrected(
  correctedFields: readonly string[] | null | undefined,
  field: CorrectableField,
): boolean {
  return correctedFields?.includes(field) ?? false;
}

/** União do que já era humano com o que acabou de ser corrigido. */
export function mergeCorrectedFields(
  current: readonly string[] | null | undefined,
  added: readonly CorrectableField[],
): string[] {
  return [...new Set([...(current ?? []), ...added])];
}

/**
 * O que vai para `origin_unit_raw` quando o parser não reconhece a unidade.
 *
 * Diferente de `MISSING_DESTINATION`, este campo tem uma segunda função: é
 * a CHAVE DA COLUNA do painel, que casa com `units.code`. Qualquer coisa que
 * não seja um código — o travessão ou trecho cru da mensagem — não pertence
 * a coluna nenhuma.
 */
export const MISSING_ORIGIN = "—";

const UNIT_CODES: ReadonlySet<string> = new Set(UNITS.map((u) => u.code));

/**
 * O transporte tem coluna no painel? `false` significa que ele existe no
 * banco e não aparece em unidade nenhuma — precisa do balde de origem não
 * identificada e de alguém informar a unidade.
 */
export function isOriginResolved(originUnitRaw: string | null | undefined): boolean {
  return !!originUnitRaw && UNIT_CODES.has(originUnitRaw);
}
