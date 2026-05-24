import { NextResponse } from "next/server";
import { findTransportWithContext } from "@samu-cru/db";

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
