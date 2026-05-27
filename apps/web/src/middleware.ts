import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * Protege rotas baseado no kind da sessão.
 *
 * - public: /login, /api/auth/*, /api/health
 * - exige sessão "unit": /solicitar/*, /api/solicitar/*
 * - exige sessão "admin": /, /admin/*, /api/admin/*, /api/transports/*,
 *   /api/stream
 *
 * Redirecionos UI vão pra /login?next=<path>. APIs respondem 401 JSON.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/health" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  const isApi = pathname.startsWith("/api/");

  function denyUi(next: string) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(url);
  }

  function denyApi() {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Rotas só pra unidade
  if (pathname.startsWith("/solicitar") || pathname.startsWith("/api/solicitar")) {
    if (!session || session.kind !== "unit") {
      return isApi ? denyApi() : denyUi(pathname);
    }
    return NextResponse.next();
  }

  // /admin/* e /api/admin/* exigem role admin
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!session || session.kind !== "user" || session.role !== "admin") {
      return isApi ? denyApi() : denyUi(pathname);
    }
    return NextResponse.next();
  }

  // Dashboard regulador (/, /api/transports/*, /api/stream) — regulador ou admin
  if (!session || session.kind !== "user") {
    return isApi ? denyApi() : denyUi(pathname);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
