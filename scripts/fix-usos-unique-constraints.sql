-- =====================================================================
-- UJverse — FIX: partial unique index → full unique index
-- =====================================================================
-- Problem: scraper /api/scrape-usos-registrations dostaje:
--   "there is no unique or exclusion constraint matching the
--    ON CONFLICT specification"
--
-- Przyczyna: indexy `usos_registrations_source_tura_uidx` oraz
-- `usos_registrations_source_announcement_uidx` są PARTIAL (`WHERE col
-- IS NOT NULL`). Postgres do `ON CONFLICT (col)` bez WHERE w insercie
-- nie potrafi udowodnić że partial index pokrywa zbiór wierszy — więc
-- odrzuca matching.
--
-- Fix: rebuild bez WHERE. Wielokrotne NULL-e wciąż dozwolone (PG
-- standard: NULL ≠ NULL w unique constraint), więc community/seed
-- wpisy bez tura_id / announcement_id się nie złamią.
--
-- INSTRUKCJA: wklej do Supabase SQL Editor i Run.
--   https://supabase.com/dashboard/project/ucoymhbhzdizpkenscdg/sql/new
-- =====================================================================

-- source_usos_tura_id (LIVE scraper z USOSweb)
drop index if exists public.usos_registrations_source_tura_uidx;
create unique index usos_registrations_source_tura_uidx
  on public.usos_registrations (source_usos_tura_id);

-- source_announcement_id (AI extractor z ogłoszeń wydziałowych)
drop index if exists public.usos_registrations_source_announcement_uidx;
create unique index usos_registrations_source_announcement_uidx
  on public.usos_registrations (source_announcement_id);

-- Weryfikacja (powinno zwrócić 2 wiersze, predicate=null):
-- select indexname, indexdef from pg_indexes
-- where tablename = 'usos_registrations'
--   and indexname like '%source_%';
