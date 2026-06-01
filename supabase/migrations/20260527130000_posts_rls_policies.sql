-- RLS policies for public.posts.
--
-- Bootstrap `20260401000000_base_bootstrap.sql` enables RLS on `posts` but never
-- creates SELECT/INSERT/DELETE policies. After running `db push --include-all`
-- on a fresh project the client (anon/authenticated) sees an empty array with
-- HTTP 200 — feed shows "Brak wpisów" despite rows existing (visible only with
-- the service role, e.g. backfill scripts).
--
-- Convention follows other content tables in this repo:
--   - announcements_select_authenticated  (USING true)
--   - profiles_select_all                 (USING true)
--   - events_select_authenticated_all     (USING true)

drop policy if exists "posts_select_authenticated" on public.posts;
create policy "posts_select_authenticated"
  on public.posts
  for select
  to authenticated
  using (true);

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own"
  on public.posts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own"
  on public.posts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Owner can delete own posts; admin (profiles.role = 'admin') can delete any.
-- Reuses helper `public.is_profile_admin()` defined in
-- `20260512120000_admin_moderation_rls.sql`.
drop policy if exists "posts_delete_own_or_admin" on public.posts;
create policy "posts_delete_own_or_admin"
  on public.posts
  for delete
  to authenticated
  using (auth.uid() = user_id or public.is_profile_admin());
