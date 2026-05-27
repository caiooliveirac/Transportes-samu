import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const KEY_LEN = 64;
const SALT_LEN = 16;
const SCHEME = "scrypt";

/**
 * Hash de senha com scrypt (Node runtime). Formato armazenado:
 *   scrypt$<saltHex>$<derivedKeyHex>
 * scrypt é resistente a hardware paralelo (GPU/ASIC) e está em
 * node:crypto — zero dependência externa.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = (await scryptAsync(plain, salt, KEY_LEN)) as Buffer;
  return `${SCHEME}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== SCHEME) return false;
  const [, saltHex, keyHex] = parts;
  try {
    const salt = Buffer.from(saltHex!, "hex");
    const key = Buffer.from(keyHex!, "hex");
    const test = (await scryptAsync(plain, salt, key.length)) as Buffer;
    return key.length === test.length && timingSafeEqual(key, test);
  } catch {
    return false;
  }
}

/**
 * Gera uma senha legível, fácil de ditar por telefone: 4 grupos de 3
 * caracteres alfanuméricos sem ambíguos (sem 0/O/I/l/1).
 */
export function generateReadablePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const out: string[] = [];
  for (let g = 0; g < 4; g++) {
    let group = "";
    const bytes = randomBytes(3);
    for (let i = 0; i < 3; i++) {
      group += alphabet[bytes[i]! % alphabet.length];
    }
    out.push(group);
  }
  return out.join("-");
}
