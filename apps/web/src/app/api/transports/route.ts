import { NextResponse } from "next/server";
import { listTransportsForDashboard } from "@samu-cru/db";

// O dashboard lê estado vivo do DB — nunca prerender.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const snapshot = await listTransportsForDashboard();
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/transports] failed:", err);
    return NextResponse.json(
      { error: "Failed to load transports snapshot" },
      { status: 500 },
    );
  }
}
