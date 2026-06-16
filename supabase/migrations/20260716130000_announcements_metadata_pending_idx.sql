-- Partial index dla kolejki metadata extraction (TL;DR + kalendarz).
-- Bez tego SELECT ... WHERE extraction_attempted_at IS NULL timeoutuje
-- na dużej tabeli announcements przy masowym reextract.

CREATE INDEX IF NOT EXISTS announcements_metadata_pending_idx
  ON public.announcements (created_at DESC)
  WHERE extraction_attempted_at IS NULL;
