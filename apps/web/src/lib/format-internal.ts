/**
 * Helpers só usados internamente pela UI (não estão em @samu-cru/shared
 * nem em format.ts para evitar duplicação cruzada).
 */
export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
