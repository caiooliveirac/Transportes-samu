import { NextResponse } from "next/server";
import {
  addTransportDelay,
  removeTransportDelay,
  finalizeTransportDelays,
  findTransportById,
  type DelayFinalizeItem,
} from "@samu-cru/db";
import { DELAY_REASON, type DelayReason } from "@samu-cru/shared";
import { getSession } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Params {
  params: Promise<{ id: string }>;
}

function isDelayReason(v: unknown): v is DelayReason {
  return typeof v === "string" && DELAY_REASON.includes(v as DelayReason);
}

/**
 * Toggle "on" de uma intercorrência durante o caso.
 * Body: { reason: DelayReason }
 */
export async function POST(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.kind !== "user") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: { reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isDelayReason(body.reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }
  try {
    if (!(await findTransportById(id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const delay = await addTransportDelay(id, body.reason, session.userId);
    return NextResponse.json(
      { ok: true, delay: delay ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(`[api/transports/${id}/delays] POST failed:`, err);
    return NextResponse.json({ error: "Failed to add delay" }, { status: 500 });
  }
}

/**
 * Toggle "off": remove uma intercorrência. Query: ?reason=<DelayReason>
 */
export async function DELETE(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.kind !== "user") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const reason = new URL(req.url).searchParams.get("reason");
  if (!isDelayReason(reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }
  try {
    const removed = await removeTransportDelay(id, reason, session.userId);
    return NextResponse.json(
      { ok: true, removed },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(`[api/transports/${id}/delays] DELETE failed:`, err);
    return NextResponse.json(
      { error: "Failed to remove delay" },
      { status: 500 },
    );
  }
}

/**
 * Consolidação no encerramento — substitui o conjunto de intercorrências
 * e grava o relato livre.
 * Body: { delays: [{ reason, impactMinutes? }], report?: string | null }
 */
export async function PUT(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.kind !== "user") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: {
    delays?: Array<{ reason?: unknown; impactMinutes?: unknown }>;
    report?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.delays)) {
    return NextResponse.json({ error: "delays must be array" }, { status: 400 });
  }
  const items: DelayFinalizeItem[] = [];
  for (const d of body.delays) {
    if (!isDelayReason(d?.reason)) {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
    }
    const minutes =
      typeof d.impactMinutes === "number" && Number.isFinite(d.impactMinutes)
        ? d.impactMinutes
        : null;
    items.push({ reason: d.reason, impactMinutes: minutes });
  }
  const report =
    typeof body.report === "string" && body.report.trim()
      ? body.report.trim().slice(0, 2000)
      : null;
  try {
    if (!(await findTransportById(id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const delays = await finalizeTransportDelays(
      id,
      items,
      report,
      session.userId,
    );
    return NextResponse.json(
      { ok: true, delays, report },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(`[api/transports/${id}/delays] PUT failed:`, err);
    return NextResponse.json(
      { error: "Failed to save delays" },
      { status: 500 },
    );
  }
}
