import { describe, it, expect } from "vitest";
import { segment } from "../src/segment";
import {
  extractName,
  extractAgeYears,
  extractBirthDate,
  extractCns,
  extractCpf,
} from "../src/extractors/patient";
import { extractOrigin } from "../src/extractors/origin";
import { extractDestination } from "../src/extractors/destination";
import { extractProcedure, inferTripType } from "../src/extractors/procedure";
import {
  extractTimeText,
  extractDeadline,
  extractProcedureDate,
} from "../src/extractors/timing";
import { extractVitals } from "../src/extractors/vitals";
import { extractDiagnoses } from "../src/extractors/diagnoses";
import { fuzzyScore, levenshtein, parseDate } from "../src/extractors/utils";

describe("extractName", () => {
  it("pulls name from 'Paciente: NAME, AGEa'", () => {
    const seg = segment("Paciente: Maria das Graças Souza, 67a");
    const r = extractName(seg);
    expect(r.value).toBe("Maria das Graças Souza");
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("falls back to inline 'pcte NAME AGEa'", () => {
    const seg = segment("aqui vai\npcte Diogo Vasconcelos 36a precisa");
    const r = extractName(seg);
    expect(r.value).toBe("Diogo Vasconcelos");
  });

  it("returns null when nothing matches", () => {
    const seg = segment("sem nome aqui");
    const r = extractName(seg);
    expect(r.value).toBeNull();
    expect(r.warning).toBeDefined();
  });
});

describe("extractAgeYears", () => {
  it("matches 'X anos' and 'Xa'", () => {
    expect(extractAgeYears(segment("paciente 36a")).value).toBe(36);
    expect(extractAgeYears(segment("Paciente: X, 67 anos")).value).toBe(67);
  });

  it("rejects implausible ages", () => {
    expect(extractAgeYears(segment("foo 999a")).value).toBeNull();
  });
});

describe("extractBirthDate", () => {
  it("parses DN labels", () => {
    const r = extractBirthDate(segment("DN: 15/03/2018"));
    expect(r.value?.getUTCFullYear()).toBe(2018);
    expect(r.value?.getUTCMonth()).toBe(2);
    expect(r.value?.getUTCDate()).toBe(15);
  });

  it("returns null without recognizable date", () => {
    expect(extractBirthDate(segment("nada")).value).toBeNull();
  });
});

describe("extractCns / extractCpf", () => {
  it("extracts 15-digit CNS with spaces", () => {
    const r = extractCns(segment("CNS: 704 0030 8924 0528"));
    expect(r.value).toBe("704003089240528");
  });

  it("extracts CPF in standard mask", () => {
    const r = extractCpf(segment("CPF: 123.456.789-00"));
    expect(r.value).toBe("12345678900");
  });

  it("returns null for invalid lengths", () => {
    expect(extractCns(segment("CNS: 123")).value).toBeNull();
    expect(extractCpf(segment("CPF: 12")).value).toBeNull();
  });
});

describe("extractOrigin", () => {
  it("matches UPA Pirajá from first line", () => {
    const seg = segment("*SOLICITAÇÃO*\nUPA PIRAJÁ\n...");
    const r = extractOrigin(seg);
    expect(r.value).toBe("upa_piraja");
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it("handles missing diacritics", () => {
    const seg = segment("UPA SANTO ANTONIO\n...");
    const r = extractOrigin(seg);
    expect(r.value).toBe("upa_santo_antonio");
  });

  it("matches HMUM alias", () => {
    const seg = segment("HMUM - Hospital Municipal de Salvador\n...");
    expect(extractOrigin(seg).value).toBe("hmum");
  });
});

describe("extractDestination", () => {
  it("strips alternative '? ou X' and warns", () => {
    const seg = segment("Destino: Roberto Santos? ou HGE");
    const r = extractDestination(seg);
    expect(r.value).toBe("Roberto Santos");
    expect(r.warning).toMatch(/ambig/i);
  });

  it("returns null when no destination found", () => {
    const r = extractDestination(segment("nada aqui"));
    expect(r.value).toBeNull();
  });
});

describe("extractProcedure", () => {
  it("uses explicit Motivo label", () => {
    const r = extractProcedure(segment("Motivo: Internamento"));
    expect(r.value).toBe("Internamento");
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("falls back to keyword inference", () => {
    const r = extractProcedure(segment("paciente precisa de TC crânio"));
    expect(r.value).toBe("Exame");
    expect(r.warning).toMatch(/inferred/);
  });
});

describe("inferTripType", () => {
  it("classifies common one-way procedures", () => {
    expect(inferTripType("Internamento clínico").value).toBe("one_way");
    expect(inferTripType("Transferência UTI").value).toBe("one_way");
  });

  it("classifies common round-trip procedures", () => {
    expect(inferTripType("Consulta endocrino").value).toBe("round_trip");
    expect(inferTripType("Hemodiálise").value).toBe("round_trip");
    expect(inferTripType("TC crânio").value).toBe("round_trip");
  });

  it("returns unknown when nothing matches", () => {
    expect(inferTripType("xyz").value).toBe("unknown");
    expect(inferTripType(null).value).toBe("unknown");
  });
});

describe("extractTimeText / extractDeadline / extractProcedureDate", () => {
  const baseDate = new Date("2026-05-24T11:00:00Z");

  it("captures 'CHEGAR ATÉ HH:MM'", () => {
    const seg = segment("CHEGAR ATÉ 14:30");
    expect(extractTimeText(seg).value).toMatch(/14:30/);
    const d = extractDeadline(seg, baseDate).value;
    expect(d?.getHours()).toBe(14);
    expect(d?.getMinutes()).toBe(30);
  });

  it("captures urgency-only with low confidence", () => {
    const seg = segment("qto antes");
    const r = extractTimeText(seg);
    expect(r.value).toMatch(/qto antes/);
    expect(r.confidence).toBeLessThan(0.7);
  });

  it("extractProcedureDate finds DATA: dd/mm/aaaa", () => {
    const seg = segment("DATA: 25/05/2026");
    const d = extractProcedureDate(seg).value;
    expect(d?.getUTCFullYear()).toBe(2026);
    expect(d?.getUTCMonth()).toBe(4);
    expect(d?.getUTCDate()).toBe(25);
  });
});

describe("extractVitals", () => {
  it("parses a full inline vital line", () => {
    const seg = segment("PA 150x95 · FC 112 · FR 22 · SatO2 93% AA · GCS 14 · Tax 38,1");
    const r = extractVitals(seg);
    expect(r.value).toEqual({
      pa: "150/95",
      fc: 112,
      fr: 22,
      spo2: 93,
      glasgow: 14,
      temp: 38.1,
    });
  });

  it("parses individual vitals out of order", () => {
    const seg = segment("FC 80, sat 95%, PA 120/80");
    const r = extractVitals(seg);
    expect(r.value?.fc).toBe(80);
    expect(r.value?.spo2).toBe(95);
    expect(r.value?.pa).toBe("120/80");
  });

  it("returns null when no vitals present", () => {
    expect(extractVitals(segment("hello world")).value).toBeNull();
  });
});

describe("extractDiagnoses", () => {
  it("splits on comma and 'e'", () => {
    const seg = segment("Hipóteses: TCE grave, choque hemorrágico e sepse");
    const r = extractDiagnoses(seg);
    expect(r.value).toEqual(["TCE grave", "choque hemorrágico", "sepse"]);
  });

  it("falls back to em-dash inside motivo", () => {
    const seg = segment("Motivo: Internamento — pneumonia + ICC desc.");
    const r = extractDiagnoses(seg);
    expect(r.value).toEqual(["pneumonia", "ICC desc."]);
  });
});

describe("fuzzy utilities", () => {
  it("levenshtein basic", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "abc")).toBe(0);
  });

  it("fuzzyScore prefers substring over distance", () => {
    expect(fuzzyScore("UPA PIRAJÁ", "PIRAJA")).toBeGreaterThanOrEqual(0.9);
    expect(fuzzyScore("XYZ", "UPA")).toBeLessThan(0.5);
  });

  it("parseDate handles DD/MM/YYYY and DD-MM-YY", () => {
    expect(parseDate("25/05/2026")?.getUTCFullYear()).toBe(2026);
    expect(parseDate("01-01-99")?.getUTCFullYear()).toBe(1999);
    expect(parseDate("01-01-25")?.getUTCFullYear()).toBe(2025);
    expect(parseDate("invalid")).toBeNull();
  });
});
