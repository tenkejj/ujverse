-- Re-queue TL;DR extraction po zmianie promptu Versusia.
-- Batchowy UPDATE unika statement timeout na dużej tabeli.
-- Stare summary zostają do czasu nadpisania przez reextract endpoint.

DO $$
DECLARE
  batch_size int := 500;
  affected int;
BEGIN
  LOOP
    UPDATE public.announcements a
    SET extraction_attempted_at = NULL
    FROM (
      SELECT id
      FROM public.announcements
      WHERE extraction_attempted_at IS NOT NULL
        AND char_length(trim(COALESCE(full_body, body))) >= 20
      LIMIT batch_size
    ) sub
    WHERE a.id = sub.id;

    GET DIAGNOSTICS affected = ROW_COUNT;
    EXIT WHEN affected = 0;
  END LOOP;
END $$;
