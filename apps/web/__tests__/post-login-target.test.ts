import { describe, it, expect } from "vitest";

import {
  canAccess,
  isInternalPath,
  resolvePostLoginTarget,
} from "../src/lib/auth/post-login-target";

/**
 * Estes casos existem porque o destino errado não dá erro: ele trava o
 * botão em "Entrando…" para sempre. O middleware devolve para /login, que
 * é a página onde o formulário já está, o componente não remonta e
 * `loading` nunca volta a false.
 */
describe("resolvePostLoginTarget", () => {
  it("sem ?next=, manda cada sessão para a sua área", () => {
    expect(resolvePostLoginTarget({ explicitNext: null, kind: "unit" })).toBe(
      "/solicitar",
    );
    expect(
      resolvePostLoginTarget({ explicitNext: null, kind: "user", role: "regulador" }),
    ).toBe("/");
    expect(
      resolvePostLoginTarget({ explicitNext: null, kind: "user", role: "admin" }),
    ).toBe("/");
  });

  it("regressão: regulador nunca é mandado para /solicitar", () => {
    // O bug real: o form assumia next="/solicitar" quando a URL não tinha
    // ?next=, e /solicitar exige sessão de unidade.
    expect(
      resolvePostLoginTarget({
        explicitNext: "/solicitar",
        kind: "user",
        role: "regulador",
      }),
    ).toBe("/");
  });

  it("honra ?next= quando a sessão teria acesso", () => {
    expect(
      resolvePostLoginTarget({ explicitNext: "/admin", kind: "user", role: "admin" }),
    ).toBe("/admin");
    expect(
      resolvePostLoginTarget({ explicitNext: "/solicitar/123", kind: "unit" }),
    ).toBe("/solicitar/123");
  });

  it("descarta ?next= que a sessão não acessa", () => {
    expect(
      resolvePostLoginTarget({
        explicitNext: "/admin",
        kind: "user",
        role: "regulador",
      }),
    ).toBe("/");
    expect(resolvePostLoginTarget({ explicitNext: "/", kind: "unit" })).toBe(
      "/solicitar",
    );
  });

  it("descarta destino externo (redirect aberto)", () => {
    for (const evil of ["//evil.com", "https://evil.com", "javascript:alert(1)"]) {
      expect(
        resolvePostLoginTarget({ explicitNext: evil, kind: "user", role: "admin" }),
      ).toBe("/");
    }
  });
});

describe("isInternalPath", () => {
  it("aceita só caminho interno", () => {
    expect(isInternalPath("/admin")).toBe(true);
    expect(isInternalPath("//evil.com")).toBe(false);
    expect(isInternalPath("https://evil.com")).toBe(false);
    expect(isInternalPath("admin")).toBe(false);
  });
});

describe("canAccess espelha o middleware", () => {
  it("área de unidade é só de sessão unit", () => {
    expect(canAccess("/solicitar", "unit")).toBe(true);
    expect(canAccess("/solicitar/abc", "unit")).toBe(true);
    expect(canAccess("/solicitar", "user", "admin")).toBe(false);
  });

  it("sessão unit não entra no dashboard nem no admin", () => {
    expect(canAccess("/", "unit")).toBe(false);
    expect(canAccess("/admin", "unit")).toBe(false);
  });

  it("/admin exige role admin", () => {
    expect(canAccess("/admin", "user", "admin")).toBe(true);
    expect(canAccess("/admin/users", "user", "admin")).toBe(true);
    expect(canAccess("/admin", "user", "regulador")).toBe(false);
    expect(canAccess("/", "user", "regulador")).toBe(true);
  });

  it("não confunde prefixo com segmento", () => {
    // "/solicitarXPTO" não é área de unidade, "/administrativo" não é admin.
    expect(canAccess("/solicitarXPTO", "user", "regulador")).toBe(true);
    expect(canAccess("/administrativo", "user", "regulador")).toBe(true);
  });
});
