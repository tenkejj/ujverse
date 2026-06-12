-- =====================================================================
-- UJverse — Couponek UJ (zniżki studenckie w Krakowie)
-- =====================================================================
-- Migracja wprowadza:
--   • student_discounts            — główny katalog zniżek
--   • student_discount_uses        — track "wziąłem!" per-user (anti-dup)
--   • student_discount_reviews     — 1-5 gwiazdek + komentarz
--   • student_discount_reports     — zgłoszenia "nie działa/zmienione"
--
-- Konwencje:
--   • Wszystkie tabele mają RLS ENABLED. Read = `authenticated`.
--   • Mutacje:
--       - INSERT zniżki → każdy zalogowany (community-driven).
--       - UPDATE/DELETE → tylko `created_by` lub admin (`is_profile_admin()`).
--       - Reviews/uses/reports → tylko własne rekordy.
--   • Snapshot agregaty (`use_count`, `avg_rating`, `review_count`) trzymamy
--     w głównej tabeli przez triggery, żeby uniknąć N+1 w UI.
--   • `category` jest STRING enum (CHECK), nie osobna tabela — kategorie
--     są fixed-set, w razie potrzeby dodajemy w kolejnej migracji.
--   • Geolokalizacja jako (lat, lng) DOUBLE PRECISION — pełen PostGIS
--     przesada dla MVP, JS-side haversine wystarcza dla ≤5000 wpisów.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. student_discounts — główny katalog
-- ---------------------------------------------------------------------
create table if not exists public.student_discounts (
  id uuid primary key default gen_random_uuid(),
  /* `created_by` jest NULLABLE bo: (a) seed wpisy wstawiamy bez autora,
     (b) `on delete set null` przy usunięciu profilu zostawia historyczne
     rekordy. WITH CHECK w policy INSERT wymusza `created_by = auth.uid()`
     dla zwykłych userów, więc nie da się obejść autorstwa. */
  created_by uuid references public.profiles(id) on delete set null,

  -- Podstawowe info
  business_name text not null check (char_length(business_name) between 2 and 80),
  -- "krótki nagłówek zniżki" — wyświetlany jako headline w karcie
  discount_headline text not null check (char_length(discount_headline) between 3 and 120),
  -- pełen opis (warunki, ograniczenia)
  description text check (description is null or char_length(description) <= 1000),

  category text not null check (category in (
    'jedzenie',
    'kawa',
    'kultura',
    'kino',
    'sport',
    'ksiazki',
    'uslugi',
    'transport',
    'odziez',
    'inne'
  )),

  -- Lokalizacja
  address text check (address is null or char_length(address) <= 200),
  city text not null default 'Kraków' check (char_length(city) <= 60),
  lat double precision check (lat is null or (lat between -90 and 90)),
  lng double precision check (lng is null or (lng between -180 and 180)),

  -- Kontakt / weryfikacja
  website_url text check (website_url is null or char_length(website_url) <= 400),
  source_url text check (source_url is null or char_length(source_url) <= 400),
  /* `verified_at` = manualnie zweryfikowane przez admina lub źródło
     oficjalne. UI pokazuje znaczek "potwierdzone". */
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,

  -- Wymagania (czego user musi mieć żeby skorzystać)
  /* `requires_uj_id` = true (default) — domyślnie wszystkie zakładamy że
     wymagają legitymacji UJ; false dla zniżek student-uniwersalnych. */
  requires_uj_id boolean not null default true,
  /* opcjonalna data ważności — null = bezterminowo */
  valid_until date,

  -- Snapshot agregaty (utrzymywane triggerami)
  use_count integer not null default 0 check (use_count >= 0),
  review_count integer not null default 0 check (review_count >= 0),
  /* avg_rating ∈ [1,5] gdy review_count>0, NULL gdy brak ocen */
  avg_rating numeric(2,1) check (avg_rating is null or (avg_rating between 1 and 5)),
  report_count integer not null default 0 check (report_count >= 0),

  -- Soft delete + moderacja
  hidden_at timestamptz,
  hidden_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_discounts_category
  on public.student_discounts(category)
  where hidden_at is null;

create index if not exists idx_student_discounts_use_count
  on public.student_discounts(use_count desc, created_at desc)
  where hidden_at is null;

create index if not exists idx_student_discounts_created_at
  on public.student_discounts(created_at desc)
  where hidden_at is null;

-- Trigger: updated_at
create or replace function public.tg_student_discounts_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_student_discounts_touch on public.student_discounts;
create trigger trg_student_discounts_touch
  before update on public.student_discounts
  for each row execute function public.tg_student_discounts_touch();

-- ---------------------------------------------------------------------
-- 2. student_discount_uses — kto wziął zniżkę (1 use per user per discount)
-- ---------------------------------------------------------------------
create table if not exists public.student_discount_uses (
  discount_id uuid not null references public.student_discounts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  used_at timestamptz not null default now(),
  primary key (discount_id, user_id)
);

create index if not exists idx_discount_uses_user
  on public.student_discount_uses(user_id, used_at desc);

create index if not exists idx_discount_uses_recent
  on public.student_discount_uses(used_at desc);

-- ---------------------------------------------------------------------
-- 3. student_discount_reviews — gwiazdki + komentarz (1 per user per discount)
-- ---------------------------------------------------------------------
create table if not exists public.student_discount_reviews (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.student_discounts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (discount_id, user_id)
);

create index if not exists idx_discount_reviews_discount
  on public.student_discount_reviews(discount_id, created_at desc);

create or replace function public.tg_student_discount_reviews_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_discount_reviews_touch on public.student_discount_reviews;
create trigger trg_discount_reviews_touch
  before update on public.student_discount_reviews
  for each row execute function public.tg_student_discount_reviews_touch();

-- ---------------------------------------------------------------------
-- 4. student_discount_reports — "nie działa / zmienione warunki"
-- ---------------------------------------------------------------------
create table if not exists public.student_discount_reports (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.student_discounts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in (
    'nie_dziala',
    'zmienione_warunki',
    'zamkniete',
    'spam',
    'inne'
  )),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_discount_reports_discount
  on public.student_discount_reports(discount_id, created_at desc);

-- ---------------------------------------------------------------------
-- 5. Triggery agregatów — utrzymują snapshot w student_discounts
-- ---------------------------------------------------------------------

-- use_count
create or replace function public.tg_recalc_discount_use_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discount_id uuid := coalesce(new.discount_id, old.discount_id);
begin
  update public.student_discounts
     set use_count = (
       select count(*) from public.student_discount_uses where discount_id = v_discount_id
     )
   where id = v_discount_id;
  return null;
end;
$$;

drop trigger if exists trg_discount_uses_after on public.student_discount_uses;
create trigger trg_discount_uses_after
  after insert or delete on public.student_discount_uses
  for each row execute function public.tg_recalc_discount_use_count();

-- review_count + avg_rating
create or replace function public.tg_recalc_discount_reviews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discount_id uuid := coalesce(new.discount_id, old.discount_id);
  v_count int;
  v_avg numeric(2,1);
begin
  select count(*),
         case when count(*) > 0
              then round(avg(rating)::numeric, 1)
              else null end
    into v_count, v_avg
    from public.student_discount_reviews
   where discount_id = v_discount_id;

  update public.student_discounts
     set review_count = v_count,
         avg_rating = v_avg
   where id = v_discount_id;
  return null;
end;
$$;

drop trigger if exists trg_discount_reviews_after on public.student_discount_reviews;
create trigger trg_discount_reviews_after
  after insert or update or delete on public.student_discount_reviews
  for each row execute function public.tg_recalc_discount_reviews();

-- report_count
create or replace function public.tg_recalc_discount_report_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discount_id uuid := coalesce(new.discount_id, old.discount_id);
begin
  update public.student_discounts
     set report_count = (
       select count(*) from public.student_discount_reports where discount_id = v_discount_id
     )
   where id = v_discount_id;
  return null;
end;
$$;

drop trigger if exists trg_discount_reports_after on public.student_discount_reports;
create trigger trg_discount_reports_after
  after insert or delete on public.student_discount_reports
  for each row execute function public.tg_recalc_discount_report_count();

-- ---------------------------------------------------------------------
-- 6. RPC: mark_discount_use — idempotentny "wziąłem!" + zwraca nowy count
-- ---------------------------------------------------------------------
create or replace function public.mark_discount_use(p_discount_id uuid)
returns table (use_count integer, already_used boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_was_present boolean;
begin
  if v_user_id is null then
    raise exception 'auth required';
  end if;

  -- sprawdź czy już użyte
  select exists(
    select 1 from public.student_discount_uses
     where discount_id = p_discount_id and user_id = v_user_id
  ) into v_was_present;

  if not v_was_present then
    insert into public.student_discount_uses(discount_id, user_id)
    values (p_discount_id, v_user_id);
  end if;

  return query
    select sd.use_count, v_was_present
      from public.student_discounts sd
     where sd.id = p_discount_id;
end;
$$;

grant execute on function public.mark_discount_use(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. RPC: trending_discounts — top N w ostatnich 7 dniach
-- ---------------------------------------------------------------------
create or replace function public.trending_discounts(p_limit int default 5)
returns table (
  discount_id uuid,
  recent_uses bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select u.discount_id, count(*)::bigint as recent_uses
    from public.student_discount_uses u
    join public.student_discounts d on d.id = u.discount_id
   where u.used_at >= now() - interval '7 days'
     and d.hidden_at is null
   group by u.discount_id
   order by recent_uses desc, max(u.used_at) desc
   limit greatest(p_limit, 1);
$$;

grant execute on function public.trending_discounts(int) to authenticated;

-- ---------------------------------------------------------------------
-- 8. RLS — Read all authenticated, write własne lub admin
-- ---------------------------------------------------------------------

alter table public.student_discounts enable row level security;
alter table public.student_discount_uses enable row level security;
alter table public.student_discount_reviews enable row level security;
alter table public.student_discount_reports enable row level security;

-- student_discounts
drop policy if exists discounts_select_auth on public.student_discounts;
create policy discounts_select_auth
  on public.student_discounts
  for select
  to authenticated
  using (hidden_at is null or created_by = auth.uid() or public.is_profile_admin());

drop policy if exists discounts_insert_self on public.student_discounts;
create policy discounts_insert_self
  on public.student_discounts
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists discounts_update_owner on public.student_discounts;
create policy discounts_update_owner
  on public.student_discounts
  for update
  to authenticated
  using (created_by = auth.uid() or public.is_profile_admin())
  with check (created_by = auth.uid() or public.is_profile_admin());

drop policy if exists discounts_delete_owner on public.student_discounts;
create policy discounts_delete_owner
  on public.student_discounts
  for delete
  to authenticated
  using (created_by = auth.uid() or public.is_profile_admin());

-- student_discount_uses
drop policy if exists discount_uses_select_auth on public.student_discount_uses;
create policy discount_uses_select_auth
  on public.student_discount_uses
  for select
  to authenticated
  using (true);

drop policy if exists discount_uses_insert_self on public.student_discount_uses;
create policy discount_uses_insert_self
  on public.student_discount_uses
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists discount_uses_delete_self on public.student_discount_uses;
create policy discount_uses_delete_self
  on public.student_discount_uses
  for delete
  to authenticated
  using (user_id = auth.uid());

-- student_discount_reviews
drop policy if exists discount_reviews_select_auth on public.student_discount_reviews;
create policy discount_reviews_select_auth
  on public.student_discount_reviews
  for select
  to authenticated
  using (true);

drop policy if exists discount_reviews_insert_self on public.student_discount_reviews;
create policy discount_reviews_insert_self
  on public.student_discount_reviews
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists discount_reviews_update_self on public.student_discount_reviews;
create policy discount_reviews_update_self
  on public.student_discount_reviews
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists discount_reviews_delete_self on public.student_discount_reviews;
create policy discount_reviews_delete_self
  on public.student_discount_reviews
  for delete
  to authenticated
  using (user_id = auth.uid() or public.is_profile_admin());

-- student_discount_reports
drop policy if exists discount_reports_select_auth on public.student_discount_reports;
create policy discount_reports_select_auth
  on public.student_discount_reports
  for select
  to authenticated
  using (true);

drop policy if exists discount_reports_insert_self on public.student_discount_reports;
create policy discount_reports_insert_self
  on public.student_discount_reports
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists discount_reports_delete_self on public.student_discount_reports;
create policy discount_reports_delete_self
  on public.student_discount_reports
  for delete
  to authenticated
  using (user_id = auth.uid() or public.is_profile_admin());

-- ---------------------------------------------------------------------
-- 9. Realtime — publikacja zmian dla "Trending" + nowych
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.student_discounts;
alter publication supabase_realtime add table public.student_discount_uses;

commit;
