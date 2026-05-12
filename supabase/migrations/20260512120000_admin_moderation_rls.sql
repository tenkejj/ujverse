-- Moderacja: funkcja pomocnicza i polityka DELETE na komentarzach (właściciel lub admin).
-- Tabele `posts` / `profiles` — jeśli mają włączone RLS w projekcie, dodaj analogiczne polityki
-- DELETE/UPDATE w panelu Supabase (np. delete gdy is_profile_admin() lub update is_banned dla admina).

create or replace function public.is_profile_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

comment on function public.is_profile_admin() is 'true gdy zalogowany użytkownik ma profiles.role = admin';

grant execute on function public.is_profile_admin() to authenticated;

drop policy if exists "comments_delete_own_or_admin" on public.comments;
create policy "comments_delete_own_or_admin"
  on public.comments
  for delete
  to authenticated
  using (auth.uid() = user_id or public.is_profile_admin());
