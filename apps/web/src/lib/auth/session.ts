import { SignJWT, jwtVerify } from "jose";

/**
 * Sessão assinada (JWT HS256) que carrega só o necessário pra autorizar.
 * Edge-compatible (jose roda em Web Crypto). Validade 12h.
 *
 * - `kind: 'unit'`  → solicitante de UPA, pode usar /solicitar e /api/solicitar
 * - `kind: 'admin'` → senha mestra, pode ver dashboard + /admin/*
 */
export type SessionPayload =
  | {
      kind: "unit";
      unitId: number;
      unitCode: string;
      unitName: string;
    }
  | {
      kind: "admin";
    };

const ALG = "HS256";
const TTL_SECONDS = 12 * 60 * 60;

let cachedKey: Uint8Array | null = null;

function getKey(): Uint8Array {
  if (cachedKey) return cachedKey;
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET environment variable is required and must be at least 32 chars",
    );
  }
  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getKey());
}

export async function verifySession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getKey(), { algorithms: [ALG] });
    if (payload.kind === "unit") {
      if (
        typeof payload.unitId === "number" &&
        typeof payload.unitCode === "string" &&
        typeof payload.unitName === "string"
      ) {
        return {
          kind: "unit",
          unitId: payload.unitId,
          unitCode: payload.unitCode,
          unitName: payload.unitName,
        };
      }
    }
    if (payload.kind === "admin") return { kind: "admin" };
    return null;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "samu_session";
export const SESSION_TTL_SECONDS = TTL_SECONDS;
