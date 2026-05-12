-- Ensure authenticated users can read public.profiles for event author joins.
-- If a similar SELECT policy already exists, keep this migration as the source of truth.

do $$
begin
  if to_regclass('public.profiles') is null then
    raise warning 'public.profiles does not exist; skipping profiles SELECT policy';
    return;
  end if;

  execute 'alter table public.profiles enable row level security';
  execute 'drop policy if exists "profiles_select_all" on public.profiles';
  execute $policy$
    create policy "profiles_select_all"
      on public.profiles
      for select
      to authenticated
      using (true)
  $policy$;
end
$$;
