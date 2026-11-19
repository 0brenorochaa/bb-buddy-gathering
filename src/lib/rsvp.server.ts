import { getCookie, deleteCookie, setCookie } from "@tanstack/react-start/server";
import { getSql, type Sql } from "@/lib/db";
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
  undecided?: boolean;
  has_companion: boolean;
  companion_name: string;
  companion_relation: string;
  companion_relation_note: string;
  correction_hash: string;
  created_at: string | Date;
  updated_at: string | Date;
};

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env["NODE_ENV"] === "production",
  };
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return new Date(0).toISOString();
  return parsed.toISOString();
}

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

async function ensureAdmin(sql: Sql) {
  const existing = await sql<{ id: string }>`select id from admins limit 1`;
  if (existing.length > 0) return;
  await sql`
    insert into admins (id, username, password_hash)
    values ('organizer', ${INITIAL_USERNAME}, ${INITIAL_PASSWORD_HASH})
  `;
}

async function findByCode(sql: Sql, code: string): Promise<DbRsvp | null> {
  const normalized = normalizeCode(code);
  if (normalized.length < 8) return null;
  const rows = await sql<DbRsvp>`
    select * from rsvps where correction_hash = ${sha256(normalized)} limit 1
  `;
  return rows[0] ?? null;
}

export async function currentAdmin(): Promise<{ id: string; username: string } | null> {
  const token = getCookie(ADMIN_COOKIE);
  if (!token) return null;
  const sql = await getSql();
  const rows = await sql<{ id: string; username: string }>`
    select a.id, a.username
    from admin_sessions s
    join admins a on a.id = s.admin_id
    where s.token_hash = ${sha256(token)}
      and s.expires_at > now()
    limit 1
  `;
  return rows[0] ?? null;
}

async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) return null;
  return admin;
}

export async function loginAdmin(username: string, password: string) {
  const sql = await getSql();
  await ensureAdmin(sql);
  await sql`delete from login_attempts where created_at < now() - interval '1 day'`;
  const recent = await sql<{ n: number | string }>`
    select count(*)::int as n
    from login_attempts
    where success = false
      and created_at > now() - interval '15 minutes'
  `;
  if (num(recent[0]?.n) >= 8) {
    return {
      ok: false as const,
      error: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    };
  }

  const user = username.trim();
  const rows = await sql<{ id: string; username: string; password_hash: string }>`
    select id, username, password_hash from admins where username = ${user} limit 1
  `;
  const row = rows[0];
  const valid = await verifyPassword(password, row?.password_hash ?? INITIAL_PASSWORD_HASH);
  if (!row || !valid) {
    await sql`insert into login_attempts (success) values (false)`;
    return { ok: false as const, error: "Usuário ou senha incorretos." };
  }

  await sql`insert into login_attempts (success) values (true)`;
  await sql`delete from admin_sessions where expires_at < now()`;
  const token = newSecret();
  const expires = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await sql`
    insert into admin_sessions (token_hash, admin_id, expires_at)
    values (${sha256(token)}, ${row.id}, ${expires})
  `;
  setCookie(ADMIN_COOKIE, token, { ...cookieBase(), maxAge: SESSION_SECONDS });
  return { ok: true as const, username: row.username };
}

export async function logoutAdmin() {
  const token = getCookie(ADMIN_COOKIE);
  if (token) {
    const sql = await getSql();
    await sql`delete from admin_sessions where token_hash = ${sha256(token)}`;
  }
  deleteCookie(ADMIN_COOKIE, cookieBase());
  return { ok: true as const };
}

export async function changeAdminPassword(currentPassword: string, nextPassword: string) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Sessão expirada. Entre novamente." };
  if (nextPassword.length < 8) {
    return { ok: false as const, error: "A nova senha precisa ter pelo menos 8 caracteres." };
  }
  if (nextPassword.length > 72) {
    return { ok: false as const, error: "A nova senha está longa demais." };
  }
  if (nextPassword === currentPassword) {
    return { ok: false as const, error: "Escolha uma senha diferente da atual." };
  }
  const sql = await getSql();
  const rows = await sql<{ password_hash: string }>`
    select password_hash from admins where id = ${admin.id} limit 1
  `;
  const stored = rows[0]?.password_hash;
  if (!stored || !(await verifyPassword(currentPassword, stored))) {
    return { ok: false as const, error: "A senha atual não confere." };
  }
  const nextHash = await hashPassword(nextPassword);
  await sql`
    update admins
    set password_hash = ${nextHash}, updated_at = now()
    where id = ${admin.id}
  `;
  const token = getCookie(ADMIN_COOKIE);
  if (token) {
    await sql`
      delete from admin_sessions
      where admin_id = ${admin.id} and token_hash <> ${sha256(token)}
    `;
  }
  return { ok: true as const };
}

function rememberTicket(code: string) {
  const normalized = normalizeCode(code);
  if (!normalized) return;
  setCookie(TICKET_COOKIE, normalized, { ...cookieBase(), maxAge: TICKET_SECONDS });
}

async function writeRow(sql: Sql, id: string, value: RsvpInput) {
  await sql`
    update rsvps set
      full_name = ${value.fullName},
      name_key = ${normalizeName(value.fullName)},
      attending = ${value.attending},
      undecided = ${value.undecided},
      has_companion = ${value.hasCompanion},
      companion_name = ${value.companionName},
      companion_relation = ${value.companionRelation},
      companion_relation_note = ${value.companionRelationNote},
      updated_at = now()
    where id = ${id}
  `;
}

export async function submitRegistration(raw: unknown): Promise<SubmitResult> {
  const parsed = validateRsvp(coerceInput(raw));
  if (!parsed.ok) return parsed;
  const value = parsed.value;
  const sql = await getSql();
  const nameKey = normalizeName(value.fullName);
  const explicit = normalizeCode(value.correctionCode);
  const cookieCode = normalizeCode(getCookie(TICKET_COOKIE) ?? "");

  let owned: DbRsvp | null = null;
  let ownedCode = "";
  if (explicit) {
    owned = await findByCode(sql, explicit);
    if (!owned) {
      return {
        ok: false,
        error: "Código de correção não encontrado. Confira os caracteres e tente de novo.",
      };
    }
    ownedCode = explicit;
  } else if (cookieCode) {
    const fromCookie = await findByCode(sql, cookieCode);
    if (fromCookie && fromCookie.name_key === nameKey) {
      owned = fromCookie;
      ownedCode = cookieCode;
    }
  }

  if (owned) {
    const clash = await sql<{ id: string }>`
      select id from rsvps where name_key = ${nameKey} and id <> ${owned.id} limit 1
    `;
    if (clash.length > 0) {
      return { ok: false, error: "Este nome já está em outra confirmação." };
    }
    await writeRow(sql, owned.id, value);
    rememberTicket(ownedCode);
    const fresh = await sql<DbRsvp>`select * from rsvps where id = ${owned.id} limit 1`;
    return {
      ok: true,
      created: false,
      code: formatCode(ownedCode),
      message: SUCCESS_MESSAGE,
      rsvp: mapRow(fresh[0] ?? owned),
    };
  }

  const duplicate = await sql<{ id: string }>`
    select id from rsvps where name_key = ${nameKey} limit 1
  `;
  if (duplicate.length > 0) {
    return {
      ok: false,
      error:
        "Já existe uma confirmação com este nome. Use o código de correção para atualizar somente a sua resposta.",
    };
  }

  const code = newCorrectionCode();
  const id = crypto.randomUUID();
  try {
    await sql`
      insert into rsvps (
        id, full_name, name_key, attending, undecided, has_companion, companion_name,
        companion_relation, companion_relation_note, correction_hash
      ) values (
        ${id},
        ${value.fullName},
        ${nameKey},
        ${value.attending},
        ${value.undecided},
        ${value.hasCompanion},
        ${value.companionName},
        ${value.companionRelation},
        ${value.companionRelationNote},
        ${sha256(code)}
      )
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("unique") || message.includes("23505")) {
      return {
        ok: false,
        error:
          "Já existe uma confirmação com este nome. Use o código de correção para atualizar somente a sua resposta.",
      };
    }
    throw error;
  }

  rememberTicket(code);
  const fresh = await sql<DbRsvp>`select * from rsvps where id = ${id} limit 1`;
  if (!fresh[0]) throw new Error("Não foi possível ler a confirmação recém-salva.");
  return {
    ok: true,
    created: true,
    code: formatCode(code),
    message: SUCCESS_MESSAGE,
    rsvp: mapRow(fresh[0]),
  };
}

export async function lookupOwn(raw: unknown): Promise<OwnResult> {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const typed = typeof record["code"] === "string" ? record["code"] : "";
  const sql = await getSql();
  const explicit = normalizeCode(typed);
  const cookieCode = normalizeCode(getCookie(TICKET_COOKIE) ?? "");
  if (explicit) {
    const row = await findByCode(sql, explicit);
    if (!row) return { ok: false, error: "Código não encontrado. Confira e tente de novo." };
    rememberTicket(explicit);
    return { ok: true, rsvp: mapRow(row), code: formatCode(explicit) };
  }
  if (cookieCode) {
    const row = await findByCode(sql, cookieCode);
    if (row) return { ok: true, rsvp: mapRow(row), code: formatCode(cookieCode) };
  }
  return { ok: true, rsvp: null, code: "" };
}

export async function adminOverview(): Promise<
  { ok: true; username: string; stats: Stats; rows: RsvpRecord[] } | { ok: false; error: string }
> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Não autorizado." };
  const sql = await getSql();
  const statsRows = await sql<{
    registered: number | string;
    attending: number | string;
    absent: number | string;
    undecided: number | string;
    companions: number | string;
  }>`
    select
      count(*)::int as registered,
      count(*) filter (where attending)::int as attending,
      count(*) filter (where not attending and not undecided)::int as absent,
      count(*) filter (where undecided)::int as undecided,
      count(*) filter (where attending and has_companion)::int as companions
    from rsvps
  `;
  const statsRow = statsRows[0];
  const attending = num(statsRow?.attending);
  const companions = num(statsRow?.companions);
  const rows = await sql<DbRsvp>`select * from rsvps order by created_at desc, full_name asc`;
  return {
    ok: true,
    username: admin.username,
    stats: {
      registered: num(statsRow?.registered),
      attending,
      absent: num(statsRow?.absent),
      undecided: num(statsRow?.undecided),
      companions,
      confirmedPeople: attending + companions,
    },
    rows: rows.map(mapRow),
  };
}

export async function adminUpdate(raw: unknown) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Não autorizado." };
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id = typeof record["id"] === "string" ? record["id"] : "";
  if (!id) return { ok: false as const, error: "Registro inválido." };
  const parsed = validateRsvp(coerceInput(raw));
  if (!parsed.ok) return parsed;
  const value = parsed.value;
  const sql = await getSql();
  const nameKey = normalizeName(value.fullName);
  const clash = await sql<{ id: string }>`
    select id from rsvps where name_key = ${nameKey} and id <> ${id} limit 1
  `;
  if (clash.length > 0) {
    return { ok: false as const, error: "Já existe outro participante com este nome." };
  }
  const existing = await sql<{ id: string }>`select id from rsvps where id = ${id} limit 1`;
  if (existing.length === 0) return { ok: false as const, error: "Registro não encontrado." };
  await writeRow(sql, id, value);
  return { ok: true as const };
}

export async function adminRemove(raw: unknown) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Não autorizado." };
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id = typeof record["id"] === "string" ? record["id"] : "";
  if (!id) return { ok: false as const, error: "Registro inválido." };
  const sql = await getSql();
  const removed = await sql<{ id: string }>`delete from rsvps where id = ${id} returning id`;
  if (removed.length === 0) return { ok: false as const, error: "Registro não encontrado." };
  return { ok: true as const };
}
