// Unidades de origem SEM ambulância própria — dependem inteiramente da
// rede para transportar pacientes. Por isso ganham destaque e posição
// fixa no topo do painel do regulador (faixa "Prioridade da rede").
//
// Fonte: médico regulador SAMU/CRU. Estes códigos são seed da coluna
// `units.no_own_ambulance`. Mantê-los aqui dá uma fonte única e permite
// a UI destacar mesmo antes da migration rodar (fallback).

export const PRIORITY_UNIT_CODES: ReadonlyArray<string> = [
  "pa_tancredo_neves", // Rodrigo Argolo
  "upa_bairro_da_paz", // Orlando Imbassahy
  "upa_helio_machado", // Hélio Machado
];

export function isPriorityUnitCode(code: string): boolean {
  return PRIORITY_UNIT_CODES.includes(code);
}
