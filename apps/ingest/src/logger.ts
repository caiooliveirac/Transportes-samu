import pino from "pino";
import { ENV } from "./env";

/**
 * Logger pino com redactor de PII (PLANNING §13). Nunca exporta
 * rawText, patientName, patientCns, patientCpf nos logs — usuários
 * com acesso ao log não devem ver dados clínicos identificáveis.
 *
 * Para debug em dev, use LOG_LEVEL=debug e os warnings detalhados
 * vão imprimir; nomes ainda saem redacted como "***".
 */
export const logger = pino({
  level: ENV.logLevel,
  redact: {
    paths: [
      "*.patientName",
      "*.patientCns",
      "*.patientCpf",
      "*.rawText",
      "patientName",
      "patientCns",
      "patientCpf",
      "rawText",
    ],
    censor: "***",
  },
});
