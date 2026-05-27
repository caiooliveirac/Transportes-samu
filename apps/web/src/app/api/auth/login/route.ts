import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import {
  findCredentialByUsername,
  findUserByEmail,
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
    kind: z.literal("user"),
    email: z.string().min(1).max(200),
    password: z.string().min(1).max(200),
  }),
]);

export async function POST(req: Request) {
  let payload: z.infer<typeof Body>;
  try {
    payload = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (payload.kind === "user") {
    const u = await findUserByEmail(payload.email);
    if (!u || !u.isActive) {
      return NextResponse.json(
        { error: "invalid_credentials" },
        { status: 401 },
      );
    }
    if (u.role !== "regulador" && u.role !== "admin") {
      return NextResponse.json({ error: "invalid_role" }, { status: 403 });
    }
    const ok = await verifyPassword(payload.password, u.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "invalid_credentials" },
        { status: 401 },
      );
    }
    const token = await signSession({
      kind: "user",
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role as "regulador" | "admin",
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
      kind: "user",
      name: u.name,
      role: u.role,
    });
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
