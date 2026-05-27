import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import {
  findCredentialByUsername,
  touchLastLogin,
  verifyPassword,
} from "@samu-cru/db";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signSession,
} from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("unit"),
    username: z.string().min(1).max(64),
    password: z.string().min(1).max(200),
  }),
  z.object({
    kind: z.literal("admin"),
    password: z.string().min(1).max(200),
  }),
]);

function safeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  let payload: z.infer<typeof Body>;
  try {
    payload = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (payload.kind === "admin") {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      return NextResponse.json(
        { error: "admin_not_configured" },
        { status: 500 },
      );
    }
    if (!safeEqualString(payload.password, expected)) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }
    const token = await signSession({ kind: "admin" });
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return NextResponse.json({ ok: true, kind: "admin" });
  }

  const record = await findCredentialByUsername(payload.username);
  if (!record) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }
  const ok = await verifyPassword(payload.password, record.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  await touchLastLogin(record.unitId);
  const token = await signSession({
    kind: "unit",
    unitId: record.unitId,
    unitCode: record.unit.code,
    unitName: record.unit.name,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return NextResponse.json({
    ok: true,
    kind: "unit",
    unitName: record.unit.name,
  });
}
