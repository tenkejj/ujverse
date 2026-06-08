-- Privacy flags na profilu — sterowane z `SettingsView`.
-- Kolumny domyślnie `true`, więc wszyscy istniejący użytkownicy zachowują obecne zachowanie:
--   * is_searchable: czy profil pojawia się w wyszukiwarce (Meili) — sync-search
--     mapper zwraca `null` dla `false` → wpis usuwany z indeksu.
--   * show_department: czy badge wydziału jest widoczny przy postach autora —
--     czytane w `PostsAdapter.toUnified`.
--
-- Polityka RLS na update-self istnieje już w `supabase_setup.sql`
-- (`profiles_update_own`). Migracja jest defensywna: tworzy ją tylko jeśli
-- żadna polityka update na public.profiles dla danego użytkownika nie istnieje
-- — żeby `SettingsView` mógł zapisywać `is_searchable` / `show_department`
-- również w środowiskach, gdzie `supabase_setup.sql` nie został odpalony.

do $$
begin
  if to_regclass('public.profiles') is null then
    raise warning 'public.profiles does not exist; skipping privacy flags';
    return;
  end if;

  execute 'alter table public.profiles add column if not exists is_searchable boolean not null default true';
  execute 'alter table public.profiles add column if not exists show_department boolean not null default true';

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd = 'UPDATE'
  ) then
    execute 'alter table public.profiles enable row level security';
    execute $policy$
      create policy "profiles_update_self"
        on public.profiles
        for update
        to authenticated
        using (auth.uid() = id)
        with check (auth.uid() = id)
    $policy$;
  end if;
end
$$;
