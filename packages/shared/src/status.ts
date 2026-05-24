import type { TransportStatus } from "./enums";

export interface StatusMeta {
  key: TransportStatus;
  label: string;
  short: string;
  accent: string;
  borderClass: string;
  dotClass: string;
  pillDarkClass: string;
  pillLightClass: string;
}

export const STATUS: Record<TransportStatus, StatusMeta> = {
  pendente_revisao: {
    key: "pendente_revisao",
    label: "Pendente revisão",
    short: "Pendente",
    accent: "amber",
    borderClass: "border-l-amber-500",
    dotClass: "bg-amber-500",
    pillDarkClass: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    pillLightClass: "bg-amber-100 text-amber-800 ring-amber-200",
  },
  novo: {
    key: "novo",
    label: "Novo",
    short: "Novo",
    accent: "sky",
    borderClass: "border-l-sky-500",
    dotClass: "bg-sky-500",
    pillDarkClass: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
    pillLightClass: "bg-sky-100 text-sky-800 ring-sky-200",
  },
  aguardando_viatura: {
    key: "aguardando_viatura",
    label: "Aguardando viatura",
    short: "Aguard. viatura",
    accent: "slate",
    borderClass: "border-l-slate-400",
    dotClass: "bg-slate-400",
    pillDarkClass: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
    pillLightClass: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  viatura_designada: {
    key: "viatura_designada",
    label: "Viatura designada",
    short: "Designada",
    accent: "violet",
    borderClass: "border-l-violet-500",
    dotClass: "bg-violet-500",
    pillDarkClass: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
    pillLightClass: "bg-violet-100 text-violet-800 ring-violet-200",
  },
  em_deslocamento_origem: {
    key: "em_deslocamento_origem",
    label: "A caminho da origem",
    short: "→ Origem",
    accent: "indigo",
    borderClass: "border-l-indigo-500",
    dotClass: "bg-indigo-500",
    pillDarkClass: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30",
    pillLightClass: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  },
  paciente_embarcado: {
    key: "paciente_embarcado",
    label: "Paciente embarcado",
    short: "Embarcado",
    accent: "blue",
    borderClass: "border-l-blue-600",
    dotClass: "bg-blue-600",
    pillDarkClass: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
    pillLightClass: "bg-blue-100 text-blue-800 ring-blue-200",
  },
  em_deslocamento_destino: {
    key: "em_deslocamento_destino",
    label: "A caminho do destino",
    short: "→ Destino",
    accent: "cyan",
    borderClass: "border-l-cyan-500",
    dotClass: "bg-cyan-500",
    pillDarkClass: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
    pillLightClass: "bg-cyan-100 text-cyan-800 ring-cyan-200",
  },
  chegou_destino: {
    key: "chegou_destino",
    label: "Chegou ao destino",
    short: "Chegou",
    accent: "emerald",
    borderClass: "border-l-emerald-500",
    dotClass: "bg-emerald-500",
    pillDarkClass: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    pillLightClass: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  },
  retornando_origem: {
    key: "retornando_origem",
    label: "Retornando à origem",
    short: "Retornando",
    accent: "teal",
    borderClass: "border-l-teal-500",
    dotClass: "bg-teal-500",
    pillDarkClass: "bg-teal-500/15 text-teal-300 ring-teal-500/30",
    pillLightClass: "bg-teal-100 text-teal-800 ring-teal-200",
  },
  concluido: {
    key: "concluido",
    label: "Concluído",
    short: "Concluído",
    accent: "zinc",
    borderClass: "border-l-zinc-400",
    dotClass: "bg-zinc-400",
    pillDarkClass: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
    pillLightClass: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  },
  cancelado: {
    key: "cancelado",
    label: "Cancelado",
    short: "Cancelado",
    accent: "zinc",
    borderClass: "border-l-zinc-500",
    dotClass: "bg-zinc-500",
    pillDarkClass: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
    pillLightClass: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  },
};
