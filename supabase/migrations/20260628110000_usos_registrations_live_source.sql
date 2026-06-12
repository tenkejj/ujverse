-- =====================================================================
-- UJverse — USOS Registrations: LIVE source z USOSweb katalogu rejestracji
-- =====================================================================
-- Discovery: USOSweb publikuje publicznie (bez logowania) pełny katalog
-- rejestracji per jednostka:
--   https://www.usosweb.uj.edu.pl/kontroler.php?_action=news/rejestracje/rejJednostki&jed_org_kod=UJ.WF.IFA
--
-- Każda tura ma stable `tura_id` (np. 45118) i strukturalne dane czasowe.
-- To jest jakościowo lepsze źródło niż AI extraction z ogłoszeń ISI
-- (które są w ~99% o odwołanych zajęciach, nie o rejestracjach).
--
-- Strategia:
--   1. Scraper `api/scrape-usos-registrations.ts` parsuje cheerio'em
--      każdą jednostkę z listy → upsert do `usos_registrations`
--   2. ON CONFLICT (source_usos_tura_id) UPDATE — daty mogą się zmieniać
--      (USOSweb pozwala adminom przesuwać tury), więc refresh codzienny
--   3. UI badge "Live · USOSweb" zamiast/obok "AI"
--   4. AI extractor zostaje jako fallback dla wpisów z ogłoszeń (rzadkie
--      ale możliwe — np. ogłoszenie wydziału o nadzwyczajnej rejestracji)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. source_usos_tura_id + source_unit_code
-- ---------------------------------------------------------------------
alter table public.usos_registrations
  add column if not exists source_usos_tura_id text;

alter table public.usos_registrations
  add column if not exists source_unit_code text
    check (source_unit_code is null or char_length(source_unit_code) <= 50);

comment on column public.usos_registrations.source_usos_tura_id is
  'tura_id z USOSweb katalogu rejestracji (np. "45118"). UNIQUE — zapewnia idempotencję scrapera (re-run aktualizuje istniejący wpis). NULL = wpis community/seed/AI.';

comment on column public.usos_registrations.source_unit_code is
  'Kod jednostki organizacyjnej UJ z USOSweb (np. "UJ.WF.IFA" = Instytut Filologii Angielskiej). Pomocnicze do filtrowania per wydział oraz UI breadcrumb.';

-- UNIQUE: jedna tura USOSweb = max jeden wpis. Partial żeby NULL-e
-- nie kolidowały dla wpisów community/seed/AI.
create unique index if not exists usos_registrations_source_tura_uidx
  on public.usos_registrations (source_usos_tura_id)
  where source_usos_tura_id is not null;

create index if not exists usos_registrations_source_unit_idx
  on public.usos_registrations (source_unit_code)
  where source_unit_code is not null;

-- ---------------------------------------------------------------------
-- 2. Audit log: kiedy ostatnio scraper przeleciał daną jednostkę
-- ---------------------------------------------------------------------
-- Mała tabela do trackowania rate-limit'u i health-checków cron'a.
-- Pomaga debugować "czemu jednostka X nie była aktualizowana".
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

-- Tylko service_role może czytać/pisać — admin debug only
-- (anon/auth nie potrzebują tych logów; gdyby kiedyś trzeba je
-- pokazać w UI to dodamy policy admin-read).
