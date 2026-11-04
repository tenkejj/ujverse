\set ON_ERROR_STOP off
\pset footer off

-- Sample data written by "scrapers" (superuser bypasses RLS like service_role).
insert into public.profiles (id, full_name) values ('11111111-1111-1111-1111-111111111111', 'Jan Student');
insert into public.announcements (department, lecturer_name, body, status, title, source_url, source, source_kind)
values ('Wydział Chemii', 'Komunikat wydziałowy', 'Treść komunikatu', 'info', 'Komunikat 1', 'https://chemia.uj.edu.pl/a', 'Portal WCh UJ', 'liferay');
insert into public.official_events (external_id, title, date, faculty, source_name, event_url)
values ('uj:test', 'Wydarzenie testowe', now() + interval '3 days', 'Uniwersytet Jagielloński', 'Uniwersytet Jagielloński', 'https://www.uj.edu.pl/kalendarz/-/x');
-- the seed rows from the usos migration are already present (created_by null, no tura id)
insert into public.usos_registrations (title, opens_at, closes_at, registration_url, kind, source_usos_tura_id, source_unit_code, source_label)
values ('Rejestracja USOSweb', now() - interval '1 day', now() + interval '2 days', 'https://www.usosweb.uj.edu.pl/x', 'inne', '45118', 'UJ.WZ.X', 'Live · USOSweb');
insert into public.usos_registrations (title, opens_at, closes_at, registration_url, kind, created_by)
values ('Wpis społeczności', now(), now() + interval '5 days', 'https://example.org/x', 'inne', '11111111-1111-1111-1111-111111111111');

\echo '=== as anon ==='
set role anon;
select 'anon announcements' as check, count(*) from public.announcements;
select 'anon official_events' as check, count(*) from public.official_events;
select 'anon usos_registrations (all visible rows)' as check, count(*) from public.usos_registrations;
select 'anon usos_registrations without tura id (must be 0)' as check, count(*) from public.usos_registrations where source_usos_tura_id is null;
select 'anon profiles (must be 0)' as check, count(*) from public.profiles;
\echo '--- anon writes (each must fail with RLS violation) ---'
insert into public.announcements (lecturer_name, body, status) values ('x', 'x', 'info');
insert into public.official_events (external_id, title, date, faculty, source_name, event_url) values ('x', 'x', now(), 'WZiKS', 'x', 'https://x');
insert into public.usos_registrations (title, opens_at, registration_url, kind, source_usos_tura_id) values ('Fake rej', now(), 'https://example.org/x', 'inne', '999');
update public.usos_registrations set title = 'hacked' where source_usos_tura_id = '45118';
select 'anon update affected rows (must be 0) — title still' as check, title from public.usos_registrations where source_usos_tura_id = '45118';
delete from public.official_events;
select 'anon delete official_events left rows' as check, count(*) from public.official_events;
reset role;

\echo '=== as authenticated (Jan) ==='
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'auth usos_registrations (all rows incl. seed + community)' as check, count(*) from public.usos_registrations;
select 'auth official_events' as check, count(*) from public.official_events;
select 'auth announcements' as check, count(*) from public.announcements;
reset role;

\echo '=== policies after migration ==='
select tablename, policyname, cmd, roles::text, qual from pg_policies
where tablename in ('announcements', 'official_events', 'usos_registrations') order by 1, 2;
