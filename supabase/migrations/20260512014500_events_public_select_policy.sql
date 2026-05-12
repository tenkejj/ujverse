-- RLS: publiczny odczyt wydarzeń dla zalogowanych (authenticated).
-- Uwaga: w tym repozytarium nie ma migracji tworzącej `public.events`.
-- Jeśli w projekcie Supabase tabela ma inną nazwę, najpierw uruchom zapytanie
-- poniżej w SQL Editor i dostosuj nazwę w tym pliku lub utwórz `public.events`.

-- 0) Odkryj tabele w `public`, których nazwa zawiera „event” (pomoc przy 42P01)
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
  and table_name ilike '%event%'
order by table_name;

-- 1) Inspekcja polityk RLS — tylko jeśli tabela `public.events` istnieje
select p.schemaname, p.tablename, p.policyname, p.roles, p.cmd, p.qual, p.with_check
from pg_policies p
where p.schemaname = 'public'
  and p.tablename = 'events'
  and to_regclass('public.events') is not null
order by p.policyname;

-- 2–3) Polityki: wykonaj wyłącznie gdy istnieje relacja `public.events`
do $$
declare
  p record;
begin
  if to_regclass('public.events') is null then
    raise warning
      'public.events nie istnieje — pomijam DROP/CREATE policy. '
      'Sprawdź wynik zapytania z information_schema (sekcja 0) i utwórz tabelę lub zmień target.';
    return;
  end if;

  execute 'drop policy if exists "events_select_own" on public.events';
  execute 'drop policy if exists "events_read_own" on public.events';
  execute 'drop policy if exists "events_select_creator_only" on public.events';
  execute 'drop policy if exists "events_select_by_user_id" on public.events';

  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'events'
      and cmd = 'SELECT'
      and (
        coalesce(qual, '') ilike '%auth.uid()%user_id%'
        or coalesce(qual, '') ilike '%user_id = auth.uid()%'
        or coalesce(qual, '') ilike '%auth.uid() = user_id%'
      )
  loop
    execute format('drop policy if exists %I on public.events', p.policyname);
  end loop;

  execute 'drop policy if exists "events_select_authenticated_all" on public.events';
  execute $pol$
    create policy "events_select_authenticated_all"
      on public.events
      for select
      to authenticated
      using (true)
  $pol$;
end
$$;
