const ptBR = "pt-BR";

/** "14:30" no fuso local. */
export function formatHHMM(date: Date | string | null): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString(ptBR, { hour: "2-digit", minute: "2-digit" });
}

/** "há 12min", "em 30min", "agora". */
export function formatRelative(date: Date | string | null, now: Date): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  const diff = Math.round((d.getTime() - now.getTime()) / 60_000);
  if (diff === 0) return "agora";
  if (diff < 0) {
    const a = -diff;
    if (a < 60) return `há ${a}min`;
    if (a < 60 * 24) return `há ${Math.round(a / 60)}h`;
    return `há ${Math.round(a / 1440)}d`;
  }
  if (diff < 60) return `em ${diff}min`;
  if (diff < 60 * 24) return `em ${Math.round(diff / 60)}h`;
  return `em ${Math.round(diff / 1440)}d`;
}

/** "67a" → "67 anos"; "8a (pediatrico)" → "8 anos"; null-safe. */
export function formatAge(ageText: string | null | undefined): string {
  if (!ageText) return "";
  const m = ageText.match(/^(\d+)\s*a/i);
  if (!m) return ageText;
  const n = parseInt(m[1]!, 10);
  return n === 1 ? "1 ano" : `${n} anos`;
}

/** Compacta nome para card (privacy): "Maria das Graças Souza" → "Maria S.". */
export function firstNameAndInitial(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first;
}

/** Mascara CNS preservando 4 últimos: 15 dígitos → "••• ••• 0528". */
export function maskCns(cns: string | null | undefined): string {
  if (!cns) return "—";
  const digits = cns.replace(/\D/g, "");
  if (digits.length !== 15) return "•••";
  return `••• ••• ${digits.slice(-4)}`;
}

/** Mascara CPF preservando 2 últimos: "•••.•••.•••-XX". */
export function maskCpf(cpf: string | null | undefined): string {
  if (!cpf) return "—";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return "•••";
  return `•••.•••.•••-${digits.slice(-2)}`;
}

/** Formata CNS revelado: "704 0030 8924 0528". */
export function formatCns(cns: string | null | undefined): string {
  if (!cns) return "—";
  const d = cns.replace(/\D/g, "");
  if (d.length !== 15) return cns;
  return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7, 11)} ${d.slice(11)}`;
}

/** Formata CPF revelado: "123.456.789-00". */
export function formatCpf(cpf: string | null | undefined): string {
  if (!cpf) return "—";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
