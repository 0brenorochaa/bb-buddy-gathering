import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;

/** scrypt salt:hash of the initial organizer password. Plaintext is not stored. */
export const INITIAL_PASSWORD_HASH =
  "31177d1020804683558d3c8b3a27595d:0c23f4e4e266c45e2dd09cfbc3ebf28103c73db8666023194c7d5e1778d04677f7865f35f97f75dddae619d96c883ded785c1af27e0a501455ff20088d24ff55";

export const INITIAL_USERNAME = "Participantesbb26";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex || saltHex.length < 16 || hashHex.length < 32) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;
  const derived = (await scryptAsync(password, salt, expected.length)) as Buffer;
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function newSecret(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newCorrectionCode(): string {
  const bytes = randomBytes(10);
  let raw = "";
  for (let i = 0; i < 10; i += 1) raw += ALPHABET[bytes[i]! % ALPHABET.length];
  return raw;
}

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatCode(raw: string): string {
  const normalized = normalizeCode(raw);
  if (normalized.length !== 10) return normalized;
  return `${normalized.slice(0, 5)}-${normalized.slice(5)}`;
}
