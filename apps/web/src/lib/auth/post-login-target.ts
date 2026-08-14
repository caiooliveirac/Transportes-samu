/**
 * Para onde mandar o usuário depois do login.
 *
 * Existe separado do formulário porque errar isto trava a tela: o form
 * não desliga o "Entrando…" — quem apaga esse estado é a navegação
 * trocar de página. Se o destino for uma rota que o middleware nega, ele
 * devolve para /login, que é a página onde o form JÁ está; o componente
 * não remonta, `loading` fica `true` e o botão gira para sempre.
 *
 * Foi o que acontecia com regulador e admin: sem `?next=` na URL, o form
 * assumia `/solicitar` (rota exclusiva de sessão de unidade).
 */
export type SessionKind = "unit" | "user";
export type UserRole = "regulador" | "admin";

export interface TargetInput {
  /** `?next=` da URL. Null quando ausente — o default NÃO mora aqui. */
  explicitNext: string | null;
  kind: SessionKind;
  role?: UserRole;
}

/**
 * `next` vem da URL, então é entrada não confiável: só caminho interno.
 * "//evil.com" e "https://evil.com" são redirect aberto; "/x" é o único
 * formato aceito.
 */
export function isInternalPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

/** O middleware deixaria esta sessão entrar nesta rota? */
export function canAccess(path: string, kind: SessionKind, role?: UserRole): boolean {
  const isUnitArea = path === "/solicitar" || path.startsWith("/solicitar/");
  if (kind === "unit") return isUnitArea;
  if (isUnitArea) return false;
  const isAdminArea = path === "/admin" || path.startsWith("/admin/");
  return isAdminArea ? role === "admin" : true;
}

export function resolvePostLoginTarget({
  explicitNext,
  kind,
  role,
}: TargetInput): string {
  const fallback = kind === "unit" ? "/solicitar" : "/";
  if (!explicitNext || !isInternalPath(explicitNext)) return fallback;
  return canAccess(explicitNext, kind, role) ? explicitNext : fallback;
}
