-- =====================================================================
-- UJverse — FIX: partial → full unique index na source_* kolumnach
-- =====================================================================
-- Naprawa bugu wykrytego po deploy `feat(usos): LIVE scraper rejestracji`:
-- scraper `/api/scrape-usos-registrations` używa
--   .upsert(rows, { onConflict: 'source_usos_tura_id' })
-- i Postgres rzucał:
--   "there is no unique or exclusion constraint matching the
--    ON CONFLICT specification"
--
-- Przyczyna: oryginalne indexy z migracji 20260628100000 i 20260628110000
-- były PARTIAL (`WHERE col IS NOT NULL`). PG nie potrafi związać partial
-- index'a z `ON CONFLICT (col)` bez identycznej WHERE w insercie (whose
-- predicate must logically imply index predicate). Scraper nie wysyła
-- inference WHERE → match fails → upsert wybucha.
--
-- Fix: rebuild bez WHERE. NULL-e wciąż dozwolone, bo PG traktuje wiele
-- NULL jako różne w unique constraint (default, bez `NULLS NOT DISTINCT`).
-- Czyli community/seed wpisy z NULL-em w source_* dalej działają.
--
-- DROP + CREATE jest bezpieczny — żaden inny FK ani trigger na te
-- indexy nie wisi.
-- =====================================================================

drop index if exists public.usos_registrations_source_tura_uidx;
create unique index usos_registrations_source_tura_uidx
  on public.usos_registrations (source_usos_tura_id);

drop index if exists public.usos_registrations_source_announcement_uidx;
create unique index usos_registrations_source_announcement_uidx
  on public.usos_registrations (source_announcement_id);
