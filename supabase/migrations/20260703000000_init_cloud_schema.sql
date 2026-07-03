-- Lingtai Guanji cloud schema (2026-07-03)
-- Mirrors the in-memory state of index.html:
--   wizard_snapshots  : one row per user  <- questionnaire slices (nodeScores/lifestyle/atm/basic/redflags/data draft)
--   health_records    : append-only       <- state.records entries (payload keeps full field fidelity)
--   reports           : append-only       <- state.lastReport snapshots
--   profiles          : auto-created from auth.users
--   wechat_identities : service-role only mapping openid/unionid -> auth user

-- ── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  avatar_url text,
  wechat_unionid text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_own"
  on public.profiles for all
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname, avatar_url, wechat_unionid)
  values (
    new.id,
    new.raw_user_meta_data->>'nickname',
    new.raw_user_meta_data->>'avatar',
    new.raw_user_meta_data->>'wechat_unionid'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_touch
  before update on public.profiles
  for each row execute procedure public.touch_updated_at();

-- ── wizard_snapshots (one per user) ─────────────────────────────────────────
create table public.wizard_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  node_scores jsonb not null default '{}'::jsonb,
  lifestyle   jsonb not null default '{}'::jsonb,  -- keeps the -1 "unfilled" sentinel as-is
  atm         jsonb not null default '{}'::jsonb,
  atm_pick    jsonb not null default '{}'::jsonb,
  basic       jsonb not null default '{}'::jsonb,
  redflags    jsonb not null default '{}'::jsonb,
  data_draft  jsonb not null default '{}'::jsonb,
  submitted   boolean not null default false,
  updated_at  timestamptz not null default now()
);
alter table public.wizard_snapshots enable row level security;
create policy "wizard_snapshots_own"
  on public.wizard_snapshots for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create trigger wizard_snapshots_touch
  before update on public.wizard_snapshots
  for each row execute procedure public.touch_updated_at();

-- ── health_records (append-only archive; record_date is the user-entered date string,
--    may be '(未填日期)' and may repeat — created_at provides stable ordering) ──
create table public.health_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  record_date text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.health_records enable row level security;
create policy "health_records_own"
  on public.health_records for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create index idx_health_records_user_time
  on public.health_records (user_id, created_at desc);
create index idx_health_records_payload
  on public.health_records using gin (payload jsonb_path_ops);

-- ── reports ─────────────────────────────────────────────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  engine text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "reports_own"
  on public.reports for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create index idx_reports_user_time
  on public.reports (user_id, created_at desc);

-- ── wechat_identities (RLS on, NO policies: service_role only) ──────────────
create table public.wechat_identities (
  openid text primary key,
  unionid text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  profile jsonb,
  created_at timestamptz not null default now()
);
alter table public.wechat_identities enable row level security;
