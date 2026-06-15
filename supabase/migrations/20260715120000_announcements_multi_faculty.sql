-- Rozszerzenie announcements pod wieloźródłowy scraper komunikatów wszystkich
-- 16 wydziałów UJ (Liferay UJ Portal, WordPress CM, ISI Drupal — 3 parsery,
-- 16 source'ów). Każde source ma swój endpoint i typ parsera; do tej pory
-- jedyne źródło to ISI/WZiKS.
--
-- Zmiany:
--   1. `title TEXT NULL`           — opcjonalny tytuł komunikatu (Liferay i
--      WP wystawiają wprost <h3>/<h2>; ISI nie ma — zostaje NULL i UI bierze
--      pierwsze ~80 znaków `body`).
--   2. `source_url TEXT NULL`      — deep-link do oryginalnego ogłoszenia
--      (gdy parser potrafi wyciągnąć link). UI może otworzyć źródło w
--      nowym tabie. NULL = brak linku (ISI lecturer-block, agregacja
--      kilku ogłoszeń pod jedną kreską).
--   3. `source_kind TEXT NOT NULL` — który parser tworzył wpis. Pozwala
--      filtrować/debugować po typie strony bez patrzenia w `source`.
--   4. Relaxe CHECK na `status` — dodaje `'info'` (komunikat ogólny, np.
--      stypendia/rekrutacja — najczęstszy case na stronach wydziałowych)
--      i `'event'` (komunikat zapraszający na konkretne wydarzenie).
--      Stare 'cancelled'/'remote'/'duty' zostają — scraper ISI dalej ich
--      używa, kompatybilność wstecz.
--
-- Migracja jest forward-only, idempotentna (IF NOT EXISTS, DROP CONSTRAINT
-- IF EXISTS).

-- 1) title / source_url
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS title TEXT;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Defensywny limit długości — chroni przed wpisaniem całego HTML-a do title
-- (scraper przez service_role bypassuje wszystko poza CHECK w SQL).
ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_title_length;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_title_length
  CHECK (title IS NULL OR length(title) <= 500);

-- 2) source_kind — domyślnie 'isi_drupal' dla wszystkiego co już jest w DB
-- (do tej pory jedyne źródło to ISI/WZiKS).
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS source_kind TEXT;

UPDATE public.announcements
SET source_kind = 'isi_drupal'
WHERE source_kind IS NULL;

ALTER TABLE public.announcements
  ALTER COLUMN source_kind SET DEFAULT 'isi_drupal';

ALTER TABLE public.announcements
  ALTER COLUMN source_kind SET NOT NULL;

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_source_kind_check;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_source_kind_check
  CHECK (source_kind IN ('isi_drupal', 'liferay', 'wordpress_cm', 'manual'));

-- 3) status: dorzucamy 'info' + 'event' do dotychczasowych 3 statusów.
-- Stare wpisy zostają jak były ('cancelled'/'remote'/'duty').
ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_status_check;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_status_check
  CHECK (status IN ('cancelled', 'remote', 'duty', 'info', 'event'));

-- Index po department istnieje już od 20260412 — niczego nie dodajemy.

COMMENT ON COLUMN public.announcements.title IS
  'Tytuł komunikatu wyciągnięty przez parser (Liferay/WP). NULL = brak (ISI lecturer-block) — UI bierze pierwsze ~80 znaków body.';

COMMENT ON COLUMN public.announcements.source_url IS
  'Deep-link do oryginalnego ogłoszenia na stronie wydziału. NULL gdy parser nie potrafi go wyciągnąć (np. agregat ISI rozdzielony myślnikami).';

COMMENT ON COLUMN public.announcements.source_kind IS
  'Typ parsera który stworzył wpis: isi_drupal | liferay | wordpress_cm | manual. Używane do debug/filter; różne od `source` (czytelna nazwa portalu).';
