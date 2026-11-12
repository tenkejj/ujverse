-- Minimal Supabase-like environment (roles, auth.uid(), default grants).
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create publication supabase_realtime;

create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(current_setting('request.jwt.claim.role', true), 'anon')
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create table public.profiles (
  id uuid primary key,
  full_name text,
  role text default 'user'
);
alter table public.profiles enable row level security;
create policy profiles_select_all on public.profiles for select to authenticated using (true);
