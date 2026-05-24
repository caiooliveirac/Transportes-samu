import "dotenv/config";

// TODO Fase 3 (PLANNING §12): bootstrap Baileys worker.
//   - useMultiFileAuthState pointing at apps/ingest/auth/ (gitignored)
//   - whitelist via WA_ALLOWED_CHATS env
//   - messages.upsert handler → @samu-cru/parser → @samu-cru/db insert
//   - messages.update handler → re-parse + UPDATE preserving manual edits
//   - heartbeat to worker_heartbeat table every 30s
//   - reconnection with exponential backoff (1s→2s→4s…60s),
//     STOP on DisconnectReason.loggedOut
//
// Before implementing, clone caiooliveirac/giro-de-leitos to /tmp and
// study its session, reconnect, and handler patterns. Reuse what is
// already validated in production.

async function main() {
  console.log("[ingest] Phase 3 placeholder — worker not implemented yet.");
  console.log("[ingest] See PLANNING.md §12 and design-refs for context.");
}

main().catch((err) => {
  console.error("[ingest] fatal:", err);
  process.exit(1);
});
