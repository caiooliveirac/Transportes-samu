import { describe, it, expect } from "vitest";
import { deadlineKind } from "@samu-cru/shared";
import { isOverdue, isUrgent } from "../src/lib/urgency";

describe("deadlineKind", () => {
  it.each([
    ["APARTIR das 08:00", "from"],
    ["A PARTIR DAS 14H", "from"],
    ["após as 10:00", "from"],
    ["IDA IMEDIATA", "immediate"],
    ["IMEDIATO", "immediate"],
    ["17/08 AS 07:00", "fixed"],
    ["ATE AS 14:00", "fixed"],
    [null, "none"],
  ])("%s → %s", (text, expected) => {
    expect(deadlineKind(text)).toBe(expected);
  });
});

describe("janela aberta não atrasa", () => {
  const now = new Date("2026-08-18T12:00:00Z");
  const passou = new Date("2026-08-18T08:00:00Z");

  it("hora marcada que já passou é atraso", () => {
    expect(isOverdue(passou, "novo", now, "AS 08:00")).toBe(true);
  });

  it("'a partir das 08:00' com 08:00 no passado não é atraso", () => {
    expect(isOverdue(passou, "novo", now, "APARTIR das 08:00")).toBe(false);
  });

  it("janela aberta também não entra na faixa de urgência", () => {
    const emBreve = new Date("2026-08-18T12:20:00Z");
    expect(isUrgent(emBreve, "novo", now, "AS 12:20")).toBe(true);
    expect(isUrgent(emBreve, "novo", now, "a partir das 12:20")).toBe(false);
  });
});
