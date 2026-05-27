import { z } from "zod";

/**
 * Schema do form de solicitação web. Espelha transport_requests do DB
 * filtrando campos internos (status, parseConfidence, parseWarnings).
 * Origem e source são preenchidos no servidor a partir da sessão.
 */
export const SolicitarSchema = z.object({
  patientName: z.string().trim().min(2).max(200),
  patientBirthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  patientAgeText: z.string().trim().max(32).optional().or(z.literal("").transform(() => undefined)),
  patientCns: z.string().trim().max(32).optional().or(z.literal("").transform(() => undefined)),
  patientCpf: z.string().trim().max(14).optional().or(z.literal("").transform(() => undefined)),

  destinationName: z.string().trim().min(2).max(200),
  procedure: z.string().trim().min(2).max(2000),
  procedureDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  procedureTime: z.string().trim().max(200).optional().or(z.literal("").transform(() => undefined)),
  deadlineAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.literal("").transform(() => undefined)),
  tripType: z.enum(["one_way", "round_trip", "unknown"]).default("one_way"),

  vitals: z
    .object({
      pa: z.string().trim().max(20).optional(),
      fc: z.coerce.number().int().min(0).max(300).optional(),
      fr: z.coerce.number().int().min(0).max(80).optional(),
      spo2: z.coerce.number().int().min(0).max(100).optional(),
      temp: z.coerce.number().min(25).max(45).optional(),
      glasgow: z.coerce.number().int().min(3).max(15).optional(),
      dextro: z.coerce.number().int().min(0).max(1000).optional(),
    })
    .optional(),
  diagnosesText: z.string().trim().max(2000).optional().or(z.literal("").transform(() => undefined)),
  notes: z.string().trim().max(2000).optional().or(z.literal("").transform(() => undefined)),
});

export type SolicitarInput = z.infer<typeof SolicitarSchema>;
