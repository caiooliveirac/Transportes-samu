import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  verifySession,
  type SessionPayload,
} from "./session";

/**
 * Lê e valida a sessão a partir do cookie. Retorna null se ausente
 * ou inválida. Use em RSC / route handlers (node runtime).
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireUnitSession(): Promise<
  Extract<SessionPayload, { kind: "unit" }>
> {
  const session = await getSession();
  if (!session || session.kind !== "unit") {
    redirect("/login?next=/solicitar");
  }
  return session;
}

export async function requireAdminSession(): Promise<
  Extract<SessionPayload, { kind: "admin" }>
> {
  const session = await getSession();
  if (!session || session.kind !== "admin") {
    redirect("/login?next=/admin");
  }
  return session;
}
