import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { lerTokenFederado } from "../src/lib/auth/federacao";

const SEGREDO = "s".repeat(48);
const chave = (s: string) => new TextEncoder().encode(s);

async function token(claims: Record<string, unknown>, opts: { aud?: string; exp?: string; segredo?: string } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setAudience(opts.aud ?? "transportes")
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "60s")
    .sign(chave(opts.segredo ?? SEGREDO));
}

const valido = { tipo: "escala-handoff", origem: "plantoes", sub: "Regulador@Exemplo.test" };

describe("lerTokenFederado", () => {
  it("aceita o handoff do portal e normaliza o e-mail", async () => {
    expect(await lerTokenFederado(await token(valido), SEGREDO)).toBe("regulador@exemplo.test");
  });
  it("recusa outra audiência, outro tipo, outra chave e token vencido", async () => {
    expect(await lerTokenFederado(await token(valido, { aud: "plantoes" }), SEGREDO)).toBeNull();
    expect(await lerTokenFederado(await token({ ...valido, tipo: "outro" }), SEGREDO)).toBeNull();
    expect(await lerTokenFederado(await token(valido, { segredo: "x".repeat(48) }), SEGREDO)).toBeNull();
    expect(await lerTokenFederado(await token(valido, { exp: "-10s" }), SEGREDO)).toBeNull();
  });
  it("desligado sem segredo", async () => {
    expect(await lerTokenFederado(await token(valido), undefined)).toBeNull();
  });
});
