import { listTransportsForDashboard } from "@samu-cru/db";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireRegulatorOrAdminSession } from "@/lib/auth/server";
import type {
  DashboardData,
  SerializedTransport,
  SerializedUnit,
} from "@/lib/dashboard-types";

// O painel lê estado vivo do DB — não prerender, não cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Server Component. Busca o snapshot direto via @samu-cru/db (sem passar
 * pelo /api), serializa Date → ISO, e passa pro DashboardShell client.
 * O cliente também tem a opção de re-fetch via /api/transports
 * (Phase 3 SSE fallback) — o handler retorna o mesmo shape.
 */
export default async function HomePage() {
  const session = await requireRegulatorOrAdminSession();
  const snapshot = await listTransportsForDashboard();

  const data: DashboardData = {
    units: snapshot.units.map(
      (u) =>
        ({
          ...u,
          createdAt: u.createdAt.toISOString(),
        }) as SerializedUnit,
    ),
    transports: snapshot.transports.map(
      (t) =>
        ({
          ...t,
          patientBirthDate: t.patientBirthDate ?? null,
          deadlineAt: t.deadlineAt ? t.deadlineAt.toISOString() : null,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        }) as SerializedTransport,
    ),
    serverTime: snapshot.serverTime,
  };

  return (
    <DashboardShell
      initial={data}
      currentUser={{ name: session.name, role: session.role }}
    />
  );
}
