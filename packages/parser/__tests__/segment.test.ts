import { describe, it, expect } from "vitest";
import { segment } from "../src/segment";

describe("segment", () => {
  it("splits into non-empty lines", () => {
    const seg = segment("a\n\nb\n  \n c ");
    expect(seg.lines).toEqual(["a", "b", "c"]);
  });

  it("builds label map from 'Label: value' lines", () => {
    const seg = segment("Paciente: Maria\nDestino: HMV\nFoo");
    expect(seg.labels.get("paciente")).toBe("Maria");
    expect(seg.labels.get("destino")).toBe("HMV");
    expect(seg.labels.has("foo")).toBe(false);
  });

  it("first occurrence wins when label repeats", () => {
    const seg = segment("Motivo: A\nMotivo: B");
    expect(seg.labels.get("motivo")).toBe("A");
  });

  it("supports dash-separated labels", () => {
    const seg = segment("Tipo - ida e volta");
    expect(seg.labels.get("tipo")).toBe("ida e volta");
  });

  it("aceita rótulo conhecido sem dois-pontos", () => {
    // Santo Inácio escreve o destino assim, sem pontuação nenhuma.
    const seg = segment("Local Instituto do cérebro\nAmbulância básica");
    expect(seg.labels.get("local")).toBe("Instituto do cérebro");
    expect(seg.labels.get("destino")).toBe("Instituto do cérebro");
    expect(seg.labels.has("ambulancia")).toBe(false);
  });
});
