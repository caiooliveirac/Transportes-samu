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
} from "drizzle-orm/pg-core";
import {
  TRANSPORT_STATUS,
  TRIP_TYPE,
  UNIT_TYPE,
  type TransportStatus,
  type TripType,
  type UnitType,
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
    patientName: varchar("patient_name", { length: 200 }).notNull(),
    patientBirthDate: date("patient_birth_date"),
    patientAgeText: varchar("patient_age_text", { length: 32 }),
    patientCns: varchar("patient_cns", { length: 32 }),
    patientCpf: varchar("patient_cpf", { length: 14 }),

    // Rota
    originUnitId: integer("origin_unit_id").references(() => units.id),
    originUnitRaw: varchar("origin_unit_raw", { length: 200 }).notNull(),
    destinationName: varchar("destination_name", { length: 200 }).notNull(),

    // Procedimento e timing
    procedure: text("procedure").notNull(),
    procedureDate: date("procedure_date"),
    procedureTime: varchar("procedure_time", { length: 32 }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    tripType: tripTypeEnum("trip_type").notNull().default("unknown"),

    // Clínica
    vitals: jsonb("vitals").$type<Vitals>(),
    diagnoses: text("diagnoses").array(),

    // Operacional
    status: transportStatusEnum("status").notNull().default("novo"),
    parseConfidence: real("parse_confidence").notNull().default(1.0),
    parseWarnings: text("parse_warnings").array(),
    notes: text("notes"),

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

/* ─── Inferred types ─────────────────────────────────────────────────── */
export type Unit = typeof units.$inferSelect;
export type NewUnit = typeof units.$inferInsert;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type NewWhatsappMessage = typeof whatsappMessages.$inferInsert;
export type TransportRequest = typeof transportRequests.$inferSelect;
export type NewTransportRequest = typeof transportRequests.$inferInsert;
export type TransportEvent = typeof transportEvents.$inferSelect;
export type NewTransportEvent = typeof transportEvents.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
