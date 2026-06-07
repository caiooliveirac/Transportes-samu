import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { inArray, sql } from "drizzle-orm";
import {
  UNITS,
  type AmbulanceKind,
  type TransportStatus,
  type TripType,
  type Vitals,
} from "@samu-cru/shared";
import { loadMonorepoEnv } from "./load-env";
import {
  units,
  whatsappMessages,
  transportRequests,
  type NewTransportRequest,
} from "./schema";

loadMonorepoEnv();

/**
 * Seed de demonstração: panorama denso, diverso e COMPLETO da regulação do
 * SAMU/CRU Salvador para valorizar o painel grid. Diferente do ingest
 * Baileys (que trazia pacientes incompletos), aqui todo caso é preenchido
 * corretamente: paciente + idade + CNS + CPF, rota com serviço clínico de
 * destino, procedimento detalhado, vitais coerentes com a hipótese,
 * hipóteses diagnósticas, prazo, tipo de viagem e viatura quando já há
 * designação.
 *
 * Cobertura intencional:
 *  - As 3 unidades SEM ambulância própria (faixa "Prioridade da rede"):
 *    Rodrigo Argolo (PA Tancredo Neves), Orlando Imbassahy (UPA Bairro da
 *    Paz) e Hélio Machado — sempre movimentadas, com urgências.
 *  - Gravidade: crítico (TCE/choque/AVC/IAM/sepse), grave (DPOC/HDA/peds)
 *    e estável (consultas/exames/hemodiálise/quimio).
 *  - Todos os 11 status, prazos atrasados/urgentes/folgados/sem prazo,
 *    viatura USA (graves) e USB (remoções) a partir de "viatura_designada".
 *  - UPA San Martin deixada vazia (vai pro rodapé "Sem pendências").
 *
 * NÃO é idempotente: faz RESET (TRUNCATE) de transport_requests +
 * transport_events + whatsapp_messages e remove units órfãs antes de
 * inserir. Rode `pnpm db:seed` antes para garantir as 17 unidades.
 */

interface MockTransport {
  patientName: string;
  patientAgeYears: number;
  /** Sobrescreve o CNS gerado (ex.: casos com mensagem original). */
  patientCns?: string;
  patientCpf?: string;
  originUnitCode: string;
  destination: string;
  procedure: string;
  /** Offset em minutos relativo ao "now" do seed. null = sem prazo. */
  deadlineOffsetMin: number | null;
  tripType: TripType;
  status: TransportStatus;
  vitals: Vitals;
  diagnoses: string[];
  ambulanceLabel?: string;
  ambulanceKind?: AmbulanceKind;
  whatsappRawText?: string;
  whatsappOffsetMin?: number;
  parseConfidence?: number;
  parseWarnings?: string[];
}

/** CNS plausível de 15 dígitos (determinístico, sem Math.random). */
function genCns(seed: number): string {
  let x = ((seed + 17) * 2654435761) >>> 0;
  let s = "7";
  while (s.length < 15) {
    x = (x * 1103515245 + 12345) >>> 0;
    s += (x % 10).toString();
  }
  return s.slice(0, 15);
}

/** CPF plausível de 11 dígitos (determinístico). */
function genCpf(seed: number): string {
  let x = ((seed + 97) * 40503) >>> 0;
  let s = "";
  while (s.length < 11) {
    x = (x * 1103515245 + 12345) >>> 0;
    s += (x % 10).toString();
  }
  return s.slice(0, 11);
}

const RODRIGO_ARGOLO_RAW = `*SOLICITAÇÃO DE TRANSPORTE — SAMU/CRU*
PA TANCREDO NEVES (Rodrigo Argolo)

Paciente: Manoel dos Santos Conceição, 58a
CNS: 707004812350017 · CPF: 024.918.305-77

Destino: H. Ana Nery — Hemodinâmica
Motivo: IAM com supra de ST — angioplastia primária

*TEMPO PORTA-BALÃO — TRANSPORTE IMEDIATO*

PA 90/60 · FC 118 · FR 24 · SatO2 92% AA · GCS 15 · Dextro 187

Não temos viatura própria, dependemos da rede.
Enf. Rosângela — plantão`;

const HELIO_MACHADO_RAW = `bom dia
UPA HELIO MACHADO

pcte idosa, dona Raimunda, 81 anos
caiu em casa, fratura de fêmur, muita dor
precisa ir pro Roberto Santos pra ortopedia
sem ambulancia aqui, manda viatura pfv

PA 150/90 FC 96 sat 96%`;

const BROTAS_RAW = `Drs bom dia, UPA BROTAS
pcte Diogo Vasconcelos 36a, bateu a cabeça em queda
parece q ta com hemorragia, tc de cranio com urgencia
destino roberto santos? ou hge?
hoje qto antes
*PA 160/100 FC 105 FR 20 sat 95% gcs 14*`;

const MOCKS: ReadonlyArray<MockTransport> = [
  // ════════════════════════════════════════════════════════════════
  // PRIORIDADE DA REDE — unidades sem ambulância própria
  // ════════════════════════════════════════════════════════════════

  // ─── PA Tancredo Neves / Rodrigo Argolo (5) ───
  {
    patientName: "Manoel dos Santos Conceição",
    patientAgeYears: 58,
    patientCns: "707004812350017",
    patientCpf: "02491830577",
    originUnitCode: "pa_tancredo_neves",
    destination: "Hospital Ana Nery — Hemodinâmica",
    procedure: "IAM com supra de ST — angioplastia primária (porta-balão)",
    deadlineOffsetMin: -6,
    tripType: "one_way",
    status: "em_deslocamento_origem",
    vitals: { pa: "90/60", fc: 118, fr: 24, spo2: 92, glasgow: 15, dextro: 187 },
    diagnoses: ["IAM com supra de ST"],
    ambulanceLabel: "SM01",
    ambulanceKind: "USA",
    whatsappRawText: RODRIGO_ARGOLO_RAW,
    whatsappOffsetMin: -38,
  },
  {
    patientName: "Gilberto Araújo Lima",
    patientAgeYears: 47,
    originUnitCode: "pa_tancredo_neves",
    destination: "Hospital Geral do Estado (HGE) — Cirurgia do Trauma",
    procedure: "Ferimento por arma branca em tórax — drenagem + cirurgia",
    deadlineOffsetMin: -18,
    tripType: "one_way",
    status: "aguardando_viatura",
    vitals: { pa: "85/55", fc: 132, fr: 28, spo2: 90, glasgow: 14 },
    diagnoses: ["Hemotórax traumático", "Choque hipovolêmico"],
  },
  {
    patientName: "Cristiane Borges da Silva",
    patientAgeYears: 31,
    originUnitCode: "pa_tancredo_neves",
    destination: "Maternidade Tsylla Balbino — Obstetrícia",
    procedure: "Pré-eclâmpsia grave — internamento obstétrico",
    deadlineOffsetMin: 16,
    tripType: "one_way",
    status: "viatura_designada",
    vitals: { pa: "172/112", fc: 98, fr: 20, spo2: 97, glasgow: 15 },
    diagnoses: ["DHEG", "Pré-eclâmpsia grave"],
    ambulanceLabel: "CB02",
    ambulanceKind: "USA",
  },
  {
    patientName: "Severino Bispo de Jesus",
    patientAgeYears: 69,
    originUnitCode: "pa_tancredo_neves",
    destination: "Hospital Santa Izabel — Oftalmologia",
    procedure: "Pós-operatório de catarata — reavaliação",
    deadlineOffsetMin: 150,
    tripType: "round_trip",
    status: "novo",
    vitals: { pa: "138/82", fc: 76, fr: 16, spo2: 98, glasgow: 15 },
    diagnoses: ["Pós-operatório oftalmológico"],
  },
  {
    patientName: "Adenilson Ramos Cardoso",
    patientAgeYears: 53,
    originUnitCode: "pa_tancredo_neves",
    destination: "Hospital Ana Nery — Nefrologia",
    procedure: "Hemodiálise — sessão programada (3ª/5ª/sáb)",
    deadlineOffsetMin: 70,
    tripType: "round_trip",
    status: "aguardando_viatura",
    vitals: { pa: "150/88", fc: 84, fr: 18, spo2: 97, glasgow: 15 },
    diagnoses: ["Doença renal crônica dialítica"],
  },

  // ─── UPA Bairro da Paz / Orlando Imbassahy (4) ───
  {
    patientName: "Antônia Ferreira dos Reis",
    patientAgeYears: 74,
    originUnitCode: "upa_bairro_da_paz",
    destination: "Hospital Geral Roberto Santos — Neurologia",
    procedure: "AVC isquêmico em janela — trombólise",
    deadlineOffsetMin: 5,
    tripType: "one_way",
    status: "viatura_designada",
    vitals: { pa: "178/96", fc: 88, fr: 18, spo2: 95, glasgow: 13, dextro: 142 },
    diagnoses: ["AVC isquêmico agudo"],
    ambulanceLabel: "PR03",
    ambulanceKind: "USA",
  },
  {
    patientName: "Wesley Nascimento Pinto",
    patientAgeYears: 23,
    originUnitCode: "upa_bairro_da_paz",
    destination: "Hospital do Subúrbio — Ortopedia",
    procedure: "Fratura exposta de tíbia — fixação de urgência",
    deadlineOffsetMin: 34,
    tripType: "one_way",
    status: "aguardando_viatura",
    vitals: { pa: "120/80", fc: 104, fr: 18, spo2: 98, glasgow: 15 },
    diagnoses: ["Fratura exposta de tíbia (Gustilo II)"],
  },
  {
    patientName: "Marlene Souza Andrade",
    patientAgeYears: 66,
    originUnitCode: "upa_bairro_da_paz",
    destination: "Hospital Ana Nery — Nefrologia",
    procedure: "Hemodiálise — sessão programada",
    deadlineOffsetMin: 95,
    tripType: "round_trip",
    status: "novo",
    vitals: { pa: "146/86", fc: 80, fr: 16, spo2: 97, glasgow: 15 },
    diagnoses: ["Doença renal crônica dialítica"],
  },
  {
    patientName: "Domingos Sávio Pereira",
    patientAgeYears: 60,
    originUnitCode: "upa_bairro_da_paz",
    destination: "Hospital Especializado Octávio Mangabeira — Pneumologia",
    procedure: "DPOC agudizada — suporte ventilatório",
    deadlineOffsetMin: -10,
    tripType: "one_way",
    status: "em_deslocamento_destino",
    vitals: { pa: "140/84", fc: 110, fr: 28, spo2: 88, glasgow: 15, temp: 37.6 },
    diagnoses: ["DPOC agudizada", "Insuficiência respiratória"],
    ambulanceLabel: "PM04",
    ambulanceKind: "USA",
  },

  // ─── UPA Hélio Machado (4) ───
  {
    patientName: "Raimunda Oliveira da Mata",
    patientAgeYears: 81,
    originUnitCode: "upa_helio_machado",
    destination: "Hospital Geral Roberto Santos — Ortopedia",
    procedure: "Fratura de colo de fêmur — internamento ortopédico",
    deadlineOffsetMin: 40,
    tripType: "one_way",
    status: "pendente_revisao",
    vitals: { pa: "150/90", fc: 96, fr: 18, spo2: 96, glasgow: 15 },
    diagnoses: ["Fratura de colo de fêmur"],
    whatsappRawText: HELIO_MACHADO_RAW,
    whatsappOffsetMin: -15,
    parseConfidence: 0.62,
    parseWarnings: [
      "destino sem unidade clínica explícita",
      "idade informada por extenso",
    ],
  },
  {
    patientName: "João Batista Rocha",
    patientAgeYears: 64,
    originUnitCode: "upa_helio_machado",
    destination: "Hospital Santa Izabel — Cardiologia",
    procedure: "Avaliação cardiológica — dor torácica atípica",
    deadlineOffsetMin: 25,
    tripType: "round_trip",
    status: "aguardando_viatura",
    vitals: { pa: "158/94", fc: 92, fr: 18, spo2: 97, glasgow: 15, dextro: 121 },
    diagnoses: ["Dor torácica a esclarecer"],
  },
  {
    patientName: "Maria Aparecida Lopes",
    patientAgeYears: 49,
    originUnitCode: "upa_helio_machado",
    destination: "Hospital Aristides Maltez — Oncologia",
    procedure: "Quimioterapia — ciclo agendado",
    deadlineOffsetMin: 180,
    tripType: "round_trip",
    status: "novo",
    vitals: { pa: "124/78", fc: 82, fr: 16, spo2: 98, glasgow: 15 },
    diagnoses: ["Neoplasia de mama em tratamento"],
  },
  {
    patientName: "Edvaldo Santana Filho",
    patientAgeYears: 57,
    originUnitCode: "upa_helio_machado",
    destination: "Hospital Couto Maia — Infectologia",
    procedure: "Sepse de foco pulmonar — internamento",
    deadlineOffsetMin: 8,
    tripType: "one_way",
    status: "viatura_designada",
    vitals: { pa: "96/58", fc: 126, fr: 26, spo2: 90, glasgow: 14, temp: 39.2 },
    diagnoses: ["Sepse de foco pulmonar"],
    ambulanceLabel: "BR05",
    ambulanceKind: "USA",
  },

  // ════════════════════════════════════════════════════════════════
  // DEMAIS UNIDADES
  // ════════════════════════════════════════════════════════════════

  // ─── UPA Pirajá (4) ───
  {
    patientName: "Maria das Graças Souza",
    patientAgeYears: 67,
    originUnitCode: "upa_piraja",
    destination: "Hospital Manoel Victorino — Clínica Médica",
    procedure: "Pneumonia comunitária + ICC descompensada — internamento",
    deadlineOffsetMin: -14,
    tripType: "one_way",
    status: "em_deslocamento_destino",
    vitals: { pa: "150/95", fc: 112, fr: 22, spo2: 93, glasgow: 14, temp: 38.1 },
    diagnoses: ["Pneumonia comunitária", "ICC descompensada"],
    ambulanceLabel: "CN11",
    ambulanceKind: "USB",
  },
  {
    patientName: "Edmilson Tavares Brito",
    patientAgeYears: 62,
    originUnitCode: "upa_piraja",
    destination: "Hospital Ana Nery — Nefrologia",
    procedure: "Hemodiálise — sessão programada",
    deadlineOffsetMin: 90,
    tripType: "round_trip",
    status: "chegou_destino",
    vitals: { pa: "138/82", fc: 78, fr: 16, spo2: 98, glasgow: 15 },
    diagnoses: ["Doença renal crônica dialítica"],
    ambulanceLabel: "CN12",
    ambulanceKind: "USB",
  },
  {
    patientName: "Luciana Ferreira Campos",
    patientAgeYears: 33,
    originUnitCode: "upa_piraja",
    destination: "Maternidade Climério de Oliveira — Alto Risco",
    procedure: "Trabalho de parto prematuro — internamento obstétrico",
    deadlineOffsetMin: 28,
    tripType: "one_way",
    status: "novo",
    vitals: { pa: "128/82", fc: 92, fr: 18, spo2: 98, glasgow: 15 },
    diagnoses: ["Trabalho de parto prematuro (32 sem)"],
  },
  {
    patientName: "Antônio Carlos Pereira",
    patientAgeYears: 71,
    originUnitCode: "upa_piraja",
    destination: "Hospital Couto Maia — Infectologia",
    procedure: "Sepse de foco urinário — internamento",
    deadlineOffsetMin: 6,
    tripType: "one_way",
    status: "aguardando_viatura",
    vitals: { pa: "100/60", fc: 124, fr: 26, spo2: 89, glasgow: 13, temp: 39.0 },
    diagnoses: ["Sepse de foco urinário"],
  },

  // ─── UPA Brotas (3) ───
  {
    patientName: "Diogo Vasconcelos Lima",
    patientAgeYears: 36,
    originUnitCode: "upa_brotas",
    destination: "Hospital Geral Roberto Santos — Neurocirurgia",
    procedure: "TCE — TC de crânio, suspeita de hemorragia",
    deadlineOffsetMin: 12,
    tripType: "round_trip",
    status: "pendente_revisao",
    vitals: { pa: "160/100", fc: 105, fr: 20, spo2: 95, glasgow: 14 },
    diagnoses: ["TCE", "HSA — a descartar"],
    whatsappRawText: BROTAS_RAW,
    whatsappOffsetMin: -22,
    parseConfidence: 0.55,
    parseWarnings: [
      "destino ambíguo (duas opções oferecidas)",
      "urgência sem horário explícito",
    ],
  },
  {
    patientName: "Helena Macedo Quintela",
    patientAgeYears: 52,
    originUnitCode: "upa_brotas",
    destination: "Hospital Santa Izabel — Clínica Médica",
    procedure: "Crise hipertensiva controlada — retorno à origem",
    deadlineOffsetMin: 55,
    tripType: "one_way",
    status: "retornando_origem",
    vitals: { pa: "140/88", fc: 80, fr: 16, spo2: 98, glasgow: 15 },
    diagnoses: ["Crise hipertensiva"],
    ambulanceLabel: "SM17",
    ambulanceKind: "USB",
  },
  {
    patientName: "Robson Carvalho Dias",
    patientAgeYears: 44,
    originUnitCode: "upa_brotas",
    destination: "Hospital São Rafael — Hemodinâmica",
    procedure: "Cateterismo cardíaco — investigação de angina",
    deadlineOffsetMin: 130,
    tripType: "round_trip",
    status: "novo",
    vitals: { pa: "134/86", fc: 88, fr: 16, spo2: 97, glasgow: 15, dextro: 110 },
    diagnoses: ["Angina instável — investigar"],
  },

  // ─── UPA Barris (3) ───
  {
    patientName: "Fernando Sá Menezes",
    patientAgeYears: 57,
    originUnitCode: "upa_barris",
    destination: "Hospital Português — Cirurgia Vascular",
    procedure: "Isquemia arterial aguda de membro — avaliação cirúrgica",
    deadlineOffsetMin: 30,
    tripType: "round_trip",
    status: "viatura_designada",
    vitals: { pa: "144/88", fc: 96, fr: 18, spo2: 97, glasgow: 15 },
    diagnoses: ["Isquemia arterial aguda"],
    ambulanceLabel: "PP21",
    ambulanceKind: "USB",
  },
  {
    patientName: "Isabela Nunes Carvalho",
    patientAgeYears: 5,
    originUnitCode: "upa_barris",
    destination: "Hospital Martagão Gesteira — Pediatria",
    procedure: "Crise asmática grave — internamento pediátrico",
    deadlineOffsetMin: -4,
    tripType: "one_way",
    status: "paciente_embarcado",
    vitals: { pa: "95/60", fc: 148, fr: 36, spo2: 88, glasgow: 15, temp: 38.2 },
    diagnoses: ["Crise asmática grave", "Insuficiência respiratória"],
    ambulanceLabel: "CN10",
    ambulanceKind: "USA",
  },
  {
    patientName: "Otávio Mendonça Reis",
    patientAgeYears: 78,
    originUnitCode: "upa_barris",
    destination: "Hospital da Cidade — Clínica Médica",
    procedure: "Internamento — desidratação e infecção urinária",
    deadlineOffsetMin: null,
    tripType: "one_way",
    status: "aguardando_viatura",
    vitals: { pa: "110/70", fc: 92, fr: 18, spo2: 95, glasgow: 14, temp: 37.5 },
    diagnoses: ["ITU", "Desidratação"],
  },

  // ─── HMUM — Hospital Municipal (3) ───
  {
    patientName: "Anderson Cruz Bandeira",
    patientAgeYears: 44,
    originUnitCode: "hmum",
    destination: "Hospital Geral do Estado (HGE) — UTI",
    procedure: "Transferência UTI — politrauma por acidente de trânsito",
    deadlineOffsetMin: 8,
    tripType: "one_way",
    status: "em_deslocamento_origem",
    vitals: { pa: "85/50", fc: 132, fr: 26, spo2: 90, glasgow: 9, temp: 37.9 },
    diagnoses: ["Politrauma", "TCE grave"],
    ambulanceLabel: "PP20",
    ambulanceKind: "USA",
  },
  {
    patientName: "Terezinha de Jesus Alves",
    patientAgeYears: 88,
    originUnitCode: "hmum",
    destination: "Hospital da Cidade — Clínica Médica",
    procedure: "Internamento clínico — ITU e desidratação",
    deadlineOffsetMin: 120,
    tripType: "one_way",
    status: "novo",
    vitals: { pa: "112/70", fc: 90, fr: 18, spo2: 95, glasgow: 14, temp: 37.4 },
    diagnoses: ["ITU", "Desidratação"],
  },
  {
    patientName: "Sérgio Murilo Andrade",
    patientAgeYears: 51,
    originUnitCode: "hmum",
    destination: "Hospital Geral Roberto Santos — Gastroenterologia",
    procedure: "Hemorragia digestiva alta — endoscopia de urgência",
    deadlineOffsetMin: -2,
    tripType: "one_way",
    status: "paciente_embarcado",
    vitals: { pa: "98/62", fc: 116, fr: 20, spo2: 96, glasgow: 15 },
    diagnoses: ["Hemorragia digestiva alta"],
    ambulanceLabel: "CB25",
    ambulanceKind: "USB",
  },

  // ─── PA Pernambués (2) ───
  {
    patientName: "Patrícia Gomes Teixeira",
    patientAgeYears: 39,
    originUnitCode: "pa_pernambues",
    destination: "Hospital Juliano Moreira — Psiquiatria",
    procedure: "Surto psicótico agudo — avaliação psiquiátrica",
    deadlineOffsetMin: 45,
    tripType: "one_way",
    status: "aguardando_viatura",
    vitals: { pa: "132/84", fc: 98, fr: 18, spo2: 98, glasgow: 15 },
    diagnoses: ["Surto psicótico agudo"],
  },
  {
    patientName: "Roberto Nogueira Filho",
    patientAgeYears: 66,
    originUnitCode: "pa_pernambues",
    destination: "Hospital Couto Maia — Infectologia",
    procedure: "Erisipela extensa — avaliação infectológica",
    deadlineOffsetMin: 75,
    tripType: "round_trip",
    status: "novo",
    vitals: { pa: "138/82", fc: 88, fr: 18, spo2: 97, glasgow: 15, temp: 38.0 },
    diagnoses: ["Erisipela de membro inferior"],
  },

  // ─── UPA Valéria (2) ───
  {
    patientName: "Jailson Pereira dos Anjos",
    patientAgeYears: 28,
    originUnitCode: "upa_valeria",
    destination: "Hospital Geral do Estado (HGE) — Neurocirurgia",
    procedure: "TCE grave por acidente de moto — neurocirurgia",
    deadlineOffsetMin: -26,
    tripType: "one_way",
    status: "paciente_embarcado",
    vitals: { pa: "90/55", fc: 130, fr: 28, spo2: 91, glasgow: 8 },
    diagnoses: ["TCE grave", "Choque hemorrágico"],
    ambulanceLabel: "IT30",
    ambulanceKind: "USA",
  },
  {
    patientName: "Sandra Quirino Matos",
    patientAgeYears: 61,
    originUnitCode: "upa_valeria",
    destination: "Hospital Manoel Victorino — Clínica Médica",
    procedure: "Descompensação diabética — internamento",
    deadlineOffsetMin: 50,
    tripType: "one_way",
    status: "aguardando_viatura",
    vitals: { pa: "128/80", fc: 104, fr: 22, spo2: 96, glasgow: 15, dextro: 412 },
    diagnoses: ["Cetoacidose diabética"],
  },

  // ─── UPA Santo Antônio (2) ───
  {
    patientName: "Carla Tavares Ribeiro",
    patientAgeYears: 41,
    originUnitCode: "upa_santo_antonio",
    destination: "Hospital São Rafael — Hemodinâmica",
    procedure: "Cateterismo cardíaco eletivo",
    deadlineOffsetMin: 120,
    tripType: "round_trip",
    status: "viatura_designada",
    vitals: { pa: "130/85", fc: 84, fr: 16, spo2: 98, glasgow: 15 },
    diagnoses: ["Angina estável — investigar"],
    ambulanceLabel: "IT31",
    ambulanceKind: "USB",
  },
  {
    patientName: "Nilton Barreto Souza",
    patientAgeYears: 70,
    originUnitCode: "upa_santo_antonio",
    destination: "Hospital Aliança — Cardiologia",
    procedure: "Bradiarritmia — avaliação para marcapasso",
    deadlineOffsetMin: 40,
    tripType: "round_trip",
    status: "novo",
    vitals: { pa: "118/72", fc: 42, fr: 16, spo2: 97, glasgow: 15 },
    diagnoses: ["Bloqueio atrioventricular total"],
  },

  // ─── UPA Paripe (2 — Subúrbio) ───
  {
    patientName: "Joana Ribeiro da Paixão",
    patientAgeYears: 84,
    originUnitCode: "upa_paripe",
    destination: "Hospital do Subúrbio — Clínica Médica",
    procedure: "ICC descompensada — internamento",
    deadlineOffsetMin: 38,
    tripType: "one_way",
    status: "em_deslocamento_destino",
    vitals: { pa: "100/65", fc: 110, fr: 24, spo2: 92, glasgow: 15 },
    diagnoses: ["ICC descompensada"],
    ambulanceLabel: "PR33",
    ambulanceKind: "USB",
  },
  {
    patientName: "Adriana Souza Pinto",
    patientAgeYears: 29,
    originUnitCode: "upa_paripe",
    destination: "Maternidade Tsylla Balbino — Obstetrícia",
    procedure: "Hiperêmese gravídica — internamento",
    deadlineOffsetMin: 100,
    tripType: "one_way",
    status: "novo",
    vitals: { pa: "108/66", fc: 96, fr: 18, spo2: 99, glasgow: 15 },
    diagnoses: ["Hiperêmese gravídica"],
  },

  // ─── PA São Marcos (2) ───
  {
    patientName: "Reinaldo Borges Sampaio",
    patientAgeYears: 55,
    originUnitCode: "pa_sao_marcos",
    destination: "Hospital Geral Cleriston Andrade (Feira de Santana) — Referência",
    procedure: "Avaliação cardiológica — transferência inter-municipal",
    deadlineOffsetMin: 60,
    tripType: "round_trip",
    status: "cancelado",
    vitals: { pa: "130/84", fc: 86, fr: 16, spo2: 98, glasgow: 15 },
    diagnoses: ["Insuficiência coronariana crônica"],
  },
  {
    patientName: "Lúcia Helena Farias",
    patientAgeYears: 63,
    originUnitCode: "pa_sao_marcos",
    destination: "Hospital Geral Roberto Santos — Neurologia",
    procedure: "AVC isquêmico estabilizado — internamento",
    deadlineOffsetMin: 20,
    tripType: "one_way",
    status: "viatura_designada",
    vitals: { pa: "164/92", fc: 82, fr: 18, spo2: 96, glasgow: 14, dextro: 138 },
    diagnoses: ["AVC isquêmico"],
    ambulanceLabel: "JA37",
    ambulanceKind: "USB",
  },

  // ─── PA Alfredo Bureau (2) ───
  {
    patientName: "Vanessa Almeida Cerqueira",
    patientAgeYears: 45,
    originUnitCode: "pa_alfredo_bureau",
    destination: "Hospital Português — Gastroenterologia",
    procedure: "Hemorragia digestiva alta — endoscopia",
    deadlineOffsetMin: 22,
    tripType: "round_trip",
    status: "aguardando_viatura",
    vitals: { pa: "108/68", fc: 108, fr: 18, spo2: 97, glasgow: 15 },
    diagnoses: ["Hemorragia digestiva alta"],
  },
  {
    patientName: "Geraldo Magela Pinto",
    patientAgeYears: 59,
    originUnitCode: "pa_alfredo_bureau",
    destination: "Hospital Ana Nery — Cardiologia",
    procedure: "ICC descompensada — internamento",
    deadlineOffsetMin: -8,
    tripType: "one_way",
    status: "em_deslocamento_destino",
    vitals: { pa: "150/96", fc: 118, fr: 26, spo2: 91, glasgow: 15 },
    diagnoses: ["ICC descompensada", "Edema agudo de pulmão"],
    ambulanceLabel: "PM40",
    ambulanceKind: "USA",
  },

  // ─── PA Maria da Conceição (2) ───
  {
    patientName: "Cleberson Matos Figueiredo",
    patientAgeYears: 41,
    originUnitCode: "pa_maria_conceicao",
    destination: "Hospital Couto Maia — Infectologia",
    procedure: "Meningite bacteriana — internamento",
    deadlineOffsetMin: -200,
    tripType: "one_way",
    status: "concluido",
    vitals: { pa: "120/78", fc: 96, fr: 18, spo2: 97, glasgow: 14, temp: 38.6 },
    diagnoses: ["Meningite bacteriana"],
    ambulanceLabel: "CZ50",
    ambulanceKind: "USA",
  },
  {
    patientName: "Eunice Carvalho Brandão",
    patientAgeYears: 72,
    originUnitCode: "pa_maria_conceicao",
    destination: "Hospital Aristides Maltez — Oncologia",
    procedure: "Radioterapia — sessão agendada",
    deadlineOffsetMin: 160,
    tripType: "round_trip",
    status: "novo",
    vitals: { pa: "126/76", fc: 78, fr: 16, spo2: 98, glasgow: 15 },
    diagnoses: ["Neoplasia em tratamento radioterápico"],
  },

  // ─── UPA Parque São Cristóvão (2) ───
  {
    patientName: "Mateus Rocha Andrade",
    patientAgeYears: 19,
    originUnitCode: "upa_parque_sao_cristovao",
    destination: "Hospital Geral do Estado (HGE) — Ortopedia",
    procedure: "Fratura de antebraço — redução cirúrgica",
    deadlineOffsetMin: 85,
    tripType: "one_way",
    status: "novo",
    vitals: { pa: "120/75", fc: 88, fr: 16, spo2: 99, glasgow: 15 },
    diagnoses: ["Fratura de antebraço"],
  },
  {
    patientName: "Rosa Maria Lima Costa",
    patientAgeYears: 68,
    originUnitCode: "upa_parque_sao_cristovao",
    destination: "Hospital Santa Izabel — Clínica Médica",
    procedure: "Internamento clínico — pneumonia",
    deadlineOffsetMin: 65,
    tripType: "one_way",
    status: "chegou_destino",
    vitals: { pa: "132/80", fc: 100, fr: 22, spo2: 93, glasgow: 15, temp: 38.3 },
    diagnoses: ["Pneumonia comunitária"],
    ambulanceLabel: "PM41",
    ambulanceKind: "USB",
  },

  // ─── UPA Periperi (1) ───
  {
    patientName: "Manuela Santos Aragão",
    patientAgeYears: 2,
    originUnitCode: "upa_periperi",
    destination: "Hospital Martagão Gesteira — Pediatria",
    procedure: "Gastroenterite com desidratação grave — internamento",
    deadlineOffsetMin: 18,
    tripType: "one_way",
    status: "aguardando_viatura",
    vitals: { pa: "85/55", fc: 152, fr: 32, spo2: 96, glasgow: 15, temp: 38.8 },
    diagnoses: ["Gastroenterite aguda", "Desidratação grave"],
  },

  // ─── UPA San Martin — deixada VAZIA de propósito (rodapé
  //     "Sem pendências") ───
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  const unitRows = await db.select().from(units);
  if (unitRows.length === 0) {
    throw new Error(
      "units table is empty — run `pnpm db:seed` first to seed the 17 units.",
    );
  }

  // RESET: limpa transportes/eventos/mensagens e units órfãs (códigos fora
  // de @samu-cru/shared, ex. seeds antigos do ingest).
  console.log("[seed-mock] reset: truncating transports + whatsapp_messages");
  await db.execute(
    sql`TRUNCATE TABLE transport_requests, transport_events, whatsapp_messages RESTART IDENTITY CASCADE`,
  );

  const canonical = new Set(UNITS.map((u) => u.code));
  const orphans = unitRows.filter((u) => !canonical.has(u.code));
  if (orphans.length > 0) {
    await db.delete(units).where(
      inArray(
        units.code,
        orphans.map((o) => o.code),
      ),
    );
    console.log(
      `[seed-mock] removed ${orphans.length} orphan units: ${orphans
        .map((o) => o.code)
        .join(", ")}`,
    );
  }

  const freshUnits = await db.select().from(units);
  const unitMap = new Map(freshUnits.map((u) => [u.code, u.id]));

  const unknown = MOCKS.filter((m) => !unitMap.has(m.originUnitCode));
  if (unknown.length > 0) {
    throw new Error(
      `[seed-mock] mock references unknown unit codes: ${[
        ...new Set(unknown.map((m) => m.originUnitCode)),
      ].join(", ")}`,
    );
  }

  const now = new Date();

  // whatsapp_messages para as demos de "mensagem original".
  const waIdByPatient = new Map<string, number>();
  let waCount = 0;
  for (const m of MOCKS) {
    if (!m.whatsappRawText) continue;
    const receivedAt = new Date(
      now.getTime() + (m.whatsappOffsetMin ?? -90) * 60_000,
    );
    const waSlug = m.patientName.toLowerCase().replace(/\s+/g, "-");
    const [row] = await db
      .insert(whatsappMessages)
      .values({
        waMessageId: `mock-${++waCount}-${waSlug}`,
        waChatId: "mock-cru-group@g.us",
        waSenderId: "mock-sender@s.whatsapp.net",
        rawText: m.whatsappRawText,
        receivedAt,
      })
      .returning({ id: whatsappMessages.id });
    if (row) waIdByPatient.set(m.patientName, row.id);
  }

  const rows: NewTransportRequest[] = MOCKS.map((m, idx) => {
    const deadlineAt =
      m.deadlineOffsetMin === null
        ? null
        : new Date(now.getTime() + m.deadlineOffsetMin * 60_000);
    const createdAt = new Date(now.getTime() - (idx * 6 + 25) * 60_000);
    const assignedAt = m.ambulanceLabel
      ? new Date(createdAt.getTime() + 9 * 60_000)
      : undefined;
    return {
      whatsappMessageId: waIdByPatient.get(m.patientName),
      patientName: m.patientName,
      patientAgeText: `${m.patientAgeYears}a`,
      patientCns: m.patientCns ?? genCns(idx),
      patientCpf: m.patientCpf ?? genCpf(idx),
      originUnitId: unitMap.get(m.originUnitCode),
      originUnitRaw: m.originUnitCode,
      destinationName: m.destination,
      procedure: m.procedure,
      deadlineAt,
      tripType: m.tripType,
      vitals: m.vitals,
      diagnoses: m.diagnoses,
      status: m.status,
      ambulanceLabel: m.ambulanceLabel,
      ambulanceKind: m.ambulanceKind,
      ambulanceAssignedAt: assignedAt,
      parseConfidence: m.parseConfidence ?? 1.0,
      parseWarnings: m.parseWarnings,
      createdAt,
      updatedAt: createdAt,
    };
  });

  await db.insert(transportRequests).values(rows);

  const withVehicle = rows.filter((r) => r.ambulanceLabel).length;
  console.log(
    `[seed-mock] inserted ${rows.length} transports (${withVehicle} com viatura) + ${waCount} whatsapp_messages across ${
      new Set(MOCKS.map((m) => m.originUnitCode)).size
    } units`,
  );

  await client.end();
}

main().catch((err) => {
  console.error("[seed-mock] failed:", err);
  process.exit(1);
});
