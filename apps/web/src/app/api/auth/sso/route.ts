import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { findUserByEmail } from "@samu-cru/db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/lib/auth/session";
import { lerTokenFederado } from "@/lib/auth/federacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/sso?token=… — quem vem do portal mnrs.com.br já logado.
 * Token válido + usuário ativo regulador/admin com o mesmo e-mail ⇒ mesma
 * sessão do login por senha. Qualquer outra coisa ⇒ /login com o motivo;
 * a tela de senha continua funcionando como sempre.
 */
export async function GET(req: NextRequest) {
  const destino = (caminho: string) => {
    const url = req.nextUrl.clone();
    const [pathname = "/", search] = caminho.split("?");
    url.pathname = pathname;
    url.search = search ? `?${search}` : "";
    return NextResponse.redirect(url);
  };

  const email = await lerTokenFederado(req.nextUrl.searchParams.get("token") ?? "");
  if (!email) return destino("/login?sso=token-invalido");

  const u = await findUserByEmail(email);
  if (!u || !u.isActive || (u.role !== "regulador" && u.role !== "admin")) {
    console.log(`[sso] ${new Date().toISOString()} sem_acesso ${JSON.stringify({ email })}`);
    return destino("/login?sso=sem-acesso");
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
  console.log(`[sso] ${new Date().toISOString()} ok ${JSON.stringify({ email, role: u.role })}`);
  return destino("/");
}
