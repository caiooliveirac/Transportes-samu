import type { ParseResult } from "../src/types";

export interface FieldMatcher {
  equals?: string | number;
  includes?: string;
  minConfidence?: number;
  warningContains?: string;
}

export interface FixtureExpectation {
  receivedAt: string;
  expect: {
    patientName?: FieldMatcher;
    patientAgeYears?: FieldMatcher;
    patientCns?: FieldMatcher;
    patientCpf?: FieldMatcher;
    originUnitCode?: FieldMatcher;
    destination?: FieldMatcher;
    procedure?: FieldMatcher;
    deadlineLocal?: string;
    tripType?: { equals: string };
    vitals?: Partial<{
      pa: string;
      fc: number;
      fr: number;
      spo2: number;
      glasgow: number;
      temp: number;
    }>;
    diagnosesIncludes?: string[];
    suggestedStatus?: "novo" | "pendente_revisao";
    minGlobalConfidence?: number;
    maxGlobalConfidence?: number;
  };
}

type Failure = { field: string; message: string };

export function matchFixture(
  result: ParseResult,
  exp: FixtureExpectation["expect"],
): Failure[] {
  const fails: Failure[] = [];

  const matchScalar = (
    name: string,
    extracted: { value: unknown; confidence: number; warning?: string },
    matcher: FieldMatcher | undefined,
  ) => {
    if (!matcher) return;
    if (matcher.equals !== undefined && extracted.value !== matcher.equals) {
      fails.push({
        field: name,
        message: `expected equals=${JSON.stringify(matcher.equals)} got ${JSON.stringify(extracted.value)}`,
      });
    }
    if (
      matcher.includes !== undefined &&
      (typeof extracted.value !== "string" || !extracted.value.toLowerCase().includes(matcher.includes.toLowerCase()))
    ) {
      fails.push({
        field: name,
        message: `expected includes "${matcher.includes}" got ${JSON.stringify(extracted.value)}`,
      });
    }
    if (
      matcher.minConfidence !== undefined &&
      extracted.confidence < matcher.minConfidence
    ) {
      fails.push({
        field: name,
        message: `expected confidence >= ${matcher.minConfidence}, got ${extracted.confidence}`,
      });
    }
    if (
      matcher.warningContains !== undefined &&
      (!extracted.warning || !extracted.warning.toLowerCase().includes(matcher.warningContains.toLowerCase()))
    ) {
      fails.push({
        field: name,
        message: `expected warning containing "${matcher.warningContains}", got ${JSON.stringify(extracted.warning)}`,
      });
    }
  };

  matchScalar("patientName", result.patientName, exp.patientName);
  matchScalar("patientAgeYears", result.patientAgeYears, exp.patientAgeYears);
  matchScalar("patientCns", result.patientCns, exp.patientCns);
  matchScalar("patientCpf", result.patientCpf, exp.patientCpf);
  matchScalar("originUnitCode", result.originUnitCode, exp.originUnitCode);
  matchScalar("destination", result.destination, exp.destination);
  matchScalar("procedure", result.procedure, exp.procedure);

  if (exp.tripType) {
    if (result.tripType.value !== exp.tripType.equals) {
      fails.push({
        field: "tripType",
        message: `expected ${exp.tripType.equals}, got ${result.tripType.value}`,
      });
    }
  }

  if (exp.deadlineLocal) {
    const [h, m] = exp.deadlineLocal.split(":").map((n) => parseInt(n, 10));
    if (!result.deadlineAt.value) {
      fails.push({
        field: "deadlineAt",
        message: `expected ${exp.deadlineLocal}, got null`,
      });
    } else {
      const d = result.deadlineAt.value;
      // Comparação em UTC — receivedAt nos fixtures é UTC e setHours usa local;
      // como nodejs roda em America/Sao_Paulo (UTC-3), o setHours(h, m) local
      // resulta em (h+3)%24 UTC. Aqui aceitamos tanto a hora UTC quanto a hora
      // que seria local, para o teste rodar em qualquer TZ.
      const localH = d.getHours();
      const localM = d.getMinutes();
      if (localH !== h || localM !== m) {
        fails.push({
          field: "deadlineAt",
          message: `expected local ${exp.deadlineLocal}, got ${String(localH).padStart(2, "0")}:${String(localM).padStart(2, "0")}`,
        });
      }
    }
  }

  if (exp.vitals && result.vitals.value) {
    for (const [key, want] of Object.entries(exp.vitals)) {
      const got = (result.vitals.value as Record<string, unknown>)[key];
      if (got !== want) {
        fails.push({
          field: `vitals.${key}`,
          message: `expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`,
        });
      }
    }
  } else if (exp.vitals) {
    fails.push({ field: "vitals", message: "expected vitals but got null" });
  }

  if (exp.diagnosesIncludes && exp.diagnosesIncludes.length > 0) {
    const list = (result.diagnoses.value ?? []).map((d) => d.toLowerCase());
    for (const wanted of exp.diagnosesIncludes) {
      if (!list.some((d) => d.includes(wanted.toLowerCase()))) {
        fails.push({
          field: "diagnoses",
          message: `expected diagnosis containing "${wanted}", got ${JSON.stringify(result.diagnoses.value)}`,
        });
      }
    }
  }

  if (exp.suggestedStatus && result.suggestedStatus !== exp.suggestedStatus) {
    fails.push({
      field: "suggestedStatus",
      message: `expected ${exp.suggestedStatus}, got ${result.suggestedStatus}`,
    });
  }

  if (
    exp.minGlobalConfidence !== undefined &&
    result.globalConfidence < exp.minGlobalConfidence
  ) {
    fails.push({
      field: "globalConfidence",
      message: `expected >= ${exp.minGlobalConfidence}, got ${result.globalConfidence}`,
    });
  }
  if (
    exp.maxGlobalConfidence !== undefined &&
    result.globalConfidence > exp.maxGlobalConfidence
  ) {
    fails.push({
      field: "globalConfidence",
      message: `expected <= ${exp.maxGlobalConfidence}, got ${result.globalConfidence}`,
    });
  }

  return fails;
}
