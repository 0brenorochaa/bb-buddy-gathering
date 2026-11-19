-- BB Confraternização 2026 — confirmações e acesso da organização.
-- A senha inicial não fica neste arquivo: apenas o hash scrypt (salt:hash).

create table if not exists admins (
  id text primary key,
  username text not null unique,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

insert into admins (id, username, password_hash)
values (
  'organizer',
  'Participantesbb26',
  '31177d1020804683558d3c8b3a27595d:0c23f4e4e266c45e2dd09cfbc3ebf28103c73db8666023194c7d5e1778d04677f7865f35f97f75dddae619d96c883ded785c1af27e0a501455ff20088d24ff55'
)
on conflict (username) do nothing;

create table if not exists admin_sessions (
  token_hash text primary key,
  admin_id text not null references admins (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists login_attempts (
  id serial primary key,
  success boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists rsvps (
  id text primary key,
  full_name text not null,
  name_key text not null unique,
  attending boolean not null,
  has_companion boolean not null default false,
  companion_name text not null default '',
  companion_relation text not null default '',
  companion_relation_note text not null default '',
  correction_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rsvps_companion_chk check (
    (attending = false and has_companion = false)
    or (attending = true and has_companion = false)
    or (
      attending = true
      and has_companion = true
      and length(companion_name) > 0
      and length(companion_relation) > 0
    )
  )
);

create index if not exists rsvps_attending_idx on rsvps (attending);
create index if not exists rsvps_correction_hash_idx on rsvps (correction_hash);
create index if not exists admin_sessions_expires_idx on admin_sessions (expires_at);
-- Opção "Ainda não sei, mas confirmarei até 30/11".
alter table rsvps add column if not exists undecided boolean not null default false;
