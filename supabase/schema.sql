-- =====================================================================
-- Rode este SQL no projeto Supabase DO PAINEL (SQL Editor > New query)
-- =====================================================================

create table if not exists public.clients (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  contact           text,
  site_url          text,
  supabase_url      text,
  supabase_key      text,          -- anon / publishable key do cliente (nunca a service_role)
  ping_table        text default 'keep_alive',
  monthly_fee       numeric(10,2),
  notes             text,
  active            boolean not null default true,
  last_ping_at      timestamptz,
  last_ok_at        timestamptz,   -- último ping BEM-SUCEDIDO no banco
  last_ping_ok      boolean,
  last_ping_message text,
  last_site_ok      boolean,
  last_site_status  int,
  created_at        timestamptz not null default now()
);

create table if not exists public.pings (
  id          bigint generated always as identity primary key,
  client_id   uuid not null references public.clients(id) on delete cascade,
  created_at  timestamptz not null default now(),
  source      text not null default 'cron',  -- 'cron' | 'manual'
  db_ok       boolean,
  db_status   int,
  db_ms       int,
  db_message  text,
  site_ok     boolean,
  site_status int,
  site_ms     int
);

create index if not exists pings_client_created_idx on public.pings (client_id, created_at desc);

-- Segurança: só usuários logados acessam. O cron usa a service_role (ignora RLS).
alter table public.clients enable row level security;
alter table public.pings   enable row level security;

drop policy if exists "auth full access clients" on public.clients;
create policy "auth full access clients" on public.clients
  for all to authenticated using (true) with check (true);

drop policy if exists "auth full access pings" on public.pings;
create policy "auth full access pings" on public.pings
  for all to authenticated using (true) with check (true);

-- Limpeza: mantém só 90 dias de histórico (chamado pelo cron)
create or replace function public.prune_old_pings() returns void
language sql security definer set search_path = public as $$
  delete from public.pings where created_at < now() - interval '90 days';
$$;
revoke all on function public.prune_old_pings() from public, anon, authenticated;
