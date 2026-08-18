import { describe, it, expect } from "vitest";
import { formatWait, waitMinutes, waitTone } from "@samu-cru/shared";

describe("relógio da viatura presa", () => {
  const now = new Date("2026-08-18T12:00:00Z");

  it("conta os minutos desde a chegada ao destino", () => {
    expect(waitMinutes("2026-08-18T10:30:00Z", now)).toBe(90);
    expect(waitMinutes(null, now)).toBeNull();
  });

  it("não conta tempo negativo quando o relógio do cliente adianta", () => {
    expect(waitMinutes("2026-08-18T12:05:00Z", now)).toBe(0);
  });

  it("escalona: 1h30 chama atenção, 3h vira alerta", () => {
    expect(waitTone(45)).toBe("calm");
    expect(waitTone(90)).toBe("attention");
    expect(waitTone(180)).toBe("alert");
  });

  it("formata curto para o card", () => {
    expect(formatWait(45)).toBe("45min");
    expect(formatWait(60)).toBe("1h");
    expect(formatWait(80)).toBe("1h20");
  });
});
