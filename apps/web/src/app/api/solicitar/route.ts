import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession } from "@/lib/auth/server";
import { SolicitarSchema } from "@/lib/solicitar/schema";
import { insertTransportFromWebForm } from "@samu-cru/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function splitDiagnoses(text: string | undefined): string[] | undefined {
  if (!text) return undefined;
  const arr = text
    .split(/[\n;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length ? arr : undefined;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.kind !== "unit") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let input: ReturnType<typeof SolicitarSchema.parse>;
  try {
    const body = await req.json();
    input = SolicitarSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid_body", issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Pelo menos uma forma de identificar idade
  if (!input.patientBirthDate && !input.patientAgeText) {
    return NextResponse.json(
      {
        error: "invalid_body",
        message: "Informe data de nascimento ou idade do paciente.",
      },
      { status: 400 },
    );
  }

  const vitalsHasAny =
    input.vitals &&
    Object.values(input.vitals).some((v) => v !== undefined && v !== "");

  const inserted = await insertTransportFromWebForm({
    patientName: input.patientName,
    patientBirthDate: input.patientBirthDate ?? null,
    patientAgeText: input.patientAgeText ?? null,
    patientCns: input.patientCns ?? null,
    patientCpf: input.patientCpf ?? null,

    originUnitId: session.unitId,
    originUnitRaw: session.unitCode,
    destinationName: input.destinationName,

    procedure: input.procedure,
    procedureDate: input.procedureDate ?? null,
    procedureTime: input.procedureTime ?? null,
    deadlineAt: input.deadlineAt ? new Date(input.deadlineAt) : null,
    tripType: input.tripType,

    vitals: vitalsHasAny ? input.vitals! : null,
    diagnoses: splitDiagnoses(input.diagnosesText) ?? null,

    notes: input.notes ?? null,
    createdByUnitId: session.unitId,
    source: "web_form",
    parseConfidence: 1.0,
    status: "novo",
  });

  return NextResponse.json({ ok: true, id: inserted.id });
}
