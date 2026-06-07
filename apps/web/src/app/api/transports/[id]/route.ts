import { NextResponse } from "next/server";
import { findTransportWithContext, updateTransportProgress } from "@samu-cru/db";
import {
  AMBULANCE_KIND,
  TRANSPORT_STATUS,
  type AmbulanceKind,
  type TransportStatus,
} from "@samu-cru/shared";
import { getSession } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const data = await findTransportWithContext(id);
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error(`[api/transports/${id}] failed:`, err);
    return NextResponse.json(
      { error: "Failed to load transport" },
      { status: 500 },
    );
  }
}

/**
 * Andamento da ocorrência pelo regulador: vincular/trocar/desvincular
 * viatura e/ou mudar status. Body parcial:
 *   { status?, ambulanceLabel?, ambulanceKind? }
 * ambulanceLabel "" ou null desvincula. Omitir um campo = não mexe nele.
 */
export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.kind !== "user") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: {
    status?: TransportStatus;
    ambulanceLabel?: string | null;
    ambulanceKind?: AmbulanceKind | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    body.status !== undefined &&
    !TRANSPORT_STATUS.includes(body.status)
  ) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (
    body.ambulanceKind != null &&
    !AMBULANCE_KIND.includes(body.ambulanceKind)
  ) {
    return NextResponse.json(
      { error: "Invalid ambulance kind" },
      { status: 400 },
    );
  }
  if (
    body.status === undefined &&
    body.ambulanceLabel === undefined
  ) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const updated = await updateTransportProgress(
      id,
      {
        status: body.status,
        ambulanceLabel: body.ambulanceLabel,
        ambulanceKind: body.ambulanceKind ?? undefined,
      },
      session.userId,
    );
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { ok: true, transport: updated },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(`[api/transports/${id}] PATCH failed:`, err);
    return NextResponse.json(
      { error: "Failed to update transport" },
      { status: 500 },
    );
  }
}
