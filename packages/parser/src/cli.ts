#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseMessage } from "./index";
import type { Extracted, ParseResult } from "./types";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function colorConf(c: number): string {
  if (c >= 0.85) return GREEN;
  if (c >= 0.6) return YELLOW;
  return RED;
}

function fmtExtracted<T>(name: string, e: Extracted<T>): string {
  const conf = `${colorConf(e.confidence)}${e.confidence.toFixed(2)}${RESET}`;
  const val =
    e.value === null
      ? `${DIM}null${RESET}`
      : e.value instanceof Date
        ? e.value.toISOString()
        : typeof e.value === "object"
          ? JSON.stringify(e.value)
          : String(e.value);
  const warn = e.warning ? `  ${YELLOW}⚠ ${e.warning}${RESET}` : "";
  return `  ${BOLD}${name.padEnd(20)}${RESET} ${conf}  ${val}${warn}`;
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: parser-test <path-to-fixture.txt> [--received-at ISO]");
    process.exit(2);
  }

  // pnpm filter altera cwd para packages/parser; INIT_CWD preserva o dir
  // de onde o usuário invocou o comando.
  const cwd = process.env.INIT_CWD ?? process.cwd();
  const filePath = resolve(cwd, arg);
  const rawText = readFileSync(filePath, "utf8");

  const tsArg = process.argv.indexOf("--received-at");
  const receivedAt = tsArg > -1 ? new Date(process.argv[tsArg + 1]!) : new Date();

  const result: ParseResult = parseMessage({ rawText, receivedAt });

  console.log(`${BOLD}━━ ${filePath} ━━${RESET}`);
  console.log(`${DIM}receivedAt:${RESET} ${receivedAt.toISOString()}`);
  console.log();
  console.log(`${BOLD}Extracted fields${RESET}`);
  console.log(fmtExtracted("patientName", result.patientName));
  console.log(fmtExtracted("patientAgeYears", result.patientAgeYears));
  console.log(fmtExtracted("patientBirthDate", result.patientBirthDate));
  console.log(fmtExtracted("patientCns", result.patientCns));
  console.log(fmtExtracted("patientCpf", result.patientCpf));
  console.log(fmtExtracted("originUnitCode", result.originUnitCode));
  console.log(fmtExtracted("destination", result.destination));
  console.log(fmtExtracted("procedure", result.procedure));
  console.log(fmtExtracted("tripType", result.tripType));
  console.log(fmtExtracted("deadlineAt", result.deadlineAt));
  console.log(fmtExtracted("procedureTimeText", result.procedureTimeText));
  console.log(fmtExtracted("vitals", result.vitals));
  console.log(fmtExtracted("diagnoses", result.diagnoses));
  console.log();
  console.log(
    `${BOLD}Global confidence${RESET}  ${colorConf(result.globalConfidence)}${result.globalConfidence.toFixed(3)}${RESET}`,
  );
  console.log(
    `${BOLD}Suggested status${RESET}   ${result.suggestedStatus === "novo" ? GREEN : YELLOW}${result.suggestedStatus}${RESET}`,
  );
  if (result.warnings.length > 0) {
    console.log(`${BOLD}Warnings${RESET}`);
    for (const w of result.warnings) console.log(`  ${YELLOW}⚠${RESET} ${w}`);
  }
}

main();
