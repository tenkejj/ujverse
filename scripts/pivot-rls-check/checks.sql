\set ON_ERROR_STOP on
\pset footer off

-- All data and writes below belong to the disposable local database.
-- A failed assertion or unexpected SQL error must make psql exit non-zero.
insert into public.profiles (id, full_name)
values ('11111111-1111-1111-1111-111111111111', 'Jan Student');
insert into public.announcements (department, lecturer_name, body, status, title, source_url, source, source_kind)
values ('Wydział Chemii', 'Komunikat wydziałowy', 'Treść komunikatu', 'info', 'Komunikat 1', 'https://chemia.uj.edu.pl/a', 'Portal WCh UJ', 'liferay');
insert into public.official_events (external_id, title, date, faculty, source_name, event_url)
values ('uj:test', 'Wydarzenie testowe', now() + interval '3 days', 'Uniwersytet Jagielloński', 'Uniwersytet Jagielloński', 'https://www.uj.edu.pl/kalendarz/-/x');
-- Seed registration rows from earlier migrations have no USOSweb round id.
insert into public.usos_registrations (title, opens_at, closes_at, registration_url, kind, source_usos_tura_id, source_unit_code, source_label)
values ('Rejestracja USOSweb', now() - interval '1 day', now() + interval '2 days', 'https://www.usosweb.uj.edu.pl/x', 'inne', '45118', 'UJ.WZ.X', 'Live · USOSweb');
insert into public.usos_registrations (title, opens_at, closes_at, registration_url, kind, created_by)
values ('Wpis społeczności', now(), now() + interval '5 days', 'https://example.org/x', 'inne', '11111111-1111-1111-1111-111111111111');

set role anon;
do $$
begin
  if (select count(*) from public.announcements) <> 1 then
    raise exception 'FAIL: anon must read the public announcement';
  end if;
  if (select count(*) from public.official_events) <> 1 then
    raise exception 'FAIL: anon must read the official event';
  end if;
  if (select count(*) from public.usos_registrations) <> 1 then
    raise exception 'FAIL: anon must see exactly the scraped USOSweb registration';
  end if;
  if exists (select 1 from public.usos_registrations where source_usos_tura_id is null) then
    raise exception 'FAIL: anon can read a seed/community registration';
  end if;
  if exists (select 1 from public.profiles) then
    raise exception 'FAIL: anon can read a private profile';
  end if;
  raise notice 'PASS: anon reads public information and cannot read seed/community registrations or profiles';
end $$;

-- Only an authorization error satisfies each insert-denial assertion.
-- Missing fields, constraint violations or other SQL errors fail the check.
do $$
declare denied boolean := false;
begin
  begin
    insert into public.announcements (department, lecturer_name, body, status, title, source_url, source, source_kind)
    values ('Wydział Chemii', 'x', 'x', 'info', 'Unauthorized announcement', 'https://chemia.uj.edu.pl/x', 'Portal WCh UJ', 'liferay');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'FAIL: anon announcement insert unexpectedly succeeded'; end if;
  raise notice 'PASS: anon announcement insert denied';
end $$;

do $$
declare denied boolean := false;
begin
  begin
    insert into public.official_events (external_id, title, date, faculty, source_name, event_url)
    values ('uj:unauthorized', 'Unauthorized event', now(), 'Uniwersytet Jagielloński', 'Uniwersytet Jagielloński', 'https://www.uj.edu.pl/x');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'FAIL: anon official-event insert unexpectedly succeeded'; end if;
  raise notice 'PASS: anon official-event insert denied';
end $$;

do $$
declare denied boolean := false;
begin
  begin
    insert into public.usos_registrations (title, opens_at, registration_url, kind, source_usos_tura_id)
    values ('Unauthorized registration', now(), 'https://www.usosweb.uj.edu.pl/x', 'inne', '999');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'FAIL: anon registration insert unexpectedly succeeded'; end if;
  raise notice 'PASS: anon registration insert denied';
end $$;

do $$
declare affected bigint;
begin
  update public.usos_registrations set title = 'hacked' where source_usos_tura_id = '45118';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: anon updated a registration'; end if;
  if not exists (select 1 from public.usos_registrations where source_usos_tura_id = '45118' and title = 'Rejestracja USOSweb') then
    raise exception 'FAIL: scraped registration changed after anon update';
  end if;
  delete from public.official_events;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: anon deleted an official event'; end if;
  if (select count(*) from public.official_events) <> 1 then
    raise exception 'FAIL: official event missing after anon delete';
  end if;
  raise notice 'PASS: anon update/delete affect no rows';
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$
begin
  if (select count(*) from public.official_events) <> 1 then
    raise exception 'FAIL: authenticated public-event access regressed';
  end if;
  if (select count(*) from public.announcements) <> 1 then
    raise exception 'FAIL: authenticated announcement access regressed';
  end if;
  if not exists (select 1 from public.usos_registrations where source_usos_tura_id = '45118') then
    raise exception 'FAIL: authenticated user cannot read scraped USOSweb registration';
  end if;
  if not exists (select 1 from public.usos_registrations where title = 'Wpis społeczności' and source_usos_tura_id is null) then
    raise exception 'FAIL: authenticated user cannot read community registration';
  end if;
  raise notice 'PASS: authenticated public and community reads preserved';
end $$;
reset role;

select tablename, policyname, cmd, roles::text, qual from pg_policies
where tablename in ('announcements', 'official_events', 'usos_registrations') order by 1, 2;
\echo 'PASS: all local pivot RLS assertions completed'
