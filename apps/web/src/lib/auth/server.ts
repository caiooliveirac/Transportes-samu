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
  Extract<SessionPayload, { kind: "user" }> & { role: "admin" }
> {
  const session = await getSession();
  if (!session || session.kind !== "user" || session.role !== "admin") {
    redirect("/login?next=/admin");
  }
  return session as Extract<SessionPayload, { kind: "user" }> & {
    role: "admin";
  };
}

export async function requireRegulatorOrAdminSession(): Promise<
  Extract<SessionPayload, { kind: "user" }>
> {
  const session = await getSession();
  if (!session || session.kind !== "user") {
    redirect("/login?next=/");
  }
  return session;
}
