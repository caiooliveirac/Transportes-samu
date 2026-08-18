import { describe, it, expect } from "vitest";
import {
  MISSING_ORIGIN,
  isHumanCorrected,
  isOriginResolved,
  mergeCorrectedFields,
} from "@samu-cru/shared";

describe("isOriginResolved", () => {
  it("código de unidade tem coluna no painel", () => {
    expect(isOriginResolved("upa_piraja")).toBe(true);
  });

  it("sentinela e texto solto não têm", () => {
    expect(isOriginResolved(MISSING_ORIGIN)).toBe(false);
    expect(isOriginResolved("UPA DE ALGUM LUGAR")).toBe(false);
    expect(isOriginResolved("")).toBe(false);
    expect(isOriginResolved(null)).toBe(false);
  });
});

describe("marca de dono do campo", () => {
  it("campo sem marca é do parser", () => {
    expect(isHumanCorrected(null, "destinationName")).toBe(false);
    expect(isHumanCorrected([], "destinationName")).toBe(false);
  });

  it("campo marcado é do humano", () => {
    expect(isHumanCorrected(["destinationName"], "destinationName")).toBe(true);
    expect(isHumanCorrected(["destinationName"], "procedure")).toBe(false);
  });

  it("acumula sem duplicar — corrigir duas vezes não repete a marca", () => {
    expect(mergeCorrectedFields(["procedure"], ["destinationName"]).sort()).toEqual([
      "destinationName",
      "procedure",
    ]);
    expect(mergeCorrectedFields(["procedure"], ["procedure"])).toEqual(["procedure"]);
    expect(mergeCorrectedFields(null, ["originUnitRaw"])).toEqual(["originUnitRaw"]);
  });
});
