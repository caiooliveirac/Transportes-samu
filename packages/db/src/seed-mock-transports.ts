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
 * Dev-only seed: panorama denso e diverso da regulação do SAMU/CRU Salvador
 * para exercitar o painel grid (prioridade da rede, gravidade derivada,
 * urgência, viaturas vinculadas, ciclo de vida completo).
 *
 * Cobertura intencional:
 *  - As 3 unidades SEM ambulância própria (faixa "Prioridade da rede"):
 *    Rodrigo Argolo (PA Tancredo Neves), Orlando Imbassahy (UPA Bairro da
 *    Paz) e Hélio Machado — sempre com pacientes, várias urgências.
 *  - Mistura de gravidade: crítico (TCE/choque/Glasgow baixo/SatO2 baixa),
 *    grave (IAM/sepse/DHEG) e estável (consultas/hemodiálise).
 *  - Todos os 11 status, incl. pendente_revisão, cancelado e concluídos
 *    (com fade), e prazos atrasados/urgentes/folgados/sem prazo.
 *  - Viatura (USA p/ graves, USB p/ remoções) vinculada a partir de
 *    "viatura_designada" — o prefixo aparece no card e no detalhe.
 *
 * NÃO é idempotente: faz RESET (TRUNCATE) de transport_requests +
 * transport_events + whatsapp_messages e remove units órfãs (códigos fora
 * de @samu-cru/shared) antes de inserir. Ferramenta de desenvolvimento —
 * rode `pnpm db:seed` antes para garantir as 17 unidades canônicas.
 */

interface MockTransport {
  patientName: string;
  patientAgeYears: number;
  patientCns?: string;
  patientCpf?: string;
  originUnitCode: string;
  destination: string;
  procedure: string;
  /** Offset em minutos relativo ao "now" do seed. null = sem prazo. */
  deadlineOffsetMin: number | null;
  tripType: TripType;
  status: TransportStatus;
  vitals?: Vitals;
  diagnoses?: string[];
  ambulanceLabel?: string;
  ambulanceKind?: AmbulanceKind;
  /** Se preenchido, cria whatsapp_messages e linka (demo "mensagem original"). */
  whatsappRawText?: string;
  whatsappOffsetMin?: number;
  parseConfidence?: number;
  parseWarnings?: string[];
}

const RODRIGO_ARGOLO_RAW = `*SOLICITAÇÃO DE TRANSPORTE — SAMU/CRU*
PA TANCREDO NEVES (Rodrigo Argolo)

Paciente: Manoel dos Santos Conceição, 58a
CNS: 707004812350017

Destino: H. Ana Nery (hemodinâmica)
Motivo: IAM com supra de ST — angioplastia primária

*TEMPO PORTA-BALÃO — TRANSPORTE IMEDIATO*

PA 90/60 · FC 118 · FR 24 · SatO2 92% · GCS 15 · Dextro 187

Não temos viatura própria, dependemos da rede.
Enf. plantão`;

const HELIO_MACHADO_RAW = `bom dia
UPA HELIO MACHADO

pcte idosa, dona Raimunda, 81 anos
caiu em casa, fratura de fêmur, muita dor
precisa ir pro Roberto Santos pra ortopedia
sem ambulancia aqui, manda viatura pfv

PA 150/90 FC 96 sat 96%`;

const MOCKS: ReadonlyArray<MockTransport> = [
  // ════════════════════════════════════════════════════════════════
  // PRIORIDADE DA REDE — unidades sem ambulância própria
  // ════════════════════════════════════════════════════════════════

  // ─── PA Tancredo Neves / Rodrigo Argolo (4 — densa, urgente) ───
  {
    patientName: "Manoel dos Santos Conceição",
    patientAgeYears: 58,
    patientCns: "707004812350017",
    originUnitCode: "pa_tancredo_neves",
    destination: "Hospital Ana Nery — Hemodinâmica",
    procedure: "IAM com supra — angioplastia primária",
    deadlineOffsetMin: -8,
    tripType: "one_way",
    status: "em_deslocamento_origem",
    vitals: { pa: "90/60", fc: 118, fr: 24, spo2: 92, glasgow: 15, dextro: 187 },
    diagnoses: ["IAM com supra de ST"],
    ambulanceLabel: "USA 02",
    ambulanceKind: "USA",
    whatsappRawText: RODRIGO_ARGOLO_RAW,
    whatsappOffsetMin: -42,
  },
  {
    patientName: "Gilberto Araújo Lima",
    patientAgeYears: 47,
    originUnitCode: "pa_tancredo_neves",
    destination: "Hospital Geral do Estado — HGE",
    procedure: "Trauma — ferimento por arma branca em tórax",
    deadlineOffsetMin: -22,
    tripType: "one_way",
    status: "aguardando_viatura",
    vitals: { pa: "85/55", fc: 132, fr: 28, spo2: 90, glasgow: 14 },
    diagnoses: ["Hemotórax", "Choque hipovolêmico"],
  },
  {
    patientName: "Cristiane Borges da Silva",
    patientAgeYears: 31,
    originUnitCode: "pa_tancredo_neves",
    destination: "Maternidade Tsylla Balbino",
    procedure: "Internamento obstétrico — pré-eclâmpsia grave",
    deadlineOffsetMin: 18,
    tripType: "one_way",
    status: "viatura_designada",
    vitals: { pa: "170/110", fc: 98, fr: 20, spo2: 97, glasgow: 15 },
    diagnoses: ["DHEG", "Pré-eclâmpsia grave"],
    ambulanceLabel: "USA 01",
    ambulanceKind: "USA",
  },
  {
    patientName: "Severino Bispo de Jesus",
    patientAgeYears: 69,
    originUnitCode: "pa_tancredo_neves",
    destination: "Hospital Santa Izabel",
    procedure: "Consulta oftalmológica — pós-operatório",
    deadlineOffsetMin: 150,
    tripType: "round_trip",
    status: "novo",
  },

  // ─── UPA Bairro da Paz / Orlando Imbassahy (3) ───
  {
    patientName: "Antônia Ferreira dos Reis",
    patientAgeYears: 74,
    patientCns: "704003089240528",
    originUnitCode: "upa_bairro_da_paz",
    destination: "Hospital Geral Roberto Santos",
    procedure: "Internamento — AVC isquêmico, janela de trombólise",
    deadlineOffsetMin: 6,
    tripType: "one_way",
    status: "viatura_designada",
    vitals: { pa: "178/96", fc: 88, fr: 18, spo2: 95, glasgow: 13, dextro: 142 },
    diagnoses: ["AVC isquêmico agudo"],
    ambulanceLabel: "USA 03",
    ambulanceKind: "USA",
  },
  {
    patientName: "Wesley Nascimento Pinto",
    patientAgeYears: 23,
    originUnitCode: "upa_bairro_da_paz",
    destination: "Hospital do Subúrbio",
    procedure: "Trauma ortopédico — fratura exposta de tíbia",
    deadlineOffsetMin: 35,
    tripType: "one_way",
    status: "aguardando_viatura",
    vitals: { pa: "120/80", fc: 104, fr: 18, spo2: 98, glasgow: 15 },
    diagnoses: ["Fratura exposta de tíbia"],
  },
  {
    patientName: "Dona Marlene Souza Andrade",
    patientAgeYears: 66,
    originUnitCode: "upa_bairro_da_paz",
    destination: "Hospital Ana Nery",
    procedure: "Hemodiálise — sessão programada",
    deadlineOffsetMin: 90,
    tripType: "round_trip",
    status: "novo",
  },

  // ─── UPA Hélio Machado (2) ───
  {
    patientName: "Raimunda Oliveira da Mata",
    patientAgeYears: 81,
    originUnitCode: "upa_helio_machado",
    destination: "Hospital Geral Roberto Santos",
    procedure: "Ortopedia — fratura de fêmur",
    deadlineOffsetMin: 40,
    tripType: "one_way",
    status: "pendente_revisao",
    vitals: { pa: "150/90", fc: 96, fr: 18, spo2: 96, glasgow: 15 },
    diagnoses: ["Fratura de colo de fêmur"],
    whatsappRawText: HELIO_MACHADO_RAW,
    whatsappOffsetMin: -15,
    parseConfidence: 0.62,
    parseWarnings: ["destino sem unidade clínica explícita", "idade por extenso"],
  },
  {
    patientName: "João Batista Rocha",
    patientAgeYears: 60,
    originUnitCode: "upa_helio_machado",
    destination: "Hospital Especializado Octávio Mangabeira",
    procedure: "Avaliação pneumológica — DPOC agudizada",
    deadlineOffsetMin: 75,
    tripType: "round_trip",
    status: "aguardando_viatura",
    vitals: { pa: "138/84", fc: 102, fr: 26, spo2: 91, glasgow: 15, temp: 37.6 },
    diagnoses: ["DPOC agudizada"],
  },

  // ════════════════════════════════════════════════════════════════
  // DEMAIS UNIDADES
  // ════════════════════════════════════════════════════════════════

  // ─── UPA Pirajá (5 — coluna densa) ───
  {
    patientName: "Maria das Graças Souza",
    patientAgeYears: 67,
    patientCns: "704003089240528",
    originUnitCode: "upa_piraja",
    destination: "Hospital Manoel Victorino",
    procedure: "Internamento — pneumonia + ICC descompensada",
    deadlineOffsetMin: -14,
    tripType: "one_way",
    status: "em_deslocamento_destino",
    vitals: { pa: "150/95", fc: 112, fr: 22, spo2: 93, glasgow: 14, temp: 38.1 },
    diagnoses: ["Pneumonia comunitária", "ICC descompensada"],
    ambulanceLabel: "USB 07",
    ambulanceKind: "USB",
  },
  {
    patientName: "Edmilson Tavares Brito",
    patientAgeYears: 62,
    originUnitCode: "upa_piraja",
    destination: "Hospital Ana Nery",
    procedure: "Hemodiálise — sessão programada",
    deadlineOffsetMin: 95,
    tripType: "round_trip",
    status: "chegou_destino",
    ambulanceLabel: "USB 07",
    ambulanceKind: "USB",
  },
  {
    patientName: "Luciana Ferreira Campos",
    patientAgeYears: 33,
    originUnitCode: "upa_piraja",
    destination: "Maternidade Climério de Oliveira",
    procedure: "Internamento obstétrico — trabalho de parto prematuro",
    deadlineOffsetMin: 50,
    tripType: "one_way",
    status: "novo",
    vitals: { pa: "128/82", fc: 92, fr: 18, spo2: 98, glasgow: 15 },
    diagnoses: ["Trabalho de parto prematuro"],
  },
  {
    patientName: "Antônio Carlos Pereira",
    patientAgeYears: 71,
    originUnitCode: "upa_piraja",
    destination: "Hospital Couto Maia",
    procedure: "Internamento — sepse de foco urinário",
    deadlineOffsetMin: 10,
    tripType: "one_way",
    status: "aguardando_viatura",
    vitals: { pa: "100/60", fc: 124, fr: 26, spo2: 89, glasgow: 13, temp: 39.0 },
    diagnoses: ["Sepse de foco urinário"],
  },
  {
    patientName: "Rita de Cássia Mendes",
    patientAgeYears: 58,
    originUnitCode: "upa_piraja",
    destination: "Hospital Aristides Maltez",
    procedure: "Quimioterapia — ciclo agendado",
    deadlineOffsetMin: 220,
    tripType: "round_trip",
    status: "concluido",
    ambulanceLabel: "USB 08",
    ambulanceKind: "USB",
  },

  // ─── UPA Brotas (2 — com pendente_revisão) ───
  {
    patientName: "Diogo Vasconcelos Lima",
    patientAgeYears: 36,
    originUnitCode: "upa_brotas",
    destination: "Hospital Geral Roberto Santos",
    procedure: "TC crânio — suspeita de hemorragia",
    deadlineOffsetMin: 70,
    tripType: "round_trip",
    status: "pendente_revisao",
    vitals: { pa: "160/100", fc: 105, fr: 20, spo2: 95, glasgow: 14 },
    diagnoses: ["TCE", "HSA — descartar"],
    parseConfidence: 0.55,
    parseWarnings: ["destino ambíguo (alternativa oferecida)", "urgência sem horário"],
  },
  {
    patientName: "Helena Macedo Quintela",
    patientAgeYears: 52,
    originUnitCode: "upa_brotas",
    destination: "Hospital Santa Izabel",
    procedure: "Internamento clínico",
    deadlineOffsetMin: 60,
    tripType: "one_way",
    status: "retornando_origem",
    ambulanceLabel: "USB 02",
    ambulanceKind: "USB",
  },

  // ─── UPA Barris (2) ───
  {
    patientName: "Fernando Sá Menezes",
    patientAgeYears: 47,
    originUnitCode: "upa_barris",
    destination: "Hospital Português",
    procedure: "Avaliação vascular — isquemia de membro",
    deadlineOffsetMin: 30,
    tripType: "round_trip",
    status: "viatura_designada",
    vitals: { pa: "144/88", fc: 96, fr: 18, spo2: 97, glasgow: 15 },
    diagnoses: ["Isquemia arterial aguda"],
    ambulanceLabel: "USB 06",
    ambulanceKind: "USB",
  },
  {
    patientName: "Isabela Nunes Carvalho",
    patientAgeYears: 5,
    originUnitCode: "upa_barris",
    destination: "Hospital Martagão Gesteira",
    procedure: "Internamento pediátrico — broncoespasmo grave",
    deadlineOffsetMin: 12,
    tripType: "one_way",
    status: "paciente_embarcado",
    vitals: { pa: "95/60", fc: 148, fr: 36, spo2: 88, glasgow: 15, temp: 38.2 },
    diagnoses: ["Crise asmática grave", "Insuficiência respiratória"],
    ambulanceLabel: "USA 04",
    ambulanceKind: "USA",
  },

  // ─── HMUM — Hospital Municipal (2 — transferências) ───
  {
    patientName: "Anderson Cruz Bandeira",
    patientAgeYears: 44,
    originUnitCode: "hmum",
    destination: "Hospital Geral do Estado — UTI",
    procedure: "Transferência UTI — politrauma",
    deadlineOffsetMin: 8,
    tripType: "one_way",
    status: "em_deslocamento_origem",
    vitals: { pa: "85/50", fc: 132, fr: 26, spo2: 90, glasgow: 9, temp: 37.9 },
    diagnoses: ["Politrauma", "TCE grave"],
    ambulanceLabel: "USA 01",
    ambulanceKind: "USA",
  },
  {
    patientName: "Terezinha de Jesus Alves",
    patientAgeYears: 88,
    originUnitCode: "hmum",
    destination: "Hospital da Cidade",
    procedure: "Internamento — desidratação e ITU",
    deadlineOffsetMin: 130,
    tripType: "one_way",
    status: "novo",
    vitals: { pa: "110/70", fc: 90, fr: 18, spo2: 95, glasgow: 14, temp: 37.4 },
  },

  // ─── PA Pernambués (2) ───
  {
    patientName: "Roberto Nogueira Filho",
    patientAgeYears: 66,
    originUnitCode: "pa_pernambues",
    destination: "Hospital Couto Maia",
    procedure: "Avaliação infectológica",
    deadlineOffsetMin: 20,
    tripType: "round_trip",
    status: "novo",
  },
  {
    patientName: "Patrícia Gomes Teixeira",
    patientAgeYears: 39,
    originUnitCode: "pa_pernambues",
    destination: "Hospital Juliano Moreira",
    procedure: "Avaliação psiquiátrica — surto agudo",
    deadlineOffsetMin: 45,
    tripType: "one_way",
    status: "aguardando_viatura",
    diagnoses: ["Surto psicótico"],
  },

  // ─── UPA Valéria (1 — atrasado urgente) ───
  {
    patientName: "Jailson Pereira dos Anjos",
    patientAgeYears: 28,
    originUnitCode: "upa_valeria",
    destination: "Hospital Geral do Estado — HGE",
    procedure: "Neurocirurgia — TCE por acidente de moto",
    deadlineOffsetMin: -28,
    tripType: "one_way",
    status: "paciente_embarcado",
    vitals: { pa: "90/55", fc: 130, fr: 28, spo2: 91, glasgow: 8 },
    diagnoses: ["TCE grave", "Choque hemorrágico"],
    ambulanceLabel: "USA 02",
    ambulanceKind: "USA",
  },

  // ─── UPA Santo Antônio (1) ───
  {
    patientName: "Carla Tavares Ribeiro",
    patientAgeYears: 41,
    originUnitCode: "upa_santo_antonio",
    destination: "Hospital São Rafael",
    procedure: "Cateterismo cardíaco — eletivo",
    deadlineOffsetMin: 120,
    tripType: "round_trip",
    status: "viatura_designada",
    vitals: { pa: "130/85", fc: 84, fr: 16, spo2: 98, glasgow: 15 },
    ambulanceLabel: "USB 03",
    ambulanceKind: "USB",
  },

  // ─── UPA Paripe (1 — Subúrbio) ───
  {
    patientName: "Joana Ribeiro da Paixão",
    patientAgeYears: 84,
    originUnitCode: "upa_paripe",
    destination: "Hospital do Subúrbio",
    procedure: "Internamento — insuficiência cardíaca",
    deadlineOffsetMin: 38,
    tripType: "one_way",
    status: "em_deslocamento_destino",
    vitals: { pa: "100/65", fc: 110, fr: 24, spo2: 92, glasgow: 15 },
    diagnoses: ["ICC descompensada"],
    ambulanceLabel: "USB 05",
    ambulanceKind: "USB",
  },

  // ─── PA São Marcos (1 — cancelado) ───
  {
    patientName: "Reinaldo Borges Sampaio",
    patientAgeYears: 55,
    originUnitCode: "pa_sao_marcos",
    destination: "Hospital Geral Cleriston Andrade (Feira de Santana)",
    procedure: "Avaliação cardiológica",
    deadlineOffsetMin: 60,
    tripType: "round_trip",
    status: "cancelado",
  },

  // ─── PA Alfredo Bureau (1) ───
  {
    patientName: "Vanessa Almeida Cerqueira",
    patientAgeYears: 45,
    originUnitCode: "pa_alfredo_bureau",
    destination: "Hospital Português",
    procedure: "Endoscopia digestiva alta — HDA",
    deadlineOffsetMin: 25,
    tripType: "round_trip",
    status: "aguardando_viatura",
    vitals: { pa: "108/68", fc: 108, fr: 18, spo2: 97, glasgow: 15 },
    diagnoses: ["Hemorragia digestiva alta"],
  },

  // ─── PA Maria da Conceição (1 — concluído com fade) ───
  {
    patientName: "Cleberson Matos Figueiredo",
    patientAgeYears: 41,
    originUnitCode: "pa_maria_conceicao",
    destination: "Hospital Couto Maia",
    procedure: "Internamento — meningite",
    deadlineOffsetMin: -200,
    tripType: "one_way",
    status: "concluido",
    ambulanceLabel: "USA 03",
    ambulanceKind: "USA",
  },

  // ─── UPA Parque São Cristóvão (1) ───
  {
    patientName: "Mateus Rocha Andrade",
    patientAgeYears: 19,
    originUnitCode: "upa_parque_sao_cristovao",
    destination: "Hospital Geral do Estado — HGE",
    procedure: "Ortopedia — fratura de antebraço",
    deadlineOffsetMin: 85,
    tripType: "one_way",
    status: "novo",
    vitals: { pa: "120/75", fc: 88, fr: 16, spo2: 99, glasgow: 15 },
  },

  // ─── UPA San Martin — deixada VAZIA de propósito (vai pro rodapé
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

  // RESET dev: limpa transportes/eventos/mensagens e units órfãs (códigos
  // que não estão mais em @samu-cru/shared, ex. seeds antigos).
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
    // createdAt escalonado pra trás (variação de timeline).
    const createdAt = new Date(now.getTime() - (idx * 7 + 30) * 60_000);
    const assignedAt = m.ambulanceLabel
      ? new Date(createdAt.getTime() + 8 * 60_000)
      : undefined;
    return {
      whatsappMessageId: waIdByPatient.get(m.patientName),
      patientName: m.patientName,
      patientAgeText: `${m.patientAgeYears}a`,
      patientCns: m.patientCns,
      patientCpf: m.patientCpf,
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
