-- Deduplikacja treści (md5(body)) + Realtime dla announcements
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS body_fingerprint text;

UPDATE public.announcements
SET body_fingerprint = md5(body)
WHERE body_fingerprint IS NULL;

DELETE FROM public.announcements a
WHERE a.ctid <> (
  SELECT min(b.ctid)
  FROM public.announcements b
  WHERE b.body_fingerprint IS NOT DISTINCT FROM a.body_fingerprint
    AND b.body_fingerprint IS NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS announcements_body_fingerprint_uidx
  ON public.announcements (body_fingerprint);

ALTER TABLE public.announcements
  ALTER COLUMN body_fingerprint SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_announcement_body_fingerprint()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.body_fingerprint := md5(NEW.body);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_announcement_body_fingerprint ON public.announcements;
CREATE TRIGGER trg_announcement_body_fingerprint
  BEFORE INSERT OR UPDATE OF body ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_announcement_body_fingerprint();

ALTER TABLE public.announcements REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
