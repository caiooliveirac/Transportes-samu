import { describe, it, expect } from "vitest";
import { MISSING_ORIGIN } from "@samu-cru/shared";
import { bucketByUnit } from "../src/lib/group-by-unit";

const UNITS = ["upa_piraja", "upa_brotas", "hmum"];

function t(id: string, originUnitRaw: string) {
  return { id, originUnitRaw };
}

describe("bucketByUnit", () => {
  it("cria uma coluna por unidade, mesmo vazia", () => {
    const { columns } = bucketByUnit(UNITS, []);
    expect([...columns.keys()]).toEqual(UNITS);
    expect(columns.get("hmum")).toEqual([]);
  });

  it("põe cada transporte na coluna da sua unidade", () => {
    const { columns, unresolved } = bucketByUnit(UNITS, [
      t("a", "upa_piraja"),
      t("b", "upa_brotas"),
      t("c", "upa_piraja"),
    ]);
    expect(columns.get("upa_piraja")!.map((x) => x.id)).toEqual(["a", "c"]);
    expect(columns.get("upa_brotas")!.map((x) => x.id)).toEqual(["b"]);
    expect(unresolved).toEqual([]);
  });

  // A regressão que este módulo existe para impedir: origem não reconhecida
  // deixava o transporte fora de toda coluna e ele sumia da tela, enquanto
  // continuava contado no cabeçalho.
  it("não descarta transporte sem coluna", () => {
    const { columns, unresolved } = bucketByUnit(UNITS, [
      t("a", "upa_piraja"),
      t("b", MISSING_ORIGIN),
      t("c", "UPA QUE NÃO EXISTE"),
    ]);
    expect(columns.get("upa_piraja")!.map((x) => x.id)).toEqual(["a"]);
    expect(unresolved.map((x) => x.id)).toEqual(["b", "c"]);
  });

  it("todo transporte aparece exatamente uma vez", () => {
    const input = [
      t("a", "upa_piraja"),
      t("b", MISSING_ORIGIN),
      t("c", "hmum"),
      t("d", "texto solto"),
    ];
    const { columns, unresolved } = bucketByUnit(UNITS, input);
    const saidos = [...[...columns.values()].flat(), ...unresolved].map((x) => x.id);
    expect(saidos.sort()).toEqual(["a", "b", "c", "d"]);
  });
});
