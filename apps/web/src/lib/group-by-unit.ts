/**
 * Distribui transportes nas colunas do painel.
 *
 * As colunas são chaveadas por `units.code`; o transporte entra pela sua
 * `origin_unit_raw`. Esse campo é duas coisas ao mesmo tempo: o código da
 * unidade quando o parser resolve a origem, e o travessão de `MISSING_ORIGIN`
 * quando não resolve. O caminho do form web sempre grava um código; o do
 * WhatsApp, não.
 *
 * O que havia antes era um `map.get(...)` seguido de `if (list) list.push(t)`
 * sem `else`: quem não casava com coluna nenhuma era descartado em silêncio.
 * O transporte existia no banco, passava por todos os filtros, contava nos
 * números do cabeçalho — e não aparecia em lugar nenhum, deixando a unidade
 * dele com cara de ociosa. Daí `unresolved` ser devolvido em vez de sumir:
 * nenhuma linha vinda do banco pode desaparecer da tela, e é da gaveta desses
 * cards que o regulador informa a unidade.
 */
export function bucketByUnit<T extends { originUnitRaw: string }>(
  unitCodes: Iterable<string>,
  transports: readonly T[],
): { columns: Map<string, T[]>; unresolved: T[] } {
  const columns = new Map<string, T[]>();
  for (const code of unitCodes) columns.set(code, []);

  const unresolved: T[] = [];
  for (const t of transports) {
    const list = columns.get(t.originUnitRaw);
    if (list) list.push(t);
    else unresolved.push(t);
  }
  return { columns, unresolved };
}
