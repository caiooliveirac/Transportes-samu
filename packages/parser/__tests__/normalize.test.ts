import { describe, it, expect } from "vitest";
import { normalize, stripAccents, matchKey } from "../src/normalize";

describe("normalize", () => {
  it("strips *bold* markup preserving content", () => {
    expect(normalize("*HEMODIÁLISE*")).toBe("HEMODIÁLISE");
    expect(normalize("**bold**")).toBe("bold");
    expect(normalize("plain")).toBe("plain");
  });

  it("unifies em/en dashes to em-dash", () => {
    expect(normalize("a — b – c")).toBe("a — b — c");
  });

  it("normalizes curly quotes", () => {
    expect(normalize("“hello”")).toBe('"hello"');
    expect(normalize("o ‘x’")).toBe("o 'x'");
  });

  it("trims line ends and collapses multiple blank lines", () => {
    const raw = "line 1   \n\n\n\nline 2\n";
    expect(normalize(raw)).toBe("line 1\n\nline 2");
  });
});

describe("stripAccents", () => {
  it("removes common diacritics", () => {
    expect(stripAccents("PIRAJÁ")).toBe("PIRAJA");
    expect(stripAccents("São Cristóvão")).toBe("Sao Cristovao");
    expect(stripAccents("Coração")).toBe("Coracao");
  });
});

describe("matchKey", () => {
  it("lowercases, removes accents, collapses spaces", () => {
    expect(matchKey("  UPA  PIRAJÁ ")).toBe("upa pirajá".normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " "));
    expect(matchKey("São Cristóvão")).toBe("sao cristovao");
  });
});
