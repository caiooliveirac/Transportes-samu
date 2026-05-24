import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMessage } from "../src";
import { matchFixture, type FixtureExpectation } from "./match-expectations";

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(here, "fixtures");

const fixtureNames = readdirSync(dir)
  .filter((f) => f.endsWith(".expected.json"))
  .map((f) => f.replace(".expected.json", ""));

describe("parser fixtures (integration)", () => {
  it("has at least 10 fixtures", () => {
    expect(fixtureNames.length).toBeGreaterThanOrEqual(10);
  });

  for (const name of fixtureNames) {
    it(name, () => {
      const rawText = readFileSync(resolve(dir, `${name}.txt`), "utf8");
      const expected = JSON.parse(
        readFileSync(resolve(dir, `${name}.expected.json`), "utf8"),
      ) as FixtureExpectation;
      const receivedAt = new Date(expected.receivedAt);

      const result = parseMessage({ rawText, receivedAt });

      const failures = matchFixture(result, expected.expect);
      if (failures.length > 0) {
        const lines = failures.map((f) => `  · ${f.field}: ${f.message}`);
        throw new Error(`fixture ${name} failed:\n${lines.join("\n")}`);
      }
    });
  }
});
