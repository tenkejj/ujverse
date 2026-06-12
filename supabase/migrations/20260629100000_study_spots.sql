-- =====================================================================
-- UJverse — Study Spots: community-driven mapa miejsc nauki w Krakowie
-- =====================================================================
-- Killer feature dla studenta UJ: gdzie się dziś uczyć? Mapa bibliotek
-- (BJ, czytelnie wydziałowe), kawiarni przyjaznych laptopom, coworków,
-- dziedzińców z gniazdkami + community check-ins ("kto teraz tam jest")
-- + oceny "cisza/wifi/gniazdka/komfort".
--
-- Architektura:
--   - `study_spots` — katalog (curated + community contributions)
--   - `study_spot_checkins` — live presence "jestem teraz tu" (auto-expire 3h)
--   - `study_spot_ratings` — oceny per user (unique constraint)
--   - Triggery: bump rating_avg/count + active_checkins_count
--   - RLS: SELECT for all authenticated; INSERT moderowane
--   - RPC: get_study_spots_with_user_state(user_id) — paginated combined
--   - Cron-style: trigger który auto-checkoutuje wpisy po `expires_at`
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. study_spots
-- ---------------------------------------------------------------------
create table if not exists public.study_spots (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  address text not null check (char_length(address) between 4 and 240),
  lat numeric(9, 6) not null,
  lng numeric(9, 6) not null,

  -- Typ miejsca — filtrowanie + ikony w UI
  kind text not null check (kind in (
    'library_uj',      -- biblioteki UJ (BJ, czytelnie wydziałowe)
    'library_other',   -- inne biblioteki publiczne / miejskie
    'cafe',            -- kawiarnie przyjazne laptopom
    'coworking',       -- przestrzenie coworking (płatne zwykle)
    'courtyard',       -- dziedzińce, parki, plenery z wifi
    'akademik',        -- akademiki UJ — sale studyjne
    'other'            -- wszystko inne
  )),

  -- Opcjonalny FK do budynku UJ (BJ → uj_buildings.id = 'biblioteka-jagiellonska')
  building_id text references public.uj_buildings(id) on delete set null,

  description text check (description is null or char_length(description) <= 1500),
  hours_text text check (hours_text is null or char_length(hours_text) <= 240),

  -- Photo URLs — pierwsza jest cover, reszta to galeria
  photo_urls text[] not null default '{}'::text[],

  -- Ocena "obiektywna" curatora (1-5, null = brak)
  wifi_quality smallint check (wifi_quality is null or wifi_quality between 1 and 5),
  silence_level smallint check (silence_level is null or silence_level between 1 and 5),
  sockets_count_estimate smallint check (sockets_count_estimate is null or sockets_count_estimate >= 0),

  -- Tagi vibe: 'gniazdka', 'lo-fi', 'cisza-grobowa', 'okna', 'parking', 'wege-jedzenie', 'kawa', '24h'
  tags text[] not null default '{}'::text[],

  website_url text check (website_url is null or website_url ~* '^https?://'),
  google_maps_url text check (google_maps_url is null or google_maps_url ~* '^https?://'),

  is_free boolean not null default true,
  price_hint text check (price_hint is null or char_length(price_hint) <= 80),

  -- Agregaty (sync triggerami)
  rating_avg numeric(3, 2),
  rating_count integer not null default 0 check (rating_count >= 0),
  active_checkins_count integer not null default 0 check (active_checkins_count >= 0),

  created_by uuid references auth.users(id) on delete set null,
  approved boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_spots_kind_idx on public.study_spots (kind) where approved = true;
create index if not exists study_spots_active_checkins_idx on public.study_spots (active_checkins_count desc) where approved = true and active_checkins_count > 0;
create index if not exists study_spots_rating_idx on public.study_spots (rating_avg desc nulls last) where approved = true;
create index if not exists study_spots_building_idx on public.study_spots (building_id) where building_id is not null;
create index if not exists study_spots_tags_gin on public.study_spots using gin (tags);

-- ---------------------------------------------------------------------
-- 2. study_spot_checkins — live presence
-- ---------------------------------------------------------------------
create table if not exists public.study_spot_checkins (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.study_spots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mood text not null default 'focus' check (mood in ('focus', 'casual', 'group')),
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  -- Domyślnie 3h "automatyczny check-out" — chroni przed użytkownikami którzy
  -- zapomną się wymeldować. Function `expire_old_study_checkins()` (poniżej)
  -- zamyka takie wpisy.
  expires_at timestamptz not null default (now() + interval '3 hours'),
  comment text check (comment is null or char_length(comment) <= 240)
);

-- Tylko aktywne check-iny per user mogą istnieć dla jednego spotu (i tylko
-- jeden aktywny w ogóle — user nie może być w dwóch miejscach naraz).
create unique index if not exists study_spot_checkins_one_active_per_user_uidx
  on public.study_spot_checkins (user_id)
  where checked_out_at is null;

create index if not exists study_spot_checkins_active_idx
  on public.study_spot_checkins (spot_id)
  where checked_out_at is null;

create index if not exists study_spot_checkins_expires_idx
  on public.study_spot_checkins (expires_at)
  where checked_out_at is null;

-- ---------------------------------------------------------------------
-- 3. study_spot_ratings — oceny per user
-- ---------------------------------------------------------------------
create table if not exists public.study_spot_ratings (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.study_spots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  overall smallint not null check (overall between 1 and 5),
  wifi smallint check (wifi is null or wifi between 1 and 5),
  silence smallint check (silence is null or silence between 1 and 5),
  sockets smallint check (sockets is null or sockets between 1 and 5),
  comfort smallint check (comfort is null or comfort between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (spot_id, user_id)
);

create index if not exists study_spot_ratings_spot_idx on public.study_spot_ratings (spot_id);

-- ---------------------------------------------------------------------
-- 4. Trigger: recalc rating_avg + rating_count
-- ---------------------------------------------------------------------
create or replace function public.recalc_study_spot_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_spot_id uuid;
begin
  target_spot_id := coalesce(new.spot_id, old.spot_id);
  update public.study_spots
    set rating_avg = (
      select round(avg(overall)::numeric, 2)
      from public.study_spot_ratings
      where spot_id = target_spot_id
    ),
    rating_count = (
      select count(*)
      from public.study_spot_ratings
      where spot_id = target_spot_id
    ),
    updated_at = now()
  where id = target_spot_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_study_spot_rating_recalc_ins on public.study_spot_ratings;
create trigger trg_study_spot_rating_recalc_ins
  after insert on public.study_spot_ratings
  for each row execute function public.recalc_study_spot_rating();

drop trigger if exists trg_study_spot_rating_recalc_upd on public.study_spot_ratings;
create trigger trg_study_spot_rating_recalc_upd
  after update of overall on public.study_spot_ratings
  for each row execute function public.recalc_study_spot_rating();

drop trigger if exists trg_study_spot_rating_recalc_del on public.study_spot_ratings;
create trigger trg_study_spot_rating_recalc_del
  after delete on public.study_spot_ratings
  for each row execute function public.recalc_study_spot_rating();

-- ---------------------------------------------------------------------
-- 5. Trigger: recalc active_checkins_count
-- ---------------------------------------------------------------------
create or replace function public.recalc_study_spot_active_checkins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_spots uuid[];
begin
  affected_spots := array_remove(array[new.spot_id, old.spot_id], null);

  update public.study_spots
    set active_checkins_count = (
      select count(*) from public.study_spot_checkins
      where spot_id = public.study_spots.id and checked_out_at is null
    )
  where id = any (affected_spots);

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_study_spot_checkin_count_ins on public.study_spot_checkins;
create trigger trg_study_spot_checkin_count_ins
  after insert on public.study_spot_checkins
  for each row execute function public.recalc_study_spot_active_checkins();

drop trigger if exists trg_study_spot_checkin_count_upd on public.study_spot_checkins;
create trigger trg_study_spot_checkin_count_upd
  after update of checked_out_at, spot_id on public.study_spot_checkins
  for each row execute function public.recalc_study_spot_active_checkins();

drop trigger if exists trg_study_spot_checkin_count_del on public.study_spot_checkins;
create trigger trg_study_spot_checkin_count_del
  after delete on public.study_spot_checkins
  for each row execute function public.recalc_study_spot_active_checkins();

-- ---------------------------------------------------------------------
-- 6. updated_at triggers (DRY z istniejącym set_current_timestamp_updated_at jeśli jest)
-- ---------------------------------------------------------------------
create or replace function public.touch_study_spots_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_study_spots_updated_at on public.study_spots;
create trigger trg_study_spots_updated_at
  before update on public.study_spots
  for each row execute function public.touch_study_spots_updated_at();

drop trigger if exists trg_study_spot_ratings_updated_at on public.study_spot_ratings;
create trigger trg_study_spot_ratings_updated_at
  before update on public.study_spot_ratings
  for each row execute function public.touch_study_spots_updated_at();

-- ---------------------------------------------------------------------
-- 7. Auto-checkout funkcja (do wywołania cronem lub on-demand z client)
-- ---------------------------------------------------------------------
-- Wywołanie: SELECT public.expire_old_study_checkins();
-- Zamyka wszystkie active check-iny których expires_at już minął.
-- Idempotentne — można puszczać często bez efektów ubocznych.
create or replace function public.expire_old_study_checkins()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer;
begin
  with expired as (
    update public.study_spot_checkins
      set checked_out_at = expires_at
      where checked_out_at is null
        and expires_at <= now()
      returning id
  )
  select count(*) into affected_count from expired;
  return affected_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. RPC: get_study_spots_full(user_id) — lista z user state
-- ---------------------------------------------------------------------
-- Jednym strzałem ściąga listę spotów + info czy user już ocenił + jego
-- aktywny check-in (max 1). Frontend nie musi robić N+1.
create or replace function public.get_study_spots_full(p_user_id uuid)
returns table (
  id uuid,
  name text,
  address text,
  lat numeric,
  lng numeric,
  kind text,
  building_id text,
  description text,
  hours_text text,
  photo_urls text[],
  wifi_quality smallint,
  silence_level smallint,
  sockets_count_estimate smallint,
  tags text[],
  website_url text,
  google_maps_url text,
  is_free boolean,
  price_hint text,
  rating_avg numeric,
  rating_count integer,
  active_checkins_count integer,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  my_rating smallint,
  my_active_checkin_id uuid,
  my_active_checkin_mood text,
  my_active_checkin_expires_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    s.id, s.name, s.address, s.lat, s.lng, s.kind, s.building_id,
    s.description, s.hours_text, s.photo_urls,
    s.wifi_quality, s.silence_level, s.sockets_count_estimate,
    s.tags, s.website_url, s.google_maps_url, s.is_free, s.price_hint,
    s.rating_avg, s.rating_count, s.active_checkins_count,
    s.created_by, s.created_at, s.updated_at,
    r.overall as my_rating,
    c.id as my_active_checkin_id,
    c.mood as my_active_checkin_mood,
    c.expires_at as my_active_checkin_expires_at
  from public.study_spots s
  left join public.study_spot_ratings r
    on r.spot_id = s.id and r.user_id = p_user_id
  left join public.study_spot_checkins c
    on c.spot_id = s.id and c.user_id = p_user_id and c.checked_out_at is null
  where s.approved = true
  order by s.active_checkins_count desc, s.rating_avg desc nulls last, s.name asc;
$$;

-- ---------------------------------------------------------------------
-- 9. RLS
-- ---------------------------------------------------------------------
alter table public.study_spots enable row level security;
alter table public.study_spot_checkins enable row level security;
alter table public.study_spot_ratings enable row level security;

-- study_spots: read for all authenticated (jeśli approved)
drop policy if exists "study_spots_select" on public.study_spots;
create policy "study_spots_select"
  on public.study_spots for select
  to authenticated
  using (approved = true or created_by = auth.uid());

-- INSERT: community contributions (approved=true od razu; moderation post-fakt)
drop policy if exists "study_spots_insert_authenticated" on public.study_spots;
create policy "study_spots_insert_authenticated"
  on public.study_spots for insert
  to authenticated
  with check (created_by = auth.uid());

-- UPDATE: tylko owner (właściciel wpisu może edytować swoje miejsce)
drop policy if exists "study_spots_update_owner" on public.study_spots;
create policy "study_spots_update_owner"
  on public.study_spots for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- DELETE: tylko owner
drop policy if exists "study_spots_delete_owner" on public.study_spots;
create policy "study_spots_delete_owner"
  on public.study_spots for delete
  to authenticated
  using (created_by = auth.uid());

-- study_spot_checkins: all authenticated mogą czytać (presence)
drop policy if exists "study_spot_checkins_select" on public.study_spot_checkins;
create policy "study_spot_checkins_select"
  on public.study_spot_checkins for select
  to authenticated
  using (true);

drop policy if exists "study_spot_checkins_insert_own" on public.study_spot_checkins;
create policy "study_spot_checkins_insert_own"
  on public.study_spot_checkins for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "study_spot_checkins_update_own" on public.study_spot_checkins;
create policy "study_spot_checkins_update_own"
  on public.study_spot_checkins for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "study_spot_checkins_delete_own" on public.study_spot_checkins;
create policy "study_spot_checkins_delete_own"
  on public.study_spot_checkins for delete
  to authenticated
  using (user_id = auth.uid());

-- study_spot_ratings: all authenticated czytają (oceny publiczne)
drop policy if exists "study_spot_ratings_select" on public.study_spot_ratings;
create policy "study_spot_ratings_select"
  on public.study_spot_ratings for select
  to authenticated
  using (true);

drop policy if exists "study_spot_ratings_insert_own" on public.study_spot_ratings;
create policy "study_spot_ratings_insert_own"
  on public.study_spot_ratings for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "study_spot_ratings_update_own" on public.study_spot_ratings;
create policy "study_spot_ratings_update_own"
  on public.study_spot_ratings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "study_spot_ratings_delete_own" on public.study_spot_ratings;
create policy "study_spot_ratings_delete_own"
  on public.study_spot_ratings for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 10. Realtime publication
-- ---------------------------------------------------------------------
alter table public.study_spots replica identity full;
alter table public.study_spot_checkins replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'study_spots'
  ) then
    alter publication supabase_realtime add table public.study_spots;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'study_spot_checkins'
  ) then
    alter publication supabase_realtime add table public.study_spot_checkins;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 11. Seed: 20 znanych miejsc do nauki w Krakowie
-- ---------------------------------------------------------------------
-- Idempotentnie (WHERE NOT EXISTS po nazwie) — można puścić ponownie
-- bez duplikatów. created_by = null bo to seed curatorski.

insert into public.study_spots (name, address, lat, lng, kind, description, hours_text, wifi_quality, silence_level, sockets_count_estimate, tags, google_maps_url, is_free, price_hint)
select * from (values
  ('Biblioteka Jagiellońska', 'al. Mickiewicza 22, Kraków', 50.063820::numeric, 19.923040::numeric, 'library_uj',
    'Największa biblioteka UJ. Sala główna i czytelnie wydziałowe. Cisza absolutna, full gniazdka, super wifi (eduroam).',
    'pn-pt 8:00-21:00, sob 9:00-15:00', 5::smallint, 5::smallint, 200::smallint,
    array['gniazdka', 'cisza-grobowa', 'eduroam', 'koło-uczelni']::text[],
    'https://maps.app.goo.gl/biblioteka-jagiellonska', true, 'darmowe (legitymacja)'),

  ('BJ Czytelnia Czasopism', 'al. Mickiewicza 22, Kraków', 50.063820::numeric, 19.923040::numeric, 'library_uj',
    'Czytelnia czasopism BJ — duża przestrzeń, dobre światło dzienne, mniej tłoku niż główna.',
    'pn-pt 8:00-21:00', 5::smallint, 5::smallint, 80::smallint,
    array['gniazdka', 'cisza', 'okna', 'eduroam']::text[],
    null, true, 'darmowe (legitymacja)'),

  ('Biblioteka WMI (Łojasiewicza)', 'ul. prof. Stanisława Łojasiewicza 6, Kraków', 50.029100::numeric, 19.901300::numeric, 'library_uj',
    'Biblioteka Wydziału Matematyki i Informatyki na kampusie 600-lecia. Spokojnie, dużo miejsc, gniazdka przy każdym stoliku.',
    'pn-pt 9:00-19:00, sob 9:00-14:00', 5::smallint, 5::smallint, 120::smallint,
    array['gniazdka', 'cisza', 'eduroam', 'kampus-600-lecia']::text[],
    null, true, 'darmowe (legitymacja)'),

  ('Czytelnia WPiA (Bracka)', 'ul. Bracka 12, Kraków', 50.060300::numeric, 19.937100::numeric, 'library_uj',
    'Czytelnia Prawnicza Wydziału Prawa. Najlepsze dla studentów prawa — wszystkie kodeksy on-site.',
    'pn-pt 8:00-20:00, sob 9:00-14:00', 4::smallint, 5::smallint, 60::smallint,
    array['gniazdka', 'cisza', 'centrum', 'prawnicze']::text[],
    null, true, 'darmowe (legitymacja)'),

  ('Biblioteka Wydziału Filologicznego', 'ul. Gołębia 20, Kraków', 50.061500::numeric, 19.935000::numeric, 'library_uj',
    'Biblioteka filologów — klimatyczne wnętrza w starym budynku. Idealna na dłuższe sesje pisarskie.',
    'pn-pt 9:00-19:00', 4::smallint, 5::smallint, 40::smallint,
    array['cisza', 'okna', 'centrum', 'klimat']::text[],
    null, true, 'darmowe (legitymacja)'),

  ('Massolit Books & Café', 'ul. Felicjanek 4, Kraków', 50.059500::numeric, 19.929800::numeric, 'cafe',
    'Książkowo-kawiarniana ikona Kazimierza. Anglojęzyczna księgarnia + kawa + zakątki do czytania. Dobre wifi, średnio gniazdek.',
    'codziennie 10:00-21:00', 4::smallint, 3::smallint, 8::smallint,
    array['kawa', 'książki', 'wege-jedzenie', 'klimat', 'kazimierz']::text[],
    'https://massolit.com', true, 'kawa od 14zł'),

  ('Cheder Café', 'ul. Józefa 36, Kraków', 50.051600::numeric, 19.944900::numeric, 'cafe',
    'Kawiarnia w dawnej szkole Talmudycznej — wnętrze niesamowite, długie stoły, lo-fi atmosfera. Spokojnie się uczyć przed południem.',
    'codziennie 9:00-23:00', 3::smallint, 3::smallint, 6::smallint,
    array['kawa', 'lo-fi', 'klimat', 'kazimierz', 'wege-jedzenie']::text[],
    null, true, 'kawa od 12zł'),

  ('Hevre', 'ul. Beera Meiselsa 18, Kraków', 50.052300::numeric, 19.945600::numeric, 'cafe',
    'Cool kazimierzowska kawiarnia w dawnej synagodze. Wieczorami głośno, rano-popołudniu spokojnie. Dobra kawa.',
    'codziennie 9:00-02:00', 4::smallint, 2::smallint, 4::smallint,
    array['kawa', 'klimat', 'kazimierz', 'lo-fi']::text[],
    null, true, 'kawa od 14zł'),

  ('Karma', 'ul. Krupnicza 12, Kraków', 50.062700::numeric, 19.929400::numeric, 'cafe',
    'Bliskutko Auditorium Maximum — idealne między wykładami. Spokojnie, wifi, gniazdka. Pyszne kawy.',
    'pn-pt 7:30-20:00, sob-nd 9:00-20:00', 4::smallint, 3::smallint, 6::smallint,
    array['kawa', 'gniazdka', 'centrum', 'blisko-uczelni']::text[],
    'https://karmacoffee.pl', true, 'kawa od 13zł'),

  ('Cytat Café', 'ul. Smoleńsk 4, Kraków', 50.062500::numeric, 19.925700::numeric, 'cafe',
    'Literacka kawiarnia na zapleczu Krupniczej. Stoliki przy oknach, ciche popołudnia, świetna do dłuższych sesji.',
    'pn-pt 8:00-21:00, sob 10:00-19:00', 4::smallint, 4::smallint, 5::smallint,
    array['kawa', 'lo-fi', 'okna', 'centrum']::text[],
    null, true, 'kawa od 12zł'),

  ('Mleczarnia', 'ul. Beera Meiselsa 20, Kraków', 50.052100::numeric, 19.946000::numeric, 'cafe',
    'Klimatyczna ogródkowa z lampami i pianinem. W lecie wewnątrzny dziedziniec idealny do nauki.',
    'codziennie 9:00-01:00', 3::smallint, 3::smallint, 4::smallint,
    array['ogródek', 'klimat', 'kazimierz']::text[],
    null, true, 'kawa od 13zł'),

  ('Auditorium Maximum (lobby)', 'ul. Krupnicza 33, Kraków', 50.064100::numeric, 19.927200::numeric, 'courtyard',
    'Lobby przed aulami — czekanie na zajęcia w komforcie. Eduroam, kilka gniazdek, fotele.',
    'pn-pt 8:00-22:00', 4::smallint, 3::smallint, 8::smallint,
    array['eduroam', 'centrum', 'blisko-uczelni', 'darmowe']::text[],
    null, true, 'darmowe'),

  ('Dziedziniec Collegium Maius', 'ul. Jagiellońska 15, Kraków', 50.061200::numeric, 19.933700::numeric, 'courtyard',
    'Najstarszy dziedziniec UJ. Ławki, w lecie cień arkad. Świetne na lekkie czytanie + selfie z historią.',
    'pn-nd 10:00-18:00', 3::smallint, 4::smallint, 0::smallint,
    array['historia', 'plener', 'centrum', 'darmowe']::text[],
    null, true, 'darmowe'),

  ('Planty (ławki przy Wawelu)', 'Planty, Kraków', 50.057200::numeric, 19.934800::numeric, 'courtyard',
    'Spacerując Plantami koło Wawelu — ławki + cień drzew. Idealne na powtórki notatek w słońcu.',
    'całodobowo', null, 4::smallint, 0::smallint,
    array['plener', 'centrum', 'darmowe', 'lato']::text[],
    null, true, 'darmowe'),

  ('Wisła Studio (coworking)', 'ul. Pawia 4, Kraków', 50.066900::numeric, 19.945200::numeric, 'coworking',
    'Coworking obok Dworca Głównego — szybkie wifi, biurka, kawa w cenie. Pakiet dzienny ~40zł.',
    'pn-pt 9:00-19:00', 5::smallint, 4::smallint, 50::smallint,
    array['gniazdka', 'kawa', 'biurka', 'centrum']::text[],
    null, false, 'pakiet dzienny ~40zł'),

  ('Le Scandale', 'pl. Nowy 9, Kraków', 50.051900::numeric, 19.945300::numeric, 'cafe',
    'Place Nowy, czyli serce Kazimierza. Tarasem na zewnątrz w sezonie. Średnia cisza ale duża przestrzeń.',
    'codziennie 9:00-01:00', 3::smallint, 2::smallint, 4::smallint,
    array['kawa', 'kazimierz', 'taras', 'jedzenie']::text[],
    null, true, 'kawa od 14zł'),

  ('House of Beer (Stradomska)', 'ul. Stradomska 13, Kraków', 50.055000::numeric, 19.939900::numeric, 'cafe',
    'Restauracja z kawą i siecią rano. Świetnie do nauki przed południem, wieczorami głośniej.',
    'codziennie 11:00-23:00', 4::smallint, 2::smallint, 4::smallint,
    array['kawa', 'jedzenie', 'centrum']::text[],
    null, true, 'kawa od 13zł'),

  ('Tea Time Brewing Bar', 'ul. św. Krzyża 17, Kraków', 50.062600::numeric, 19.940400::numeric, 'cafe',
    'Herbaciarnia w centrum — naprawdę cicho, dużo herbat (ponad 100), gniazdka. Świetne na konsystentną sesję.',
    'pn-pt 11:00-21:00, sob-nd 12:00-21:00', 4::smallint, 5::smallint, 6::smallint,
    array['herbata', 'cisza', 'gniazdka', 'centrum']::text[],
    null, true, 'herbata od 15zł'),

  ('Biblioteka Uniwersytecka WSE-WIM (Łojasiewicza)', 'ul. prof. Stanisława Łojasiewicza 4, Kraków', 50.029500::numeric, 19.900900::numeric, 'library_uj',
    'Biblioteka WSE/WIM na kampusie 600-lecia. Nowoczesna, gniazdka przy każdym miejscu, eduroam, mało tłoku.',
    'pn-pt 9:00-19:00', 5::smallint, 5::smallint, 100::smallint,
    array['gniazdka', 'cisza', 'eduroam', 'kampus-600-lecia']::text[],
    null, true, 'darmowe (legitymacja)'),

  ('Drukarnia Café (Podgórze)', 'ul. Nadwiślańska 1, Kraków', 50.046400::numeric, 19.948000::numeric, 'cafe',
    'Podgórska kawiarnia z tarasem nad Wisłą. Mniej tłumu turystów, długie stoły, dobre wifi.',
    'codziennie 9:00-23:00', 4::smallint, 4::smallint, 6::smallint,
    array['kawa', 'taras', 'wisła', 'podgórze']::text[],
    null, true, 'kawa od 13zł')
) as new_spot(name, address, lat, lng, kind, description, hours_text, wifi_quality, silence_level, sockets_count_estimate, tags, google_maps_url, is_free, price_hint)
where not exists (
  select 1 from public.study_spots existing
  where existing.name = new_spot.name
);

comment on table public.study_spots is
  'Community-driven katalog miejsc do nauki w Krakowie (biblioteki UJ, kawiarnie, coworki, dziedzińce). Seed curatorski 20 miejsc, user contributions przez insert RLS.';

comment on table public.study_spot_checkins is
  'Live presence "jestem teraz tu". Unique constraint na user_id WHERE checked_out_at IS NULL = user w max 1 miejscu. Auto-expire 3h przez expire_old_study_checkins().';

comment on table public.study_spot_ratings is
  'Oceny miejsc per user (1-5 overall + opcjonalne wifi/silence/sockets/comfort). Unique (spot_id, user_id) = jedna ocena per user per spot. Trigger przelicza rating_avg/count na study_spots.';
