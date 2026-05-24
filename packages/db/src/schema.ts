// Drizzle schema — empty in Phase 0.
//
// Tables land in Phase 1 per PLANNING §6:
//   units, whatsapp_messages, transport_requests, transport_events, users
//
// Drizzle enums (transport_status, trip_type, unit_type) will be derived from
// the literal tuples in @samu-cru/shared/enums to keep the taxonomy in one
// place. Pattern:
//
//   import { TRANSPORT_STATUS } from "@samu-cru/shared";
//   export const transportStatusEnum = pgEnum("transport_status", TRANSPORT_STATUS);
//
// Until then this module exports an empty namespace so drizzle-kit can
// resolve it without errors.

export {};
