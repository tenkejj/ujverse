-- AI TL;DR komunikatów (Bielik): jedno zdanie streszczenia per komunikat.
--
-- Rozszerza wątek rozpoczęty w 20260621100000_calendar_entries.sql:
-- ten sam pass Bielika który wyciąga `extracted_calendar` zwraca też
-- `summary` (1 zdanie po polsku, ≤ ~200 znaków). Scraper zapisuje oba
-- pola jednocześnie, `extraction_attempted_at` dalej jest źródłem
-- prawdy „czy już próbowano ekstrakcji".
--
-- Świadomie OSOBNA kolumna `summary` (nie JSONB w `extracted_calendar`)
-- żeby:
--   * uniknąć modyfikacji triggera `sync_calendar_from_announcement`
--     (chronimy istniejący kontrakt z kalendarzem),
--   * search Meili mógł indeksować streszczenie wprost (text column,
--     bez parsowania JSON-a po naszej stronie),
--   * UI mógł zrobić `select summary` bez ściągania całego JSON-a
--     z extracted_calendar.

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS summary TEXT;

COMMENT ON COLUMN public.announcements.summary IS
  'Bielik TL;DR (1 zdanie pl-PL, ≤ ~200 znaków). NULL = ekstrakcja nie wygenerowała streszczenia lub jeszcze nie próbowano (patrz extraction_attempted_at). Aktualizowane w tym samym passie co extracted_calendar w api/scrape-faculty-announcements.ts.';

-- Defensywny limit długości na poziomie DB — chroni przed wpisaniem
-- całego komunikatu w pole "summary" przez błąd modelu lub złośliwy
-- request (scraper przez service_role bypassuje CHECK na poziomie
-- aplikacji, ale CHECK w SQL przejdzie zawsze).
ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_summary_length;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_summary_length
  CHECK (summary IS NULL OR length(summary) <= 400);
