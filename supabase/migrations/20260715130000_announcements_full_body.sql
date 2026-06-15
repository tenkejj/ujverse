-- ============================================================================
-- UJverse – komunikaty wydziałowe: pełna treść artykułów (drugi pass scrapera)
-- ============================================================================
-- Liferay i WordPress CM publikują na listings TYLKO excerpty (200-400 znaków).
-- Pełna treść artykułu siedzi za linkiem `source_url`. Scraper
-- (`api/scrape-faculty-announcements.ts`) robi trzeci pass:
--   1. Wybiera rzędy `source_kind IN ('liferay','wordpress_cm')` z krótkim
--      body i niezfetchowaną treścią.
--   2. GET na `source_url`, parsuje główny content element.
--   3. UPDATE `full_body` + `full_body_fetched_at` (NIE rusza `body`!).
--
-- DLACZEGO osobna kolumna a nie nadpisanie `body`:
--   `body_fingerprint` (UNIQUE) jest md5(body); trigger
--   `trg_announcement_body_fingerprint` przelicza fingerprint przy
--   `UPDATE OF body`. Gdybyśmy nadpisali body pełną treścią,
--   przy kolejnym cronie excerpt z listings dostałby inny fingerprint
--   niż w bazie -> upsert zinsertowałby duplikat (excerpt zamiast match).
--   Trzymając excerpt w `body` + pełną w `full_body`:
--     - fingerprint stabilny (md5 excerptu)
--     - dedup działa
--     - frontend używa `full_body ?? body` (adapter)
--
-- DLACZEGO `full_body_fetched_at` osobno od `extraction_attempted_at`:
--   Bielik extraction (TL;DR + kalendarz) jada na sam excerpt - pełna
--   treść daje lepszy materiał ale ekstrakcja jest droższa. Trzymamy
--   timestampy osobno, żeby móc niezależnie:
--     - re-runować ekstrakcję po fetchu pełnej treści
--     - re-runować fetch (np. po zmianie URL) bez tłuczenia ekstrakcji
-- ============================================================================

-- Pełna treść artykułu (z podstrony source_url). NULL = jeszcze nie pobrano
-- LUB source_kind nie supportuje fetcha (ISI Drupal ma już pełną treść).
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS full_body text NULL;

COMMENT ON COLUMN public.announcements.full_body IS
  'Pełna treść artykułu pobrana z source_url w drugim passie scrapera (api/scrape-faculty-announcements.ts). NULL gdy: jeszcze nie pobrano, fetch się nie udał, lub source_kind=isi_drupal (ma już pełną treść w body). Frontend używa COALESCE(full_body, body).';

-- Timestamp ostatniej próby fetcha pełnej treści (sukces LUB porażka).
-- Zapobiega re-fetcha tego samego URL-a co cron.
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS full_body_fetched_at timestamptz NULL;

COMMENT ON COLUMN public.announcements.full_body_fetched_at IS
  'Timestamp ostatniej próby pobrania pełnej treści (sukces lub porażka). NULL gdy jeszcze nie próbowaliśmy. Scraper filtruje WHERE full_body_fetched_at IS NULL, żeby nie tłuc tego samego URL-a co godzina.';

-- Index na pending rows - scraper iteruje po nich w drugim passie.
-- Partial index (WHERE) trzyma index mały (większość rzędów ma już
-- fetched_at po pierwszym cronie po starcie feature'a).
CREATE INDEX IF NOT EXISTS announcements_full_body_pending_idx
  ON public.announcements (created_at DESC)
  WHERE full_body_fetched_at IS NULL
    AND source_url IS NOT NULL
    AND source_kind IN ('liferay', 'wordpress_cm');
