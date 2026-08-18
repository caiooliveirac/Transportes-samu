import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  uuid,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  TRANSPORT_STATUS,
  TRIP_TYPE,
  UNIT_TYPE,
  SEVERITY,
  AMBULANCE_KIND,
  DELAY_REASON,
  type TransportStatus,
  type TripType,
  type UnitType,
  type Severity,
  type AmbulanceKind,
  type DelayReason,
  type Vitals,
} from "@samu-cru/shared";

/**
 * Enums Postgres derivados das tuplas literais em @samu-cru/shared.
 * Mantém a taxonomia com fonte única — qualquer mudança no shared
 * exige nova migration aqui, garantindo sincronia DB ↔ tipos.
 */
export const transportStatusEnum = pgEnum(
  "transport_status",
  TRANSPORT_STATUS as unknown as [TransportStatus, ...TransportStatus[]],
);

export const tripTypeEnum = pgEnum(
  "trip_type",
  TRIP_TYPE as unknown as [TripType, ...TripType[]],
);

export const unitTypeEnum = pgEnum(
  "unit_type",
  UNIT_TYPE as unknown as [UnitType, ...UnitType[]],
);

export const severityEnum = pgEnum(
  "severity",
  SEVERITY as unknown as [Severity, ...Severity[]],
);

export const ambulanceKindEnum = pgEnum(
  "ambulance_kind",
  AMBULANCE_KIND as unknown as [AmbulanceKind, ...AmbulanceKind[]],
);

export const delayReasonEnum = pgEnum(
  "delay_reason",
  DELAY_REASON as unknown as [DelayReason, ...DelayReason[]],
);

/* ─── units ───────────────────────────────────────────────────────────────
 * 17 unidades de origem (UPAs, PAs, hospital municipal). Seed em seed.ts.
 * `aliases` alimenta o matcher fuzzy do parser (PLANNING §7).
 * ──────────────────────────────────────────────────────────────────────── */
export const units = pgTable("units", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  type: unitTypeEnum("type").notNull(),
  isOrigin: boolean("is_origin").notNull().default(true),
  /** Unidade sem ambulância própria — entra na faixa "Prioridade da rede". */
  noOwnAmbulance: boolean("no_own_ambulance").notNull().default(false),
  aliases: text("aliases").array(),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ─── whatsapp_messages ──────────────────────────────────────────────────
 * Mensagem original como entidade própria — uma mensagem pode gerar mais
 * de um transporte (gêmeos, família) e edições no WhatsApp re-disparam o
 * parser preservando o histórico. waMessageId é único (dedupe primário).
 * ──────────────────────────────────────────────────────────────────────── */
export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id: serial("id").primaryKey(),
    waMessageId: varchar("wa_message_id", { length: 128 }).notNull().unique(),
    waChatId: varchar("wa_chat_id", { length: 128 }).notNull(),
    waSenderId: varchar("wa_sender_id", { length: 128 }),
    rawText: text("raw_text").notNull(),
    rawJson: jsonb("raw_json"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    receivedAtIdx: index("whatsapp_messages_received_at_idx").on(t.receivedAt),
  }),
);

/* ─── users ──────────────────────────────────────────────────────────────
 * MVP tem 1 papel (regulador). `role` preparado para Fase 5 (PLANNING §13).
 * Sem self-register: usuários criados via CLI script.
 * ──────────────────────────────────────────────────────────────────────── */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 32 }).notNull().default("regulador"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ─── transport_requests ─────────────────────────────────────────────────
 * Entidade central. UUID por padrão para evitar IDs sequenciais visíveis em
 * URL (Phase 2 vai ter /transporte/[id]). Paciente desnormalizado (não há
 * cadastro reaproveitável). `originUnitId` resolvido pelo parser quando
 * confidence ≥ 0.8; `originUnitRaw` sempre preenchido para auditoria.
 * Sinais vitais e diagnósticos em jsonb/array — sem queries analíticas no
 * MVP. Índices em status, origem e deadline para o painel multi-coluna.
 * ──────────────────────────────────────────────────────────────────────── */
export const transportRequests = pgTable(
  "transport_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    whatsappMessageId: integer("whatsapp_message_id").references(
      () => whatsappMessages.id,
    ),

    // Paciente
    /** Ver nota de largura em `origin_unit_raw`. */
    patientName: text("patient_name").notNull(),
    patientBirthDate: date("patient_birth_date"),
    patientAgeText: varchar("patient_age_text", { length: 32 }),
    patientCns: varchar("patient_cns", { length: 32 }),
    patientCpf: varchar("patient_cpf", { length: 14 }),

    // Rota
    originUnitId: integer("origin_unit_id").references(() => units.id),
    /**
     * Chave da coluna do painel quando o parser reconhece a unidade (guarda
     * o `units.code`), e `MISSING_ORIGIN` quando não reconhece.
     *
     * Era varchar(200). No caminho de falha o valor vinha de uma linha
     * arbitrária da mensagem, sem teto de tamanho — mesma armadilha que já
     * estourou o INSERT em `procedure_time` (ver nota abaixo). E como a
     * mensagem é gravada ANTES de o parser rodar, o estouro acontecia com a
     * linha de `whatsapp_messages` já no banco: o gateway reenviava, o
     * reenvio caía em "já conheço esta mensagem" e o transporte nunca era
     * criado. Promovido para text.
     */
    originUnitRaw: text("origin_unit_raw").notNull(),
    /** Ver nota de largura em `origin_unit_raw`. */
    destinationName: text("destination_name").notNull(),

    // Origem da solicitação
    /** 'whatsapp' (legado), 'web_form' (solicitante UPA), 'manual' (regulador) */
    source: varchar("source", { length: 16 }).notNull().default("whatsapp"),
    /** Unidade que criou via web form. Null em transportes legados WhatsApp. */
    createdByUnitId: integer("created_by_unit_id").references(() => units.id),

    // Procedimento e timing
    procedure: text("procedure").notNull(),
    procedureDate: date("procedure_date"),
    /** Texto bruto do horário/janela. Pode ser longo (ex: "DATA/HORÁRIO
     * DA APRESENTAÇÃO: IMEDIATA ATÉ 22H"). Era varchar(32) e dava
     * overflow no INSERT — promovido para text. */
    procedureTime: text("procedure_time"),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    tripType: tripTypeEnum("trip_type").notNull().default("unknown"),

    // Clínica
    vitals: jsonb("vitals").$type<Vitals>(),
    diagnoses: text("diagnoses").array(),

    // Operacional
    status: transportStatusEnum("status").notNull().default("novo"),
    /** Override de gravidade pelo regulador. null = usar deriveSeverity(). */
    severityOverride: severityEnum("severity_override"),
    /** Ordem manual dentro da coluna da unidade. null = ordenar por urgência. */
    manualRank: integer("manual_rank"),
    /** Prefixo da viatura vinculada pelo regulador (ex.: "USA 02"). */
    ambulanceLabel: varchar("ambulance_label", { length: 32 }),
    /** Tipo da viatura vinculada (USB | USA). */
    ambulanceKind: ambulanceKindEnum("ambulance_kind"),
    /** Quando a viatura foi vinculada — base da contagem de resposta. */
    ambulanceAssignedAt: timestamp("ambulance_assigned_at", {
      withTimezone: true,
    }),
    /**
     * Ida-e-volta: quando a viatura chegou ao destino e ficou esperando o
     * paciente. É o relógio da ambulância presa — cateterismo, endoscopia
     * e avaliação podem segurar uma viatura por horas, e sem esse marco o
     * regulador só descobre pelo rádio.
     */
    waitStartedAt: timestamp("wait_started_at", { withTimezone: true }),
    /**
     * A viatura foi liberada antes do paciente. Alguém vai ter que
     * despachar uma segunda equipe para buscar quando ele liberar — é o
     * caso que some da fila se ninguém marcar.
     */
    pickupNeeded: boolean("pickup_needed").notNull().default(false),
    /**
     * Campos cujo valor foi escrito por um regulador, não pelo parser. O
     * re-parse (`ingest:backfill --reparse`) pula estes — sem isso ele
     * sobrescreve em massa toda correção manual, e é rodado justamente
     * quando há mais correção acumulada. Ver `@samu-cru/shared/corrections`.
     */
    correctedFields: text("corrected_fields").array(),
    parseConfidence: real("parse_confidence").notNull().default(1.0),
    parseWarnings: text("parse_warnings").array(),
    notes: text("notes"),
    /** Relato livre do regulador sobre a demora, coletado no encerramento. */
    delayReport: text("delay_report"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    statusIdx: index("transport_requests_status_idx").on(t.status),
    originIdx: index("transport_requests_origin_idx").on(t.originUnitId),
    deadlineIdx: index("transport_requests_deadline_idx").on(t.deadlineAt),
    createdAtIdx: index("transport_requests_created_at_idx").on(t.createdAt),
    manualRankIdx: index("transport_requests_manual_rank_idx").on(
      t.originUnitRaw,
      t.manualRank,
    ),
  }),
);

/* ─── transport_events ───────────────────────────────────────────────────
 * Log de auditoria + fonte da timeline no modal. CASCADE em transportId
 * para limpar histórico quando um transporte é hard-deleted (raro — soft
 * delete vem em Phase 5 via LGPD).
 * `kind` é text livre por convenção: 'status_change', 'field_edit',
 * 'parse_revised', 'pii_revealed', 'duplicate_suspected', 'created'…
 * ──────────────────────────────────────────────────────────────────────── */
export const transportEvents = pgTable(
  "transport_events",
  {
    id: serial("id").primaryKey(),
    transportId: uuid("transport_id")
      .references(() => transportRequests.id, { onDelete: "cascade" })
      .notNull(),
    kind: varchar("kind", { length: 64 }).notNull(),
    fromValue: jsonb("from_value"),
    toValue: jsonb("to_value"),
    userId: integer("user_id").references(() => users.id),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    transportIdx: index("transport_events_transport_idx").on(t.transportId),
    kindIdx: index("transport_events_kind_idx").on(t.kind),
  }),
);

/* ─── transport_delays ───────────────────────────────────────────────────
 * Intercorrências / motivos de demora — 1 linha por (transporte, motivo).
 * Taxonomia vem de DELAY_REASON no shared (fonte única). O regulador marca
 * chips durante o caso (registro em tempo real) e confirma/ajusta no
 * encerramento; impactMinutes e o relato livre são facultativos.
 * Índice único garante o comportamento de toggle sem duplicatas.
 * ──────────────────────────────────────────────────────────────────────── */
export const transportDelays = pgTable(
  "transport_delays",
  {
    id: serial("id").primaryKey(),
    transportId: uuid("transport_id")
      .references(() => transportRequests.id, { onDelete: "cascade" })
      .notNull(),
    reason: delayReasonEnum("reason").notNull(),
    /** Estimativa do regulador de quantos minutos o motivo custou. */
    impactMinutes: integer("impact_minutes"),
    userId: integer("user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    transportReasonUq: uniqueIndex("transport_delays_transport_reason_uq").on(
      t.transportId,
      t.reason,
    ),
    reasonIdx: index("transport_delays_reason_idx").on(t.reason),
  }),
);

/* ─── worker_heartbeat ───────────────────────────────────────────────────
 * UPSERT a cada 30s pelo worker Baileys (apps/ingest). O dashboard lê o
 * registro mais recente para mostrar o indicador 🟢/🔴 de ingestão
 * (PLANNING §12). worker_id permite ter mais de uma instância no futuro;
 * para o MVP usamos "local-dev" ou WORKER_ID via env.
 * ──────────────────────────────────────────────────────────────────────── */
export const workerHeartbeat = pgTable("worker_heartbeat", {
  id: serial("id").primaryKey(),
  workerId: varchar("worker_id", { length: 64 }).notNull().unique(),
  /** "connecting" | "open" | "closed" | "logged_out" */
  status: varchar("status", { length: 32 }).notNull(),
  lastSeen: timestamp("last_seen", { withTimezone: true })
    .notNull()
    .defaultNow(),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ─── unit_credentials ───────────────────────────────────────────────────
 * Credenciais por unidade pra o form de solicitação web. 1:1 com units
 * — cada UPA/PA tem um login único. Senha em hash scrypt (Node runtime).
 * Admin pode rotacionar via /admin/unidades.
 * ──────────────────────────────────────────────────────────────────────── */
export const unitCredentials = pgTable("unit_credentials", {
  unitId: integer("unit_id")
    .primaryKey()
    .references(() => units.id, { onDelete: "cascade" }),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ─── Inferred types ─────────────────────────────────────────────────── */
export type Unit = typeof units.$inferSelect;
export type NewUnit = typeof units.$inferInsert;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type NewWhatsappMessage = typeof whatsappMessages.$inferInsert;
export type TransportRequest = typeof transportRequests.$inferSelect;
export type NewTransportRequest = typeof transportRequests.$inferInsert;
export type TransportEvent = typeof transportEvents.$inferSelect;
export type NewTransportEvent = typeof transportEvents.$inferInsert;
export type TransportDelay = typeof transportDelays.$inferSelect;
export type NewTransportDelay = typeof transportDelays.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type WorkerHeartbeat = typeof workerHeartbeat.$inferSelect;
export type NewWorkerHeartbeat = typeof workerHeartbeat.$inferInsert;
export type UnitCredential = typeof unitCredentials.$inferSelect;
export type NewUnitCredential = typeof unitCredentials.$inferInsert;
