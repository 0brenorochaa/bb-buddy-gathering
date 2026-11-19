import { neon } from "@neondatabase/serverless";

export interface Sql {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
}

const SCHEMA = [
  `create table if not exists admins (
    id text primary key,
    username text not null unique,
    password_hash text not null,
    updated_at timestamptz not null default now()
  )`,
  `create table if not exists admin_sessions (
    token_hash text primary key,
    admin_id text not null references admins (id) on delete cascade,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists login_attempts (
    id serial primary key,
    success boolean not null,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists rsvps (
    id text primary key,
    full_name text not null,
    name_key text not null unique,
    attending boolean not null,
    undecided boolean not null default false,
    has_companion boolean not null default false,
    companion_name text not null default '',
    companion_relation text not null default '',
    companion_relation_note text not null default '',
    correction_hash text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `alter table rsvps add column if not exists undecided boolean not null default false`,
  `create index if not exists rsvps_correction_hash_idx on rsvps (correction_hash)`,
];

let ready: Promise<Sql> | null = null;

/** Connects to Neon using DATABASE_URL and creates the tables on first use. */
export function getSql(): Promise<Sql> {
  if (!ready) {
    ready = (async () => {
      const url = process.env["DATABASE_URL"]?.trim();
      if (!url) throw new Error("DATABASE_URL não configurada.");
      const client = neon(url);
      for (const stmt of SCHEMA) await client.query(stmt);
      return client as unknown as Sql;
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}
