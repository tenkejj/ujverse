-- RLS for events mutations: only owner can update/delete.
-- Condition required by product logic: auth.uid() = user_id
-- Safe on projects where public.events does not exist yet.

do $$
begin
  if to_regclass('public.events') is null then
    raise warning 'public.events does not exist; skipping events mutation RLS policies';
    return;
  end if;

  execute 'alter table public.events enable row level security';

  execute 'drop policy if exists "events_update_owner_only" on public.events';
  execute $sql$
    create policy "events_update_owner_only"
      on public.events
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id)
  $sql$;

  execute 'drop policy if exists "events_delete_owner_only" on public.events';
  execute $sql$
    create policy "events_delete_owner_only"
      on public.events
      for delete
      to authenticated
      using (auth.uid() = user_id)
  $sql$;
end
$$;
