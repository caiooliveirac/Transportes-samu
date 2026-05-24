// TODO Fase 1: implementar pipeline determinístico (PLANNING §7):
//   normalize → segment → extract (1 fn por campo) → resolve → score
// Cada extrator é função pura testável que retorna Extracted<T>.
// O agregador produz ParseResult e decide status novo vs pendente_revisao.

export * from "./types";

/**
 * Stub do parser. Implementação real entra na Fase 1.
 */
export function parseMessage(_rawText: string): never {
  throw new Error("parser not implemented yet — see PLANNING §7");
}
