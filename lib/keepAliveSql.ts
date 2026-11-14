export const keepAliveSql = `-- =====================================================================
-- Rode este SQL em CADA projeto Supabase de cliente (uma vez só).
-- Cria uma tabelinha que o painel consulta todo dia. Assim a consulta
-- chega de verdade no Postgres e conta como atividade, o que evita a pausa.
-- Ela não guarda nenhum dado do cliente.
-- =====================================================================

create table if not exists public.keep_alive (
  id         int primary key,
  note       text default 'usada pelo painel para evitar pausa do Supabase free'
);

insert into public.keep_alive (id) values (1) on conflict (id) do nothing;

alter table public.keep_alive enable row level security;

drop policy if exists "keep_alive leitura publica" on public.keep_alive;
create policy "keep_alive leitura publica" on public.keep_alive
  for select to anon, authenticated using (true);

grant select on public.keep_alive to anon, authenticated;
`;
