import { jwtVerify } from "jose";

/**
 * Entrada pelo portal mnrs.com.br (login único — kairos ADR 0013).
 *
 * O porteiro da raiz confere a senha no plantoes e, quando a pessoa toca no
 * card do Transportes, assina um token de 60 s no contrato de federação do
 * parque (`tipo: "escala-handoff"`, `sub` = e-mail, `aud` = "transportes").
 * Aqui só se confere o token; QUEM entra continua decidido pela tabela de
 * usuários daqui (ativo, papel regulador/admin) — igual ao login por senha.
 *
 * Ligado só com MNRS_FEDERACAO_SECRET no ambiente. Sem ela, null sempre.
 */
export const ID_TRANSPORTES = "transportes";
const TIPO = "escala-handoff";

export async function lerTokenFederado(
  token: string,
  segredo: string | undefined = process.env.MNRS_FEDERACAO_SECRET,
): Promise<string | null> {
  if (!segredo || segredo.length < 32 || !token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(segredo), {
      algorithms: ["HS256"],
      audience: ID_TRANSPORTES,
    });
    if (payload.tipo !== TIPO || typeof payload.sub !== "string" || !payload.sub.includes("@")) {
      return null;
    }
    return payload.sub.trim().toLowerCase();
  } catch {
    return null;
  }
}
