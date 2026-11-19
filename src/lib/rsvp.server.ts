import { getCookie, deleteCookie, setCookie } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  coerceInput,
  normalizeName,
  SUCCESS_MESSAGE,
  validateRsvp,
  type OwnResult,
  type RsvpInput,
  type RsvpRecord,
  type Stats,
  type SubmitResult,
} from "@/lib/rsvp-model";
import {
  formatCode,
  hashPassword,
  INITIAL_PASSWORD_HASH,
  INITIAL_USERNAME,
  newCorrectionCode,
  newSecret,
  normalizeCode,
  sha256,
  verifyPassword,
} from "@/lib/password.server";

const ADMIN_COOKIE = "bb26_admin";
const TICKET_COOKIE = "bb26_ticket";
const SESSION_SECONDS = 60 * 60 * 12;
const TICKET_SECONDS = 60 * 60 * 24 * 180;

type DbRsvp = {
  id: string;
  full_name: string;
  name_key: string;
  attending: boolean;
  undecided: boolean;
  has_companion: boolean;
  companion_name: string;
  companion_relation: string;
  companion_relation_note: string;
  correction_hash: string;
  created_at: string;
  updated_at: string;
};

const db = () => supabaseAdmin;

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env["NODE_ENV"] === "production",
  };
}

function fail(error: unknown): never {
  console.error(error);
  throw new Error("Falha ao acessar o banco de dados.");
}

function mapRow(row: DbRsvp): RsvpRecord {
  return {
    id: row.id,
    fullName: row.full_name,
    attending: row.attending === true,
    undecided: row.undecided === true,
    hasCompanion: row.has_companion === true,
    companionName: row.companion_name ?? "",
    companionRelation: row.companion_relation ?? "",
    companionRelationNote: row.companion_relation_note ?? "",
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function getRsvp(column: "id" | "correction_hash" | "name_key", value: string) {
  const { data, error } = await db().from("rsvps").select("*").eq(column, value).maybeSingle();
  if (error) fail(error);
  return (data as DbRsvp | null) ?? null;
}

async function findByCode(code: string): Promise<DbRsvp | null> {
  const normalized = normalizeCode(code);
  if (normalized.length < 8) return null;
  return getRsvp("correction_hash", sha256(normalized));
}

async function nameTaken(nameKey: string, exceptId?: string) {
  let q = db().from("rsvps").select("id").eq("name_key", nameKey).limit(1);
  if (exceptId) q = q.neq("id", exceptId);
  const { data, error } = await q;
  if (error) fail(error);
  return (data ?? []).length > 0;
}

async function ensureAdmin() {
  const { data, error } = await db().from("admins").select("id").limit(1);
  if (error) fail(error);
  if ((data ?? []).length > 0) return;
  await db()
    .from("admins")
    .insert({ id: "organizer", username: INITIAL_USERNAME, password_hash: INITIAL_PASSWORD_HASH });
}

export async function currentAdmin(): Promise<{ id: string; username: string } | null> {
  const token = getCookie(ADMIN_COOKIE);
  if (!token) return null;
  const { data, error } = await db()
    .from("admin_sessions")
    .select("admin_id, expires_at, admins(id, username)")
    .eq("token_hash", sha256(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) fail(error);
  const admin = (data as { admins: { id: string; username: string } | null } | null)?.admins;
  return admin ?? null;
}

export async function loginAdmin(username: string, password: string) {
  await ensureAdmin();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();
  await db().from("login_attempts").delete().lt("created_at", dayAgo);
  const recentSince = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await db()
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("success", false)
    .gt("created_at", recentSince);
  if ((count ?? 0) >= 8) {
    return { ok: false as const, error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }

  const { data: row } = await db()
    .from("admins")
    .select("id, username, password_hash")
    .eq("username", username.trim())
    .maybeSingle();
  const valid = await verifyPassword(password, row?.password_hash ?? INITIAL_PASSWORD_HASH);
  if (!row || !valid) {
    await db().from("login_attempts").insert({ success: false });
    return { ok: false as const, error: "Usuário ou senha incorretos." };
  }

  await db().from("login_attempts").insert({ success: true });
  await db().from("admin_sessions").delete().lt("expires_at", new Date().toISOString());
  const token = newSecret();
  const expires = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  const { error } = await db()
    .from("admin_sessions")
    .insert({ token_hash: sha256(token), admin_id: row.id, expires_at: expires });
  if (error) fail(error);
  setCookie(ADMIN_COOKIE, token, { ...cookieBase(), maxAge: SESSION_SECONDS });
  return { ok: true as const, username: row.username };
}

export async function logoutAdmin() {
  const token = getCookie(ADMIN_COOKIE);
  if (token) await db().from("admin_sessions").delete().eq("token_hash", sha256(token));
  deleteCookie(ADMIN_COOKIE, cookieBase());
  return { ok: true as const };
}

export async function changeAdminPassword(currentPassword: string, nextPassword: string) {
  const admin = await currentAdmin();
  if (!admin) return { ok: false as const, error: "Sessão expirada. Entre novamente." };
  if (nextPassword.length < 8) {
    return { ok: false as const, error: "A nova senha precisa ter pelo menos 8 caracteres." };
  }
  if (nextPassword.length > 72) return { ok: false as const, error: "A nova senha está longa demais." };
  if (nextPassword === currentPassword) {
    return { ok: false as const, error: "Escolha uma senha diferente da atual." };
  }
  const { data } = await db().from("admins").select("password_hash").eq("id", admin.id).maybeSingle();
  if (!data?.password_hash || !(await verifyPassword(currentPassword, data.password_hash))) {
    return { ok: false as const, error: "A senha atual não confere." };
  }
  const nextHash = await hashPassword(nextPassword);
  const { error } = await db()
    .from("admins")
    .update({ password_hash: nextHash, updated_at: new Date().toISOString() })
    .eq("id", admin.id);
  if (error) fail(error);
  const token = getCookie(ADMIN_COOKIE);
  if (token) {
    await db().from("admin_sessions").delete().eq("admin_id", admin.id).neq("token_hash", sha256(token));
  }
  return { ok: true as const };
}

function rememberTicket(code: string) {
  const normalized = normalizeCode(code);
  if (!normalized) return;
  setCookie(TICKET_COOKIE, normalized, { ...cookieBase(), maxAge: TICKET_SECONDS });
}

function rowValues(value: RsvpInput) {
  return {
    full_name: value.fullName,
    name_key: normalizeName(value.fullName),
    attending: value.attending,
    undecided: value.undecided,
    has_companion: value.hasCompanion,
    companion_name: value.companionName,
    companion_relation: value.companionRelation,
    companion_relation_note: value.companionRelationNote,
  };
}

async function writeRow(id: string, value: RsvpInput) {
  const { error } = await db()
    .from("rsvps")
    .update({ ...rowValues(value), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) fail(error);
}

const DUPLICATE =
  "Já existe uma confirmação com este nome. Use o código de correção para atualizar somente a sua resposta.";

export async function submitRegistration(raw: unknown): Promise<SubmitResult> {
  const parsed = validateRsvp(coerceInput(raw));
  if (!parsed.ok) return parsed;
  const value = parsed.value;
  const nameKey = normalizeName(value.fullName);
  const explicit = normalizeCode(value.correctionCode);
  const cookieCode = normalizeCode(getCookie(TICKET_COOKIE) ?? "");

  let owned: DbRsvp | null = null;
  let ownedCode = "";
  if (explicit) {
    owned = await findByCode(explicit);
    if (!owned) {
      return { ok: false, error: "Código de correção não encontrado. Confira os caracteres e tente de novo." };
    }
    ownedCode = explicit;
  } else if (cookieCode) {
    const fromCookie = await findByCode(cookieCode);
    if (fromCookie && fromCookie.name_key === nameKey) {
      owned = fromCookie;
      ownedCode = cookieCode;
    }
  }

  if (owned) {
    if (await nameTaken(nameKey, owned.id)) {
      return { ok: false, error: "Este nome já está em outra confirmação." };
    }
    await writeRow(owned.id, value);
    rememberTicket(ownedCode);
    const fresh = await getRsvp("id", owned.id);
    return { ok: true, created: false, code: formatCode(ownedCode), message: SUCCESS_MESSAGE, rsvp: mapRow(fresh ?? owned) };
  }

  if (await nameTaken(nameKey)) return { ok: false, error: DUPLICATE };

  const code = newCorrectionCode();
  const id = crypto.randomUUID();
  const { data, error } = await db()
    .from("rsvps")
    .insert({ id, ...rowValues(value), correction_hash: sha256(code) })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: DUPLICATE };
    fail(error);
  }
  rememberTicket(code);
  return { ok: true, created: true, code: formatCode(code), message: SUCCESS_MESSAGE, rsvp: mapRow(data as DbRsvp) };
}

export async function lookupOwn(raw: unknown): Promise<OwnResult> {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const typed = typeof record["code"] === "string" ? record["code"] : "";
  const explicit = normalizeCode(typed);
  const cookieCode = normalizeCode(getCookie(TICKET_COOKIE) ?? "");
  if (explicit) {
    const row = await findByCode(explicit);
    if (!row) return { ok: false, error: "Código não encontrado. Confira e tente de novo." };
    rememberTicket(explicit);
    return { ok: true, rsvp: mapRow(row), code: formatCode(explicit) };
  }
  if (cookieCode) {
    const row = await findByCode(cookieCode);
    if (row) return { ok: true, rsvp: mapRow(row), code: formatCode(cookieCode) };
  }
  return { ok: true, rsvp: null, code: "" };
}

export function computeStats(rows: RsvpRecord[]): Stats {
  const attending = rows.filter((r) => r.attending).length;
  const companions = rows.filter((r) => r.attending && r.hasCompanion).length;
  return {
    registered: rows.length,
    attending,
    absent: rows.filter((r) => !r.attending && !r.undecided).length,
    undecided: rows.filter((r) => !r.attending && r.undecided).length,
    companions,
    confirmedPeople: attending + companions,
  };
}

export async function adminOverview(): Promise<
  { ok: true; username: string; stats: Stats; rows: RsvpRecord[] } | { ok: false; error: string }
> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, error: "Não autorizado." };
  const all: DbRsvp[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from("rsvps")
      .select("*")
      .order("created_at", { ascending: false })
      .order("full_name", { ascending: true })
      .range(from, from + 999);
    if (error) fail(error);
    all.push(...((data ?? []) as DbRsvp[]));
    if (!data || data.length < 1000) break;
  }
  const rows = all.map(mapRow);
  return { ok: true, username: admin.username, stats: computeStats(rows), rows };
}

export async function adminUpdate(raw: unknown) {
  const admin = await currentAdmin();
  if (!admin) return { ok: false as const, error: "Não autorizado." };
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id = typeof record["id"] === "string" ? record["id"] : "";
  if (!id) return { ok: false as const, error: "Registro inválido." };
  const parsed = validateRsvp(coerceInput(raw));
  if (!parsed.ok) return parsed;
  if (await nameTaken(normalizeName(parsed.value.fullName), id)) {
    return { ok: false as const, error: "Já existe outro participante com este nome." };
  }
  if (!(await getRsvp("id", id))) return { ok: false as const, error: "Registro não encontrado." };
  await writeRow(id, parsed.value);
  return { ok: true as const };
}

export async function adminRemove(raw: unknown) {
  const admin = await currentAdmin();
  if (!admin) return { ok: false as const, error: "Não autorizado." };
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id = typeof record["id"] === "string" ? record["id"] : "";
  if (!id) return { ok: false as const, error: "Registro inválido." };
  const { data, error } = await db().from("rsvps").delete().eq("id", id).select("id");
  if (error) fail(error);
  if (!data || data.length === 0) return { ok: false as const, error: "Registro não encontrado." };
  return { ok: true as const };
}
