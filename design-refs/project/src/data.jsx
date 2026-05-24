// Mock data for SAMU/CRU dashboard.

const STATUS = {
  pendente_revisao: {
    key: "pendente_revisao",
    label: "Pendente revisão",
    short: "Pendente",
    accent: "amber",
    border: "border-l-amber-500",
    dot: "bg-amber-500",
    pillBg: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    pillBgLight: "bg-amber-100 text-amber-800 ring-amber-200",
  },
  novo: {
    key: "novo",
    label: "Novo",
    short: "Novo",
    accent: "sky",
    border: "border-l-sky-500",
    dot: "bg-sky-500",
    pillBg: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
    pillBgLight: "bg-sky-100 text-sky-800 ring-sky-200",
  },
  aguardando_viatura: {
    key: "aguardando_viatura",
    label: "Aguardando viatura",
    short: "Aguard. viatura",
    accent: "slate",
    border: "border-l-slate-400",
    dot: "bg-slate-400",
    pillBg: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
    pillBgLight: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  viatura_designada: {
    key: "viatura_designada",
    label: "Viatura designada",
    short: "Designada",
    accent: "violet",
    border: "border-l-violet-500",
    dot: "bg-violet-500",
    pillBg: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
    pillBgLight: "bg-violet-100 text-violet-800 ring-violet-200",
  },
  em_deslocamento_origem: {
    key: "em_deslocamento_origem",
    label: "A caminho da origem",
    short: "→ Origem",
    accent: "indigo",
    border: "border-l-indigo-500",
    dot: "bg-indigo-500",
    pillBg: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30",
    pillBgLight: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  },
  paciente_embarcado: {
    key: "paciente_embarcado",
    label: "Paciente embarcado",
    short: "Embarcado",
    accent: "blue",
    border: "border-l-blue-600",
    dot: "bg-blue-600",
    pillBg: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
    pillBgLight: "bg-blue-100 text-blue-800 ring-blue-200",
  },
  em_deslocamento_destino: {
    key: "em_deslocamento_destino",
    label: "A caminho do destino",
    short: "→ Destino",
    accent: "cyan",
    border: "border-l-cyan-500",
    dot: "bg-cyan-500",
    pillBg: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
    pillBgLight: "bg-cyan-100 text-cyan-800 ring-cyan-200",
  },
  chegou_destino: {
    key: "chegou_destino",
    label: "Chegou ao destino",
    short: "Chegou",
    accent: "emerald",
    border: "border-l-emerald-500",
    dot: "bg-emerald-500",
    pillBg: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    pillBgLight: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  },
  retornando_origem: {
    key: "retornando_origem",
    label: "Retornando à origem",
    short: "Retornando",
    accent: "teal",
    border: "border-l-teal-500",
    dot: "bg-teal-500",
    pillBg: "bg-teal-500/15 text-teal-300 ring-teal-500/30",
    pillBgLight: "bg-teal-100 text-teal-800 ring-teal-200",
  },
  concluido: {
    key: "concluido",
    label: "Concluído",
    short: "Concluído",
    accent: "zinc",
    border: "border-l-zinc-400",
    dot: "bg-zinc-400",
    pillBg: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
    pillBgLight: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  },
  cancelado: {
    key: "cancelado",
    label: "Cancelado",
    short: "Cancelado",
    accent: "zinc",
    border: "border-l-zinc-500",
    dot: "bg-zinc-500",
    pillBg: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
    pillBgLight: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  },
};

const STATUS_ORDER = [
  "pendente_revisao",
  "novo",
  "aguardando_viatura",
  "viatura_designada",
  "em_deslocamento_origem",
  "paciente_embarcado",
  "em_deslocamento_destino",
  "chegou_destino",
  "retornando_origem",
  "concluido",
  "cancelado",
];

const UNITS = [
  { id: "upa_pirajá", short: "UPA Pirajá", full: "UPA 24h Pirajá" },
  { id: "upa_barreiras", short: "UPA Barreiras", full: "UPA 24h Barreiras" },
  { id: "upa_san_martin", short: "UPA San Martin", full: "UPA 24h San Martin" },
  { id: "upa_cajazeiras", short: "UPA Cajazeiras", full: "UPA 24h Cajazeiras X" },
  { id: "upa_brotas", short: "UPA Brotas", full: "UPA 24h Brotas" },
  { id: "upa_liberdade", short: "UPA Liberdade", full: "UPA 24h Liberdade" },
  { id: "pa_paripe", short: "PA Paripe", full: "Pronto Atendimento Paripe" },
  { id: "pa_periperi", short: "PA Periperi", full: "Pronto Atendimento Periperi" },
  { id: "pa_fazenda_grande", short: "PA Faz. Grande", full: "PA Fazenda Grande III" },
  { id: "pa_mussurunga", short: "PA Mussurunga", full: "Pronto Atendimento Mussurunga" },
  { id: "pa_itapuã", short: "PA Itapuã", full: "Pronto Atendimento Itapuã" },
  { id: "pa_são_cristóvão", short: "PA São Cristóvão", full: "PA São Cristóvão" },
  { id: "pa_pau_da_lima", short: "PA Pau da Lima", full: "Pronto Atendimento Pau da Lima" },
  { id: "pa_boca_da_mata", short: "PA Boca da Mata", full: "PA Boca da Mata" },
  { id: "upa_san_caetano", short: "UPA San Caetano", full: "UPA 24h San Caetano" },
  { id: "upa_castelo_branco", short: "UPA Castelo Branco", full: "UPA 24h Castelo Branco" },
  { id: "hmum", short: "Hosp. Mun.", full: "Hospital Municipal de Salvador" },
];

// Destination references (state / referência)
const DESTINOS = [
  "Hospital Manoel Victorino",
  "Hospital Couto Maia",
  "HGCA — Hosp. Geral Cleriston Andrade",
  "Hospital Roberto Santos",
  "Hospital Geral do Estado",
  "Hospital Ana Nery",
  "Hospital Sta. Izabel",
  "Hospital Português",
  "Maternidade Tsylla Balbino",
  "Hospital São Rafael",
  "HGE Salvador",
];

// Build a deterministic "now" so the mock looks fresh on any reload.
const NOW = new Date();
NOW.setSeconds(0, 0);
const MM_PER_MIN = 60 * 1000;
function inMin(offsetMin) {
  return new Date(NOW.getTime() + offsetMin * MM_PER_MIN);
}
function fmtHHMM(d) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtRel(d) {
  const diff = Math.round((d - NOW) / MM_PER_MIN);
  if (diff === 0) return "agora";
  if (diff < 0) {
    const a = -diff;
    if (a < 60) return `há ${a}min`;
    if (a < 60 * 24) return `há ${Math.round(a / 60)}h`;
    return `há ${Math.round(a / 1440)}d`;
  }
  if (diff < 60) return `em ${diff}min`;
  return `em ${Math.round(diff / 60)}h`;
}

// Helper to assemble a transport mock.
let _tid = 1000;
function T(o) {
  return {
    id: `T-${++_tid}`,
    paciente: o.paciente,
    idade: o.idade,
    cns: o.cns || "704 0030 8924 0528",
    cpf: o.cpf || "***.***.***-**",
    origem: o.origem,
    destino: o.destino,
    procedimento: o.procedimento,
    procedimentoLong: o.procedimentoLong || o.procedimento,
    motivo: o.motivo || "",
    deadline: o.deadline,
    janela: o.janela || null,
    tipo: o.tipo || "one_way",
    status: o.status,
    sinais: o.sinais || {
      pa: "120/80",
      fc: 88,
      fr: 18,
      spo2: 97,
      gcs: 15,
      temp: 36.6,
    },
    hipoteses: o.hipoteses || [],
    autor: o.autor || "Enf. Andrea S.",
    timeline: o.timeline || [],
    mensagem: o.mensagem || "",
    confianca: o.confianca || {},
  };
}

const TRANSPORTS = [
  // UPA Pirajá — column with 6+ in varied states
  T({
    paciente: "Maria das Graças Souza",
    idade: 67,
    origem: "upa_pirajá",
    destino: "Hospital Manoel Victorino",
    procedimento: "Internamento",
    procedimentoLong: "Internamento — clínica médica",
    deadline: inMin(-12),
    tipo: "one_way",
    status: "em_deslocamento_destino",
    sinais: { pa: "150/95", fc: 112, fr: 22, spo2: 93, gcs: 14, temp: 38.1 },
    hipoteses: ["Pneumonia comunitária", "ICC descompensada"],
    autor: "Enf. R. Lima",
    timeline: [
      { t: inMin(-95), who: "Sistema", what: "Mensagem recebida do WhatsApp", icon: "MessageSquare" },
      { t: inMin(-92), who: "Parser", what: "Campos extraídos automaticamente", icon: "Sparkles" },
      { t: inMin(-80), who: "Dr. Silva", what: "Status → aguardando_viatura", icon: "ArrowRight" },
      { t: inMin(-50), who: "Dr. Silva", what: "Viatura USB-12 designada", icon: "Ambulance" },
      { t: inMin(-30), who: "USB-12", what: "Em deslocamento à origem", icon: "Navigation" },
      { t: inMin(-15), who: "USB-12", what: "Paciente embarcado", icon: "User" },
      { t: inMin(-8), who: "USB-12", what: "A caminho do destino", icon: "Truck" },
    ],
    mensagem:
      "*SOLICITAÇÃO DE TRANSPORTE*\nUPA PIRAJÁ\n\nPaciente: Maria das Graças Souza, 67a\nCNS: 704003089240528\n\nDestino: H. Manoel Victorino\nMotivo: Internamento — pneumonia + ICC desc.\n\nCHEGAR ATÉ 14:30\n\nPA 150x95 · FC 112 · FR 22 · SatO2 93% AA · GCS 14 · Tax 38,1\n\nEnf. plantão",
  }),
  T({
    paciente: "José Roberto Alves",
    idade: 54,
    origem: "upa_pirajá",
    destino: "HGCA — Hosp. Geral Cleriston Andrade",
    procedimento: "Avaliação cardio.",
    procedimentoLong: "Avaliação cardiológica",
    deadline: inMin(22),
    tipo: "round_trip",
    status: "viatura_designada",
    sinais: { pa: "138/88", fc: 96, fr: 18, spo2: 96, gcs: 15, temp: 36.7 },
    hipoteses: ["Síndrome coronariana aguda — descartar"],
  }),
  T({
    paciente: "Antônio Carlos Pereira",
    idade: 71,
    origem: "upa_pirajá",
    destino: "Hospital Roberto Santos",
    procedimento: "Internamento",
    deadline: inMin(8),
    tipo: "one_way",
    status: "aguardando_viatura",
    sinais: { pa: "100/60", fc: 124, fr: 26, spo2: 89, gcs: 13, temp: 39.0 },
    hipoteses: ["Sepse de foco pulmonar"],
  }),
  T({
    paciente: "Luciana Ferreira",
    idade: 33,
    origem: "upa_pirajá",
    destino: "Maternidade Tsylla Balbino",
    procedimento: "Internamento obstétrico",
    deadline: inMin(45),
    tipo: "one_way",
    status: "novo",
    sinais: { pa: "128/82", fc: 92, fr: 18, spo2: 98, gcs: 15, temp: 36.5 },
    hipoteses: ["DHEG", "Trabalho de parto prematuro"],
  }),
  T({
    paciente: "Edmilson Tavares",
    idade: 62,
    origem: "upa_pirajá",
    destino: "Hospital Ana Nery",
    procedimento: "Hemodiálise",
    deadline: inMin(95),
    tipo: "round_trip",
    status: "chegou_destino",
  }),
  T({
    paciente: "Rita de Cássia Mendes",
    idade: 58,
    origem: "upa_pirajá",
    destino: "Hospital Sta. Izabel",
    procedimento: "Consulta neuro.",
    deadline: inMin(180),
    tipo: "round_trip",
    status: "concluido",
  }),
  T({
    paciente: "Cleberson Matos",
    idade: 41,
    origem: "upa_pirajá",
    destino: "Hospital Couto Maia",
    procedimento: "Internamento",
    deadline: inMin(-180),
    tipo: "one_way",
    status: "concluido",
  }),

  // UPA Barreiras — sparse (1 transport)
  T({
    paciente: "Francisca de Oliveira",
    idade: 79,
    origem: "upa_barreiras",
    destino: "Hospital Manoel Victorino",
    procedimento: "Internamento",
    deadline: inMin(60),
    tipo: "one_way",
    status: "em_deslocamento_origem",
  }),

  // UPA San Martin — EMPTY (intentional)

  // UPA Cajazeiras — has delayed
  T({
    paciente: "Paulo Henrique Costa",
    idade: 28,
    origem: "upa_cajazeiras",
    destino: "Hospital Geral do Estado",
    procedimento: "Trauma — neurocir.",
    deadline: inMin(-25),
    tipo: "one_way",
    status: "paciente_embarcado",
    sinais: { pa: "90/55", fc: 130, fr: 28, spo2: 91, gcs: 9, temp: 36.2 },
    hipoteses: ["TCE grave", "Choque hemorrágico"],
  }),
  T({
    paciente: "Vanessa Almeida",
    idade: 45,
    origem: "upa_cajazeiras",
    destino: "Hospital Português",
    procedimento: "Consulta endocrino.",
    deadline: inMin(140),
    tipo: "round_trip",
    status: "aguardando_viatura",
  }),
  T({
    paciente: "Roberto Nogueira",
    idade: 66,
    origem: "upa_cajazeiras",
    destino: "Hospital Couto Maia",
    procedimento: "Avaliação infecto.",
    deadline: inMin(15),
    tipo: "round_trip",
    status: "novo",
  }),

  // UPA Brotas — pendente_revisao
  T({
    paciente: "Diogo Vasconcelos",
    idade: 36,
    origem: "upa_brotas",
    destino: "Hospital Roberto Santos",
    procedimento: "Exame — TC crânio",
    deadline: inMin(75),
    tipo: "round_trip",
    status: "pendente_revisao",
    confianca: { destino: "low", deadline: "low", procedimento: "med" },
    mensagem:
      "Bom dia drs\nUPA BROTAS\n\npcte Diogo Vasconcelos 36a\nprecisa tc cranio com urgencia, parece q ta com hemorragia\ndestino: roberto santos? ou hge?\n\nhoje a tarde, qto antes\n\n*PA 160x100 FC 105 FR 20 sat 95% gcs 14*",
  }),
  T({
    paciente: "Helena Macedo",
    idade: 52,
    origem: "upa_brotas",
    destino: "Hospital Manoel Victorino",
    procedimento: "Internamento",
    deadline: inMin(50),
    tipo: "one_way",
    status: "retornando_origem",
  }),

  // UPA Liberdade
  T({
    paciente: "Severino Bispo",
    idade: 73,
    origem: "upa_liberdade",
    destino: "Hospital Ana Nery",
    procedimento: "Internamento",
    deadline: inMin(20),
    tipo: "one_way",
    status: "em_deslocamento_destino",
  }),
  T({
    paciente: "Carla Tavares",
    idade: 39,
    origem: "upa_liberdade",
    destino: "Hospital Sta. Izabel",
    procedimento: "Consulta gineco.",
    deadline: inMin(120),
    tipo: "round_trip",
    status: "viatura_designada",
  }),
  T({
    paciente: "Mateus Rocha",
    idade: 19,
    origem: "upa_liberdade",
    destino: "HGE Salvador",
    procedimento: "Trauma ortopédico",
    deadline: inMin(-3),
    tipo: "one_way",
    status: "em_deslocamento_destino",
    sinais: { pa: "110/70", fc: 118, fr: 22, spo2: 95, gcs: 15, temp: 36.5 },
  }),

  // PA Paripe
  T({
    paciente: "Joana Ribeiro",
    idade: 84,
    origem: "pa_paripe",
    destino: "Hospital Roberto Santos",
    procedimento: "Internamento",
    deadline: inMin(35),
    tipo: "one_way",
    status: "novo",
  }),
  T({
    paciente: "Fernando Sá",
    idade: 47,
    origem: "pa_paripe",
    destino: "Hospital Português",
    procedimento: "Avaliação vascular",
    deadline: inMin(160),
    tipo: "round_trip",
    status: "aguardando_viatura",
  }),

  // PA Periperi
  T({
    paciente: "Sandra Quirino",
    idade: 61,
    origem: "pa_periperi",
    destino: "Hospital Manoel Victorino",
    procedimento: "Internamento",
    deadline: inMin(28),
    tipo: "one_way",
    status: "aguardando_viatura",
  }),
  T({
    paciente: "Reinaldo Borges",
    idade: 55,
    origem: "pa_periperi",
    destino: "HGCA — Hosp. Geral Cleriston Andrade",
    procedimento: "Cancelado",
    deadline: inMin(40),
    tipo: "round_trip",
    status: "cancelado",
  }),

  // PA Mussurunga
  T({
    paciente: "Beatriz Lopes",
    idade: 8,
    origem: "pa_mussurunga",
    destino: "Hospital Couto Maia",
    procedimento: "Internamento pediátrico",
    deadline: inMin(55),
    tipo: "one_way",
    status: "viatura_designada",
    sinais: { pa: "95/60", fc: 138, fr: 30, spo2: 94, gcs: 15, temp: 38.4 },
  }),

  // HMUM
  T({
    paciente: "Anderson Cruz",
    idade: 44,
    origem: "hmum",
    destino: "Hospital Ana Nery",
    procedimento: "Transf. UTI",
    deadline: inMin(10),
    tipo: "one_way",
    status: "em_deslocamento_origem",
    sinais: { pa: "85/50", fc: 132, fr: 26, spo2: 92, gcs: 11, temp: 37.9 },
  }),
];

// Counts
function urgent(t) {
  const mins = Math.round((t.deadline - NOW) / MM_PER_MIN);
  return (
    (mins < 30 && !["chegou_destino", "concluido", "cancelado"].includes(t.status)) ||
    mins < 0
  );
}
function overdue(t) {
  return t.deadline < NOW && !["chegou_destino", "concluido", "cancelado"].includes(t.status);
}

Object.assign(window, {
  STATUS,
  STATUS_ORDER,
  UNITS,
  DESTINOS,
  TRANSPORTS,
  NOW,
  fmtHHMM,
  fmtRel,
  urgent,
  overdue,
  inMin,
});
