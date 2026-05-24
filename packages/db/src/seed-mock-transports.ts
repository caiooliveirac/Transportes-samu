import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import type { TransportStatus, TripType, Vitals } from "@samu-cru/shared";
import { loadMonorepoEnv } from "./load-env";
import {
  units,
  whatsappMessages,
  transportRequests,
  type NewTransportRequest,
} from "./schema";

loadMonorepoEnv();

/**
 * Dev-only seed: 22 transportes plausíveis cobrindo todos os 11 status,
 * 10 unidades de origem (deliberadamente deixando upa_san_martin vazia
 * como o design mostra), e mix de urgência (atrasado, próximo, distante).
 *
 * Idempotente: se transport_requests já tem linhas, não faz nada.
 * Use TRUNCATE manual antes se quiser regerar.
 */

interface MockTransport {
  patientName: string;
  patientAgeYears: number;
  patientCns?: string;
  originUnitCode: string;
  destination: string;
  procedure: string;
  /** Offset em minutos relativo ao "now" da execução do seed. */
  deadlineOffsetMin: number | null;
  tripType: TripType;
  status: TransportStatus;
  vitals?: Vitals;
  diagnoses?: string[];
  /** Se preenchido, insere whatsapp_messages e linka. */
  whatsappRawText?: string;
  whatsappOffsetMin?: number;
  parseConfidence?: number;
  parseWarnings?: string[];
}

const PIRAJA_RAW = `*SOLICITAÇÃO DE TRANSPORTE*
UPA PIRAJÁ

Paciente: Maria das Graças Souza, 67a
CNS: 704003089240528

Destino: H. Manoel Victorino
Motivo: Internamento — pneumonia + ICC desc.

CHEGAR ATÉ 14:30

PA 150x95 · FC 112 · FR 22 · SatO2 93% AA · GCS 14 · Tax 38,1

Enf. plantão`;

const BROTAS_RAW = `Bom dia drs
UPA BROTAS

pcte Diogo Vasconcelos 36a
precisa tc cranio com urgencia, parece q ta com hemorragia
destino: roberto santos? ou hge?

hoje a tarde, qto antes

*PA 160x100 FC 105 FR 20 sat 95% gcs 14*`;

const MOCKS: ReadonlyArray<MockTransport> = [
  // ─── UPA Pirajá (7 — coluna densa) ───
  {
    patientName: "Maria das Graças Souza",
    patientAgeYears: 67,
    patientCns: "704003089240528",
    originUnitCode: "upa_piraja",
    destination: "Hospital Manoel Victorino",
    procedure: "Internamento — pneumonia + ICC descompensada",
    deadlineOffsetMin: -12,
    tripType: "one_way",
    status: "em_deslocamento_destino",
    vitals: { pa: "150/95", fc: 112, fr: 22, spo2: 93, glasgow: 14, temp: 38.1 },
    diagnoses: ["Pneumonia comunitária", "ICC descompensada"],
    whatsappRawText: PIRAJA_RAW,
    whatsappOffsetMin: -95,
  },
  {
    patientName: "José Roberto Alves",
    patientAgeYears: 54,
    originUnitCode: "upa_piraja",
    destination: "HGCA — Hosp. Geral Cleriston Andrade",
    procedure: "Avaliação cardiológica",
    deadlineOffsetMin: 22,
    tripType: "round_trip",
    status: "viatura_designada",
    vitals: { pa: "138/88", fc: 96, fr: 18, spo2: 96, glasgow: 15, temp: 36.7 },
    diagnoses: ["Síndrome coronariana aguda — descartar"],
  },
  {
    patientName: "Antônio Carlos Pereira",
    patientAgeYears: 71,
    originUnitCode: "upa_piraja",
    destination: "Hospital Roberto Santos",
    procedure: "Internamento",
    deadlineOffsetMin: 8,
    tripType: "one_way",
    status: "aguardando_viatura",
    vitals: { pa: "100/60", fc: 124, fr: 26, spo2: 89, glasgow: 13, temp: 39.0 },
    diagnoses: ["Sepse de foco pulmonar"],
  },
  {
    patientName: "Luciana Ferreira",
    patientAgeYears: 33,
    originUnitCode: "upa_piraja",
    destination: "Maternidade Tsylla Balbino",
    procedure: "Internamento obstétrico",
    deadlineOffsetMin: 45,
    tripType: "one_way",
    status: "novo",
    vitals: { pa: "128/82", fc: 92, fr: 18, spo2: 98, glasgow: 15, temp: 36.5 },
    diagnoses: ["DHEG", "Trabalho de parto prematuro"],
  },
  {
    patientName: "Edmilson Tavares",
    patientAgeYears: 62,
    originUnitCode: "upa_piraja",
    destination: "Hospital Ana Nery",
    procedure: "Hemodiálise",
    deadlineOffsetMin: 95,
    tripType: "round_trip",
    status: "chegou_destino",
  },
  {
    patientName: "Rita de Cássia Mendes",
    patientAgeYears: 58,
    originUnitCode: "upa_piraja",
    destination: "Hospital Sta. Izabel",
    procedure: "Consulta neurológica",
    deadlineOffsetMin: 180,
    tripType: "round_trip",
    status: "concluido",
  },
  {
    patientName: "Cleberson Matos",
    patientAgeYears: 41,
    originUnitCode: "upa_piraja",
    destination: "Hospital Couto Maia",
    procedure: "Internamento",
    deadlineOffsetMin: -180,
    tripType: "one_way",
    status: "concluido",
  },

  // ─── UPA Barreiras (1 — coluna esparsa) ───
  {
    patientName: "Francisca de Oliveira",
    patientAgeYears: 79,
    originUnitCode: "upa_barreiras",
    destination: "Hospital Manoel Victorino",
    procedure: "Internamento",
    deadlineOffsetMin: 60,
    tripType: "one_way",
    status: "em_deslocamento_origem",
  },

  // ─── UPA San Martin — vazia (intencional, design espelha) ───

  // ─── UPA Cajazeiras (3 — com TCE atrasado em destaque) ───
  {
    patientName: "Paulo Henrique Costa",
    patientAgeYears: 28,
    originUnitCode: "upa_cajazeiras",
    destination: "Hospital Geral do Estado",
    procedure: "Trauma — neurocirurgia",
    deadlineOffsetMin: -25,
    tripType: "one_way",
    status: "paciente_embarcado",
    vitals: { pa: "90/55", fc: 130, fr: 28, spo2: 91, glasgow: 9, temp: 36.2 },
    diagnoses: ["TCE grave", "Choque hemorrágico"],
  },
  {
    patientName: "Vanessa Almeida",
    patientAgeYears: 45,
    originUnitCode: "upa_cajazeiras",
    destination: "Hospital Português",
    procedure: "Consulta endocrinológica",
    deadlineOffsetMin: 140,
    tripType: "round_trip",
    status: "aguardando_viatura",
  },
  {
    patientName: "Roberto Nogueira",
    patientAgeYears: 66,
    originUnitCode: "upa_cajazeiras",
    destination: "Hospital Couto Maia",
    procedure: "Avaliação infectológica",
    deadlineOffsetMin: 15,
    tripType: "round_trip",
    status: "novo",
  },

  // ─── UPA Brotas (2 — com pendente_revisao) ───
  {
    patientName: "Diogo Vasconcelos",
    patientAgeYears: 36,
    originUnitCode: "upa_brotas",
    destination: "Hospital Roberto Santos",
    procedure: "TC crânio — possível hemorragia",
    deadlineOffsetMin: 75,
    tripType: "round_trip",
    status: "pendente_revisao",
    vitals: { pa: "160/100", fc: 105, fr: 20, spo2: 95, glasgow: 14 },
    parseConfidence: 0.55,
    parseWarnings: [
      "destination ambiguous (alternative offered)",
      "urgency without explicit time",
    ],
    whatsappRawText: BROTAS_RAW,
    whatsappOffsetMin: -20,
  },
  {
    patientName: "Helena Macedo",
    patientAgeYears: 52,
    originUnitCode: "upa_brotas",
    destination: "Hospital Manoel Victorino",
    procedure: "Internamento",
    deadlineOffsetMin: 50,
    tripType: "one_way",
    status: "retornando_origem",
  },

  // ─── UPA Liberdade (3) ───
  {
    patientName: "Severino Bispo",
    patientAgeYears: 73,
    originUnitCode: "upa_liberdade",
    destination: "Hospital Ana Nery",
    procedure: "Internamento",
    deadlineOffsetMin: 20,
    tripType: "one_way",
    status: "em_deslocamento_destino",
  },
  {
    patientName: "Carla Tavares",
    patientAgeYears: 39,
    originUnitCode: "upa_liberdade",
    destination: "Hospital Sta. Izabel",
    procedure: "Consulta ginecológica",
    deadlineOffsetMin: 120,
    tripType: "round_trip",
    status: "viatura_designada",
    vitals: { pa: "128/82", fc: 92, fr: 18, spo2: 98, glasgow: 15, temp: 36.5 },
  },
  {
    patientName: "Mateus Rocha",
    patientAgeYears: 19,
    originUnitCode: "upa_liberdade",
    destination: "HGE Salvador",
    procedure: "Trauma ortopédico",
    deadlineOffsetMin: -3,
    tripType: "one_way",
    status: "em_deslocamento_destino",
    vitals: { pa: "110/70", fc: 118, fr: 22, spo2: 95, glasgow: 15, temp: 36.5 },
  },

  // ─── PA Paripe (2) ───
  {
    patientName: "Joana Ribeiro",
    patientAgeYears: 84,
    originUnitCode: "pa_paripe",
    destination: "Hospital Roberto Santos",
    procedure: "Internamento",
    deadlineOffsetMin: 35,
    tripType: "one_way",
    status: "novo",
  },
  {
    patientName: "Fernando Sá",
    patientAgeYears: 47,
    originUnitCode: "pa_paripe",
    destination: "Hospital Português",
    procedure: "Avaliação vascular",
    deadlineOffsetMin: 160,
    tripType: "round_trip",
    status: "aguardando_viatura",
  },

  // ─── PA Periperi (2 — um cancelado) ───
  {
    patientName: "Sandra Quirino",
    patientAgeYears: 61,
    originUnitCode: "pa_periperi",
    destination: "Hospital Manoel Victorino",
    procedure: "Internamento",
    deadlineOffsetMin: 28,
    tripType: "one_way",
    status: "aguardando_viatura",
  },
  {
    patientName: "Reinaldo Borges",
    patientAgeYears: 55,
    originUnitCode: "pa_periperi",
    destination: "HGCA — Hosp. Geral Cleriston Andrade",
    procedure: "Avaliação cardiológica",
    deadlineOffsetMin: 40,
    tripType: "round_trip",
    status: "cancelado",
  },

  // ─── PA Mussurunga (1 — pediátrico) ───
  {
    patientName: "Beatriz Lopes",
    patientAgeYears: 8,
    originUnitCode: "pa_mussurunga",
    destination: "Hospital Couto Maia",
    procedure: "Internamento pediátrico",
    deadlineOffsetMin: 55,
    tripType: "one_way",
    status: "viatura_designada",
    vitals: { pa: "95/60", fc: 138, fr: 30, spo2: 94, glasgow: 15, temp: 38.4 },
  },

  // ─── HMUM (1 — transferência UTI atrasada) ───
  {
    patientName: "Anderson Cruz",
    patientAgeYears: 44,
    originUnitCode: "hmum",
    destination: "Hospital Ana Nery",
    procedure: "Transferência UTI",
    deadlineOffsetMin: 10,
    tripType: "one_way",
    status: "em_deslocamento_origem",
    vitals: { pa: "85/50", fc: 132, fr: 26, spo2: 92, glasgow: 11, temp: 37.9 },
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  const existing = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(transportRequests);
  const existingCount = existing[0]?.n ?? 0;
  if (existingCount > 0) {
    console.log(
      `[seed-mock] transport_requests already has ${existingCount} rows, skipping. TRUNCATE first to regenerate.`,
    );
    await client.end();
    return;
  }

  const unitRows = await db.select().from(units);
  const unitMap = new Map(unitRows.map((u) => [u.code, u.id]));
  if (unitMap.size === 0) {
    throw new Error(
      "units table is empty — run `pnpm db:seed` first to seed the 17 units.",
    );
  }

  const now = new Date();

  // Cria as whatsapp_messages necessárias e mapeia nome → id
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

  // Insere os transports
  const rows: NewTransportRequest[] = MOCKS.map((m, idx) => {
    const deadlineAt =
      m.deadlineOffsetMin === null
        ? null
        : new Date(now.getTime() + m.deadlineOffsetMin * 60_000);
    // CreatedAt: escalonado pra trás (último mais recente) para variação na timeline
    const createdAt = new Date(now.getTime() - (idx * 7 + 30) * 60_000);
    return {
      whatsappMessageId: waIdByPatient.get(m.patientName),
      patientName: m.patientName,
      patientAgeText: `${m.patientAgeYears}a`,
      patientCns: m.patientCns,
      originUnitId: unitMap.get(m.originUnitCode),
      originUnitRaw: m.originUnitCode,
      destinationName: m.destination,
      procedure: m.procedure,
      deadlineAt,
      tripType: m.tripType,
      vitals: m.vitals,
      diagnoses: m.diagnoses,
      status: m.status,
      parseConfidence: m.parseConfidence ?? 1.0,
      parseWarnings: m.parseWarnings,
      createdAt,
      updatedAt: createdAt,
    };
  });

  await db.insert(transportRequests).values(rows);

  console.log(
    `[seed-mock] inserted ${rows.length} transport_requests and ${waCount} whatsapp_messages`,
  );

  await client.end();
}

main().catch((err) => {
  console.error("[seed-mock] failed:", err);
  process.exit(1);
});
