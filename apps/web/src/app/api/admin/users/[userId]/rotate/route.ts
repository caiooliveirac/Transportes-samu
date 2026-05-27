import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import {
  findUserById,
  generateReadablePassword,
  hashPassword,
  rotateUserPassword,
} from "@samu-cru/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getSession();
  if (!session || session.kind !== "user" || session.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { userId } = await params;
  const userIdNum = Number(userId);
  if (!Number.isInteger(userIdNum) || userIdNum <= 0) {
    return NextResponse.json({ error: "invalid_user" }, { status: 400 });
  }
  const u = await findUserById(userIdNum);
  if (!u) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  const password = generateReadablePassword();
  const passwordHash = await hashPassword(password);
  await rotateUserPassword(userIdNum, passwordHash);
  return NextResponse.json({
    ok: true,
    email: u.email,
    name: u.name,
    password,
  });
}
