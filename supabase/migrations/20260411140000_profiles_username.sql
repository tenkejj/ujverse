-- Kolumna username + trigger zapisujący ją z user_metadata przy rejestracji (shadow e-mail).

alter table public.profiles
  add column if not exists username text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_username text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
begin
  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    ),
    coalesce(meta_username, split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
