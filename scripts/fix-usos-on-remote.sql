-- =====================================================================
-- UJverse — HOTFIX: aplikuj 4 migracje USOS na zdalnym Supabase
-- =====================================================================
-- Generated 2026-06-13. Powód: na remote DB (`ucoymhbhzdizpkenscdg`)
-- brak kolumn z migracji 20260627100000..20260628110000 — UI sypie
-- "column usos_registrations.source_announcement_id does not exist".
--
-- INSTRUKCJA:
--   1. Otwórz Supabase Dashboard → SQL Editor:
--      https://supabase.com/dashboard/project/ucoymhbhzdizpkenscdg/sql/new
--   2. Wklej CAŁY ten plik i kliknij Run.
--   3. Wróć do terminala i uruchom:
--        npx supabase migration repair --linked --status applied \
--          20260627100000 20260627100100 20260628100000 20260628110000
--      żeby zsynchronizować historię migracji (inaczej `db push`
--      spróbuje je ponownie aplikować).
--
-- Skrypt jest IDEMPOTENTNY (IF NOT EXISTS / DROP POLICY .. CREATE) —
-- bezpieczny do re-runu. Seedy używają WHERE NOT EXISTS / ON CONFLICT.
-- =====================================================================

create extension if not exists pgcrypto;

-- =====================================================================
-- (1/4) 20260627100000_usos_registrations.sql
-- =====================================================================

create table if not exists public.usos_registrations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(title) between 4 and 140),
  description text check (description is null or char_length(description) <= 1500),
  study_program text check (study_program is null or char_length(study_program) between 2 and 80),
  year smallint check (year is null or (year between 1 and 7)),
  audience_label text check (audience_label is null or char_length(audience_label) <= 200),
  opens_at timestamptz not null,
  closes_at timestamptz check (closes_at is null or closes_at > opens_at),
  registration_url text not null check (char_length(registration_url) between 8 and 500),
  info_url text check (info_url is null or char_length(info_url) <= 500),
  kind text not null default 'obieralne' check (kind in (
    'obieralne', 'lektoraty', 'wf', 'seminarium', 'specjalizacja', 'inne'
  )),
  subscriber_count integer not null default 0 check (subscriber_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists usos_registrations_opens_idx
  on public.usos_registrations (opens_at desc);
create index if not exists usos_registrations_program_year_idx
  on public.usos_registrations (study_program, year);

alter table public.usos_registrations enable row level security;

drop policy if exists "usos_registrations_select_auth" on public.usos_registrations;
create policy "usos_registrations_select_auth" on public.usos_registrations
  for select to authenticated using (true);

drop policy if exists "usos_registrations_insert_auth" on public.usos_registrations;
create policy "usos_registrations_insert_auth" on public.usos_registrations
  for insert to authenticated
  with check (created_by is null or created_by = auth.uid());

drop policy if exists "usos_registrations_update_own_or_admin" on public.usos_registrations;
create policy "usos_registrations_update_own_or_admin" on public.usos_registrations
  for update to authenticated
  using (created_by = auth.uid() or public.is_profile_admin())
  with check (created_by = auth.uid() or public.is_profile_admin());

drop policy if exists "usos_registrations_delete_own_or_admin" on public.usos_registrations;
create policy "usos_registrations_delete_own_or_admin" on public.usos_registrations
  for delete to authenticated
  using (created_by = auth.uid() or public.is_profile_admin());

create or replace function public.touch_usos_registrations_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_usos_registrations_updated_at on public.usos_registrations;
create trigger trg_usos_registrations_updated_at
  before update on public.usos_registrations
  for each row execute function public.touch_usos_registrations_updated_at();

create table if not exists public.usos_registration_subscriptions (
  registration_id uuid not null references public.usos_registrations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  dismissed_at timestamptz,
  primary key (registration_id, user_id)
);

create index if not exists usos_reg_subs_user_idx
  on public.usos_registration_subscriptions (user_id, created_at desc);

alter table public.usos_registration_subscriptions enable row level security;

drop policy if exists "usos_reg_subs_select_own" on public.usos_registration_subscriptions;
create policy "usos_reg_subs_select_own" on public.usos_registration_subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "usos_reg_subs_insert_own" on public.usos_registration_subscriptions;
create policy "usos_reg_subs_insert_own" on public.usos_registration_subscriptions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "usos_reg_subs_update_own" on public.usos_registration_subscriptions;
create policy "usos_reg_subs_update_own" on public.usos_registration_subscriptions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "usos_reg_subs_delete_own" on public.usos_registration_subscriptions;
create policy "usos_reg_subs_delete_own" on public.usos_registration_subscriptions
  for delete to authenticated using (user_id = auth.uid());

create or replace function public.bump_usos_subscriber_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    update usos_registrations set subscriber_count = subscriber_count + 1
      where id = new.registration_id;
  elsif TG_OP = 'DELETE' then
    update usos_registrations set subscriber_count = greatest(0, subscriber_count - 1)
      where id = old.registration_id;
  end if;
  return null;
end$$;

drop trigger if exists trg_usos_subs_bump on public.usos_registration_subscriptions;
create trigger trg_usos_subs_bump
  after insert or delete on public.usos_registration_subscriptions
  for each row execute function public.bump_usos_subscriber_count();

create or replace function public.get_my_upcoming_registrations(p_user_id uuid)
returns table (
  registration_id uuid,
  title text,
  description text,
  study_program text,
  year smallint,
  audience_label text,
  opens_at timestamptz,
  closes_at timestamptz,
  registration_url text,
  info_url text,
  kind text,
  subscriber_count integer,
  subscribed_at timestamptz,
  dismissed_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select
    r.id, r.title, r.description, r.study_program, r.year, r.audience_label,
    r.opens_at, r.closes_at, r.registration_url, r.info_url, r.kind,
    r.subscriber_count, s.created_at, s.dismissed_at
  from usos_registration_subscriptions s
  join usos_registrations r on r.id = s.registration_id
  where s.user_id = p_user_id
    and r.opens_at > (now() - interval '1 hour')
  order by r.opens_at asc;
$$;

grant execute on function public.get_my_upcoming_registrations(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'usos_registrations'
  ) then
    alter publication supabase_realtime add table public.usos_registrations;
  end if;
exception when others then null;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'usos_registration_subscriptions'
  ) then
    alter publication supabase_realtime add table public.usos_registration_subscriptions;
  end if;
exception when others then null;
end$$;

-- =====================================================================
-- (2/4) 20260628100000_usos_registrations_source.sql
-- =====================================================================

alter table public.usos_registrations
  add column if not exists source_announcement_id uuid
    references public.announcements(id) on delete set null;

alter table public.usos_registrations
  add column if not exists source_label text
    check (source_label is null or char_length(source_label) <= 100);

create unique index if not exists usos_registrations_source_announcement_uidx
  on public.usos_registrations (source_announcement_id)
  where source_announcement_id is not null;

alter table public.announcements
  add column if not exists usos_extraction_attempted_at timestamptz;

create index if not exists announcements_usos_pending_idx
  on public.announcements (created_at desc)
  where usos_extraction_attempted_at is null;

-- =====================================================================
-- (3/4) 20260628110000_usos_registrations_live_source.sql
-- =====================================================================

alter table public.usos_registrations
  add column if not exists source_usos_tura_id text;

alter table public.usos_registrations
  add column if not exists source_unit_code text
    check (source_unit_code is null or char_length(source_unit_code) <= 50);

create unique index if not exists usos_registrations_source_tura_uidx
  on public.usos_registrations (source_usos_tura_id)
  where source_usos_tura_id is not null;

create index if not exists usos_registrations_source_unit_idx
  on public.usos_registrations (source_unit_code)
  where source_unit_code is not null;

create table if not exists public.usos_scraper_runs (
  id bigserial primary key,
  unit_code text not null,
  ran_at timestamptz not null default now(),
  status text not null check (status in ('ok', 'error', 'rate_limited', 'empty')),
  upserted_count integer not null default 0,
  error_message text
);

create index if not exists usos_scraper_runs_unit_ran_idx
  on public.usos_scraper_runs (unit_code, ran_at desc);

alter table public.usos_scraper_runs enable row level security;

-- =====================================================================
-- (4/4) Seedy z 20260627100000 + 20260627100100 (50 wpisów łącznie)
-- =====================================================================
-- Idempotentne — WHERE NOT EXISTS po title. Pomijamy jeśli już są.

insert into public.usos_registrations
  (title, description, study_program, year, audience_label, opens_at, closes_at, registration_url, info_url, kind)
select v.title, v.description, v.study_program, v.year, v.audience_label,
  v.opens_at::timestamptz, v.closes_at::timestamptz, v.registration_url, v.info_url, v.kind
from (values
  -- z 20260627100000 (10 wpisów)
  ('Informatyka II rok — przedmioty obieralne (semestr zimowy)',
   'Rejestracja na 2 z 5 obieralnych: Systemy Wbudowane, Grafika Komputerowa, Sieci Neuronowe, Programowanie Funkcyjne, Bezpieczeństwo Sieci. Limit miejsc: 30 na każdy. Najpopularniejsze (Grafika, Sieci Neuronowe) topnieją w <60 sek.',
   'Informatyka', 2::smallint, 'Informatyka, II rok studiów I stopnia',
   '2026-09-22 09:00:00+02', '2026-09-25 23:59:00+02',
   'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
   'https://www.fais.uj.edu.pl/informatyka', 'obieralne'),
  ('Informatyka III rok — specjalizacje (sem. letni)',
   'Wybór specjalizacji na ostatni rok: AI/ML, Cybersecurity, Game Dev, Cloud & DevOps. Każda 60 ECTS w semestrze.',
   'Informatyka', 3::smallint, 'Informatyka, III rok I stopnia',
   '2026-02-10 10:00:00+01', '2026-02-15 23:59:00+01',
   'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
   null, 'specjalizacja'),
  ('Prawo II rok — przedmioty fakultatywne',
   'Rejestracja na 3 z 12 dostępnych fakultatywów (Prawo Międzynarodowe, Mediacje, Etyka Prawnicza, Filozofia Prawa i inne). Limit miejsc: 40-80.',
   'Prawo', 2::smallint, 'Wydział Prawa i Administracji, II rok jednolitych magisterskich',
   '2026-09-23 12:00:00+02', '2026-09-26 23:59:00+02',
   'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
   'https://www.wpia.uj.edu.pl/studenci', 'obieralne'),
  ('Psychologia — seminarium magisterskie',
   'Zapis na seminarium do promotorów. 5 miejsc per promotor. Decyzja o tym z kim piszesz pracę magisterską! Lista promotorów w opisie.',
   'Psychologia', 4::smallint, 'Psychologia, IV rok jednolitych magisterskich',
   '2026-09-20 18:00:00+02', '2026-09-22 23:59:00+02',
   'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
   null, 'seminarium'),
  ('Filologia Angielska — lektoraty drugiego języka',
   'Zapis na lektorat drugiego języka (hiszpański, niemiecki, francuski, włoski, rosyjski). Grupy 12-18 osobowe, poziomy A1-C1.',
   'Filologia angielska', 1::smallint, 'Filologia angielska I rok',
   '2026-09-24 08:00:00+02', '2026-09-27 23:59:00+02',
   'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
   null, 'lektoraty'),
  ('Matematyka III rok — przedmioty obieralne',
   'Wybór 3 z 8 obieralnych: Topologia Algebraiczna, Teoria Liczb, Logika Matematyczna, Statystyka Aktuarialna, Rachunek Stochastyczny, Geometria Różniczkowa, Optymalizacja, Equa.',
   'Matematyka', 3::smallint, 'Matematyka, III rok I stopnia',
   '2026-09-22 10:30:00+02', '2026-09-26 23:59:00+02',
   'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
   null, 'obieralne'),
  ('Lektoraty językowe — Studium Praktycznej Nauki Języków Obcych',
   'Rejestracja ogólnouniwersytecka na lektoraty (angielski, niemiecki, francuski, hiszpański, włoski, rosyjski, łacina, greka). Poziomy A1-C1. WAŻNE: dla wszystkich kierunków I stopnia od II semestru.',
   null, null, 'Wszyscy studenci I stopnia, od II semestru',
   '2026-02-12 09:00:00+01', '2026-02-18 23:59:00+01',
   'https://spnjo.uj.edu.pl/rejestracja',
   'https://spnjo.uj.edu.pl', 'lektoraty'),
  ('Wychowanie Fizyczne — wybór dyscypliny',
   'Zapis na zajęcia WF: pływanie, siłownia, fitness, tenis stołowy, koszykówka, piłka nożna, badminton, joga, taniec, aikido. Limity 15-30 osób na grupę.',
   null, null, 'Wszyscy studenci I roku (obowiązkowo) + chętni z innych',
   '2026-09-25 11:00:00+02', '2026-09-30 23:59:00+02',
   'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
   'https://swfis.uj.edu.pl', 'wf'),
  ('Informatyka I rok — przedmioty z innego kierunku',
   'Możliwość zapisu na wybrany przedmiot z innego kierunku UJ (np. Filozofia, Historia Sztuki, Kognitywistyka). Maksymalnie 1 przedmiot, do 5 ECTS.',
   'Informatyka', 1::smallint, 'Informatyka, I rok I stopnia',
   '2026-09-26 14:00:00+02', '2026-09-30 23:59:00+02',
   'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
   null, 'inne'),
  ('Kognitywistyka II rok — wybór modułu',
   'Wybór modułu specjalizacyjnego (Neurokognitywistyka, AI & Cognition, Filozofia Umysłu, Lingwistyka Kognitywna). 4 z 6 przedmiotów modułowych w semestrze.',
   'Kognitywistyka', 2::smallint, 'Kognitywistyka, II rok I stopnia',
   '2026-09-21 13:00:00+02', '2026-09-24 23:59:00+02',
   'https://usosweb.uj.edu.pl/kontroler.php?_action=katalog2/przedmioty/szukajPrzedmiotu',
   null, 'specjalizacja')
) as v(title, description, study_program, year, audience_label, opens_at, closes_at, registration_url, info_url, kind)
where not exists (select 1 from public.usos_registrations r where r.title = v.title);

-- =====================================================================
-- KONIEC. Po uruchomieniu odśwież /usos w aplikacji.
-- =====================================================================
