create table public.admins (
  id text primary key,
  username text not null unique,
  password_hash text not null,
  updated_at timestamptz not null default now()
);
create table public.admin_sessions (
  token_hash text primary key,
  admin_id text not null references public.admins (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table public.login_attempts (
  id bigserial primary key,
  success boolean not null,
  created_at timestamptz not null default now()
);
create table public.rsvps (
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
);
create index rsvps_correction_hash_idx on public.rsvps (correction_hash);

grant all on public.admins, public.admin_sessions, public.login_attempts, public.rsvps to service_role;
grant usage, select on sequence public.login_attempts_id_seq to service_role;
alter table public.admins enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.login_attempts enable row level security;
alter table public.rsvps enable row level security;

insert into public.admins (id, username, password_hash) values (
  'organizer', 'Participantesbb26',
  '31177d1020804683558d3c8b3a27595d:0c23f4e4e266c45e2dd09cfbc3ebf28103c73db8666023194c7d5e1778d04677f7865f35f97f75dddae619d96c883ded785c1af27e0a501455ff20088d24ff55'
);