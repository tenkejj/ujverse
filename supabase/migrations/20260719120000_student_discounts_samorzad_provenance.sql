-- =====================================================================
-- Couponek UJ — provenance Samorząd vs seed vs community
-- =====================================================================
-- Scraper `api/scrape-discounts.ts` od teraz upsertuje listę Samorządu UJ
-- z `verified_at = now()` i `source_url` wskazującym na samorzad.uj.edu.pl.
-- Seed bez oficjalnego źródła nie powinien dalej nosić badge'a
-- „potwierdzone" — UI pokazuje „Nieoficjalne" aż scraper (lub student)
-- pokryje wpis.
--
-- Community (`created_by IS NOT NULL`) nie ruszamy.
-- =====================================================================

-- Soft-demote seed / stare scraperowe wpisy bez źródła Samorządu.
update public.student_discounts
set
  verified_at = null,
  verified_by = null,
  updated_at = now()
where created_by is null
  and (
    source_url is null
    or source_url !~* 'samorzad\.uj\.edu\.pl'
  )
  and verified_at is not null;

comment on column public.student_discounts.source_url is
  'URL źródła oferty. Dla scrapera Samorządu UJ: https://samorzad.uj.edu.pl/znizki (lub deep-link). UI: Samorząd gdy host pasuje i created_by IS NULL.';

comment on column public.student_discounts.verified_at is
  'Timestamp weryfikacji. Scraper Samorządu ustawia automatycznie. Seed bez source_url Samorządu ma NULL → UI „Nieoficjalne".';
